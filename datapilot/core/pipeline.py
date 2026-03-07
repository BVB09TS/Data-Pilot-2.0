"""Pipeline engine — orchestrates the full audit with parallel execution.

Supports:
- Parallel analysis tasks via ThreadPoolExecutor
- Event hooks for integration with external systems
- Structured logging and observability
- Progress callbacks for UI updates
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Callable

import structlog

from datapilot.agents.analyst import (
    analyze_broken_refs,
    analyze_dead_models,
    analyze_deprecated_sources,
    analyze_duplicate_metrics,
    analyze_grain_joins,
    analyze_logic_drift,
    analyze_missing_tests,
    analyze_orphans,
)
from datapilot.agents.router import AgentRouter
from datapilot.core.config import DataPilotConfig

logger = structlog.get_logger()


@dataclass
class PipelineEvent:
    """Event emitted during pipeline execution."""

    event_type: str  # "stage_start", "stage_complete", "finding", "error"
    stage: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


EventCallback = Callable[[PipelineEvent], None]


@dataclass
class PipelineResult:
    """Result of a complete pipeline run."""

    findings: dict[str, list[dict]]
    stats: dict[str, Any]
    events: list[PipelineEvent]
    duration_ms: float
    models_analyzed: int
    issues_found: int


class AuditPipeline:
    """Orchestrates the full dbt audit pipeline."""

    def __init__(self, config: DataPilotConfig, router: AgentRouter):
        self.config = config
        self.router = router
        self._callbacks: list[EventCallback] = []
        self._events: list[PipelineEvent] = []

    def on_event(self, callback: EventCallback) -> None:
        """Register an event callback."""
        self._callbacks.append(callback)

    def _emit(self, event: PipelineEvent) -> None:
        """Emit an event to all registered callbacks."""
        self._events.append(event)
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception as e:
                logger.error("event_callback_error", error=str(e))

    def run(
        self,
        project: dict,
        graph: Any,
        dead_list: list[str],
        orphan_list: list[str],
        broken_list: list[dict],
        transitive_orphans: list[str],
        progress_callback: Callable[[str, int, int], None] | None = None,
    ) -> PipelineResult:
        """Execute the full analysis pipeline.

        Args:
            project: Parsed dbt project data
            graph: NetworkX lineage graph
            dead_list: Models with zero queries
            orphan_list: Models with no downstream
            broken_list: Models with missing refs
            transitive_orphans: Transitively orphaned models
            progress_callback: Optional (stage_name, current, total) callback
        """
        start = time.monotonic()
        models = project["models"]
        query_history = project["query_history"]
        cost_waste = project["cost_waste"]

        self._emit(PipelineEvent("pipeline_start", "init", {"model_count": len(models)}))

        total_stages = 8
        current_stage = 0

        def progress(stage: str) -> None:
            nonlocal current_stage
            current_stage += 1
            if progress_callback:
                progress_callback(stage, current_stage, total_stages)
            self._emit(PipelineEvent("stage_start", stage))

        findings: dict[str, list[dict]] = {}

        if self.config.pipeline.parallel_analysis:
            findings = self._run_parallel(
                models, query_history, cost_waste,
                dead_list, orphan_list, broken_list, transitive_orphans,
                progress,
            )
        else:
            findings = self._run_sequential(
                models, query_history, cost_waste,
                dead_list, orphan_list, broken_list, transitive_orphans,
                progress,
            )

        duration = (time.monotonic() - start) * 1000
        total_issues = sum(len(v) for v in findings.values())

        self._emit(
            PipelineEvent(
                "pipeline_complete",
                "done",
                {"issues": total_issues, "duration_ms": round(duration)},
            )
        )

        return PipelineResult(
            findings=findings,
            stats=self.router.get_stats(),
            events=self._events,
            duration_ms=duration,
            models_analyzed=len(models),
            issues_found=total_issues,
        )

    def _run_parallel(
        self,
        models: dict,
        query_history: dict,
        cost_waste: dict,
        dead_list: list[str],
        orphan_list: list[str],
        broken_list: list[dict],
        transitive_orphans: list[str],
        progress: Callable[[str], None],
    ) -> dict[str, list[dict]]:
        """Run analysis tasks in parallel using a thread pool."""
        findings: dict[str, list[dict]] = {}

        # Deterministic tasks run first (no LLM needed)
        progress("missing_tests")
        findings["missing_tests"] = analyze_missing_tests(models)

        # LLM-powered tasks run in parallel
        tasks = {
            "dead_models": lambda: analyze_dead_models(
                self.router, dead_list, cost_waste, query_history, models
            ),
            "orphans": lambda: analyze_orphans(
                self.router, orphan_list, transitive_orphans, models
            ),
            "broken_refs": lambda: analyze_broken_refs(self.router, broken_list, models),
            "duplicate_metrics": lambda: analyze_duplicate_metrics(self.router, models),
            "grain_joins": lambda: analyze_grain_joins(self.router, models),
            "deprecated": lambda: analyze_deprecated_sources(self.router, models),
            "logic_drift": lambda: analyze_logic_drift(self.router, models),
        }

        with ThreadPoolExecutor(max_workers=self.config.pipeline.max_workers) as executor:
            futures = {}
            for name, fn in tasks.items():
                progress(name)
                futures[executor.submit(fn)] = name

            for future in as_completed(futures):
                name = futures[future]
                try:
                    result = future.result()
                    findings[name] = result
                    self._emit(
                        PipelineEvent("stage_complete", name, {"count": len(result)})
                    )
                except Exception as e:
                    logger.error("analysis_failed", stage=name, error=str(e))
                    findings[name] = []
                    self._emit(
                        PipelineEvent("error", name, {"error": str(e)})
                    )

        return findings

    def _run_sequential(
        self,
        models: dict,
        query_history: dict,
        cost_waste: dict,
        dead_list: list[str],
        orphan_list: list[str],
        broken_list: list[dict],
        transitive_orphans: list[str],
        progress: Callable[[str], None],
    ) -> dict[str, list[dict]]:
        """Run analysis tasks sequentially."""
        progress("dead_models")
        dead_f = analyze_dead_models(self.router, dead_list, cost_waste, query_history, models)

        progress("orphans")
        orphan_f = analyze_orphans(self.router, orphan_list, transitive_orphans, models)

        progress("broken_refs")
        broken_f = analyze_broken_refs(self.router, broken_list, models)

        progress("duplicate_metrics")
        dup_f = analyze_duplicate_metrics(self.router, models)

        progress("grain_joins")
        grain_f = analyze_grain_joins(self.router, models)

        progress("deprecated")
        dep_f = analyze_deprecated_sources(self.router, models)

        progress("missing_tests")
        test_f = analyze_missing_tests(models)

        progress("logic_drift")
        drift_f = analyze_logic_drift(self.router, models)

        return {
            "dead_models": dead_f,
            "orphans": orphan_f,
            "broken_refs": broken_f,
            "duplicate_metrics": dup_f,
            "grain_joins": grain_f,
            "deprecated": dep_f,
            "missing_tests": test_f,
            "logic_drift": drift_f,
        }
