"""DataPilot CLI — enterprise command-line interface.

Usage:
    datapilot audit [--project PATH] [--output DIR] [--config PATH]
    datapilot serve [--port PORT]
    datapilot export [--format FORMAT]
    datapilot integrations [--check]
    datapilot generate-dag [--schedule CRON]
    datapilot generate-k8s [--image IMAGE]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv

# Load .env so GROQ_API_KEY and other secrets are available
load_dotenv()
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()


@click.group()
@click.version_option(version="2.0.0", prog_name="DataPilot")
def main():
    """DataPilot — AI-powered dbt project auditor with multi-agent intelligence."""
    pass


@main.command()
@click.option("--project", "-p", default=None, help="Path to dbt project root")
@click.option("--output", "-o", default=None, help="Output directory for reports")
@click.option("--config", "-c", default=None, help="Path to datapilot.yaml config")
@click.option("--no-score", is_flag=True, help="Skip scoring against answer key")
@click.option("--parallel/--sequential", default=True, help="Run analysis in parallel")
@click.option("--format", "-f", multiple=True, default=["json"], help="Export formats")
@click.option("--serve", is_flag=True, help="Start web UI after generating reports")
@click.option("--port", type=int, default=5000, help="Port for the web UI")
@click.option("--fix", is_flag=True, help="Auto-remediate issues (e.g. deprecate dead models)")
@click.option("--watch", is_flag=True, help="Run in watch mode for IDE shift-left integration")
def audit(project, output, config, no_score, parallel, format, serve, port, fix, watch):
    """Run a full dbt project audit."""
    from datapilot.core.config import DataPilotConfig
    from datapilot.core.parser import parse_project, summary as project_summary
    from datapilot.core.graph import (
        build_graph,
        find_all_dead,
        find_orphans,
        find_transitive_orphans,
        find_broken_refs,
        graph_summary,
        export_graph_data,
    )
    from datapilot.core.reporter import build_report, score_against_answer_key, print_report
    from datapilot.core.pipeline import AuditPipeline
    from datapilot.agents.router import AgentRouter
    from datapilot.exporters.formats import export_all
    import time

    # Watchdog imports for Shift-Left Co-Pilot
    try:
        from watchdog.observers import Observer
        from watchdog.events import PatternMatchingEventHandler
    except ImportError:
        Observer = None

    # Load config
    if config:
        cfg = DataPilotConfig.from_yaml(config)
    else:
        cfg = DataPilotConfig()

    cfg.pipeline.parallel_analysis = parallel

    # Resolve paths
    root = Path(__file__).parent
    dbt_root = project or cfg.project_root
    if dbt_root == ".":
        dbt_root = str(root.parent / "shopmesh_dbt")
    dbt_root = str(Path(dbt_root).resolve())

    out_dir = output or cfg.output_dir
    if out_dir == "./output":
        out_dir = str(root.parent)
    out_dir = str(Path(out_dir).resolve())
    os.makedirs(out_dir, exist_ok=True)

    scripts_dir = str(root.parent / "scripts")
    answer_key = os.path.join(scripts_dir, "answer_key.py")

    print()
    print("=" * 58)
    print("  DataPilot v2.0  --  Multi-Agent dbt Auditor")
    print("=" * 58)
    print(f"  Project : {dbt_root}")
    print(f"  Output  : {out_dir}")

    # Show available providers
    available = cfg.get_available_providers()
    if available:
        print(f"  LLM providers: {', '.join(f'{p.provider}/{p.model} [{p.tier.value}]' for p in available)}")
    else:
        print("  WARNING: No LLM providers configured!")

    # 1. Parse
    print("\n[1/5] Parsing dbt project...")
    project_data = parse_project(dbt_root)
    print(project_summary(project_data))
    models = project_data["models"]
    query_history = project_data["query_history"]

    # 2. Build graph
    print("\n[2/5] Building lineage graph...")
    G = build_graph(project_data)
    print(graph_summary(G, models))

    # 3. Static analysis
    print("\n[3/5] Static analysis...")
    dead_list = find_all_dead(G, models, query_history)
    orphan_list = find_orphans(G, models)
    broken_list = find_broken_refs(G, models)
    transitive_orph = find_transitive_orphans(G, models, orphan_list, dead_list)

    print(
        f"  dead={len(dead_list)}, orphans={len(orphan_list)}, "
        f"transitive_orphans={len(transitive_orph)}, broken_refs={len(broken_list)}"
    )

    # 4. Multi-agent analysis
    print("\n[4/5] Multi-agent analysis...")
    router = AgentRouter(config=cfg)
    pipeline = AuditPipeline(config=cfg, router=router)

    def on_progress(stage: str, current: int, total: int):
        print(f"  -> [{current}/{total}] {stage}...")

    result = pipeline.run(
        project=project_data,
        graph=G,
        dead_list=dead_list,
        orphan_list=orphan_list,
        broken_list=broken_list,
        transitive_orphans=transitive_orph,
        progress_callback=on_progress,
    )

    # 5. Report
    print("\n[5/5] Building reports...")
    report = build_report(
        result.findings,
        project_data["cost_waste"],
        models,
        agent_stats=result.stats,
    )

    score = None
    if not no_score and os.path.exists(answer_key):
        score = score_against_answer_key(report, answer_key)

    print_report(report, score)

    # Export
    graph_data = export_graph_data(G, models, report["findings"])

    export_results = export_all(report, out_dir, list(format))
    for fmt, path in export_results.items():
        print(f"  {fmt:6s} -> {path}")

    # Save graph
    graph_path = os.path.join(out_dir, "datapilot_graph.json")
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, indent=2, default=str)
    print(f"  graph  -> {graph_path}")

    # Save full report with score
    full_path = os.path.join(out_dir, "datapilot_report.json")
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump({"report": report, "score": score, "graph": graph_data}, f, indent=2, default=str)

    print(f"\n  Pipeline: {result.duration_ms:.0f}ms, {result.issues_found} issues")

    # Auto-Remediation (Pillar 4) — not yet implemented
    if fix:
        print("\n[6/6] Auto-Remediation (--fix flag)")
        print("  Note: auto-remediation is not yet implemented in this release.")
        print("  Review findings above and apply manual fixes via your dbt project.")
        print("  Roadmap: https://github.com/BVB09TS/Data-Pilot-2.0/issues")

    # Shift-Left IDE Watch Mode (Pillar 3)
    if watch:
        if not Observer:
            print("\n  Watch mode requires 'watchdog'. Run: pip install watchdog")
            return
            
        print(f"\n[Watch Mode] Monitoring {dbt_root} for changes to .sql/.yml files...")
        print("Waiting for file changes... (Press Ctrl+C to stop)")
        
        class DbtProjectHandler(PatternMatchingEventHandler):
            def __init__(self):
                super().__init__(patterns=["*.sql", "*.yml"], ignore_patterns=[".*"])
                self.last_run = 0.0

            def on_modified(self, event):
                now = time.time()
                # Debounce rapid saves (e.g. auto-formatters)
                if now - self.last_run < 3:
                    return
                self.last_run = now

                changed = event.src_path
                print(f"\n[Watch] Detected change in {changed}")
                print("[Watch] Re-running targeted static analysis...")
                try:
                    from datapilot.core.parser import parse_project
                    from datapilot.core.graph import (
                        build_graph,
                        find_all_dead,
                        find_orphans,
                        find_broken_refs,
                    )

                    _pd = parse_project(dbt_root)
                    _G = build_graph(_pd)
                    _broken = find_broken_refs(_G, _pd["models"])
                    _dead = find_all_dead(_G, _pd["models"], _pd["query_history"])
                    _orphans = find_orphans(_G, _pd["models"])

                    issues: list[str] = []
                    for b in _broken:
                        issues.append(f"  broken_ref: {b.get('model')} -> {b.get('missing_ref')}")
                    for d in _dead:
                        issues.append(f"  dead_model: {d}")
                    for o in _orphans:
                        issues.append(f"  orphan: {o}")

                    if issues:
                        print(f"[Watch] {len(issues)} static issue(s) found:")
                        for msg in issues:
                            print(msg)
                    else:
                        print("[Watch] No static issues detected.")
                except Exception as exc:
                    print(f"[Watch] Analysis error: {exc}")

        observer = Observer()
        observer.schedule(DbtProjectHandler(), path=dbt_root, recursive=True)
        observer.start()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()

    # Feedback store (for continuous improvement)
    if score is not None:
        from datapilot.core.feedback import FeedbackStore

        store = FeedbackStore(store_path=os.path.join(out_dir, "datapilot_feedback.json"))
        store.append(
            score_pct=score.get("score_pct"),
            problems_found=score.get("problems_found"),
            planted_total=score.get("planted_total"),
            missed_ids=score.get("missed_ids", []),
            findings_count=report.get("total_findings"),
            project_root=dbt_root,
            passed=score.get("passed"),
        )

    if serve:
        _start_web(full_path, graph_path, port)


@main.command()
@click.option("--port", type=int, default=5000, help="Port for the web UI")
@click.option("--report", default=None, help="Path to datapilot_report.json")
@click.option("--graph", default=None, help="Path to datapilot_graph.json")
@click.option("--project", default=None, help="Path to dbt project directory")
def serve(port, report, graph, project):
    """Start the interactive web dashboard."""
    report = report or "datapilot_report.json"
    graph = graph or "datapilot_graph.json"
    _start_web(report, graph, port, project)


def _start_web(report_path: str, graph_path: str, port: int, project_path: str | None = None):
    """Start the web dashboard."""
    from datapilot.web.app import create_app

    app = create_app(report_path, graph_path, project_path)
    print(f"\n  DataPilot Dashboard: http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)


@main.command()
@click.option("--check", is_flag=True, help="Run health checks on all integrations")
def integrations(check):
    """List and check enterprise integrations."""
    from datapilot.integrations.base import IntegrationRegistry
    from datapilot.integrations.airflow import AirflowIntegration
    from datapilot.integrations.snowflake import SnowflakeIntegration
    from datapilot.integrations.azure import AzureIntegration
    from datapilot.integrations.aws import AWSIntegration
    from datapilot.integrations.gitlab import GitLabIntegration
    from datapilot.integrations.messaging import KafkaIntegration, WebhookIntegration
    from datapilot.integrations.powerbi import PowerBIIntegration
    from datapilot.integrations.dbt import DbtCloudIntegration
    from datapilot.integrations.kubernetes import KubernetesIntegration

    registry = IntegrationRegistry()
    all_integrations = [
        AirflowIntegration(),
        SnowflakeIntegration(),
        AzureIntegration(),
        AWSIntegration(),
        GitLabIntegration(),
        KafkaIntegration(),
        WebhookIntegration(),
        PowerBIIntegration(),
        DbtCloudIntegration(),
        KubernetesIntegration(),
    ]

    print("\n  DataPilot v2.0 — Enterprise Integrations")
    print("=" * 50)

    for integration in all_integrations:
        registry.register(integration)
        status = "configured" if integration.is_configured() else "not configured"
        indicator = "[+]" if integration.is_configured() else "[-]"
        print(f"  {indicator} {integration.name:25s} {status}")

        if check and integration.is_configured():
            health = integration.health_check()
            print(f"      Health: {health.get('status', 'unknown')}")

    print()


@main.command("generate-dag")
@click.option("--output", "-o", default="./dags", help="Output directory for DAG file")
@click.option("--schedule", default="@daily", help="Cron schedule")
@click.option("--dag-id", default="datapilot_dbt_audit", help="DAG identifier")
def generate_dag(output, schedule, dag_id):
    """Generate an Airflow DAG for scheduled audits."""
    from datapilot.integrations.airflow import AirflowIntegration

    integration = AirflowIntegration(dag_folder=output)
    content = integration.generate_dag(dag_id=dag_id, schedule=schedule)
    print(f"  Generated Airflow DAG: {output}/{dag_id}.py")


@main.command("generate-k8s")
@click.option("--output", "-o", default="./deploy/k8s", help="Output directory")
@click.option("--image", default="datapilot:2.0.0", help="Docker image")
@click.option("--schedule", default="0 6 * * *", help="Cron schedule")
def generate_k8s(output, image, schedule):
    """Generate Kubernetes manifests for deployment."""
    from datapilot.integrations.kubernetes import KubernetesIntegration

    os.makedirs(output, exist_ok=True)
    integration = KubernetesIntegration()
    manifest = integration.generate_manifests(image=image, schedule=schedule)

    path = os.path.join(output, "datapilot-cronjob.yaml")
    import yaml

    with open(path, "w") as f:
        yaml.dump(manifest, f, default_flow_style=False)
    print(f"  Generated K8s manifest: {path}")


@main.command("feedback")
@click.option("--store", "-s", default=None, help="Path to datapilot_feedback.json")
@click.option("--last", "-n", type=int, default=10, help="Number of recent runs to summarize")
def feedback(store, last):
    """Summarize feedback from recent audit runs."""
    from datapilot.core.feedback import FeedbackStore

    store_path = store or "datapilot_feedback.json"
    fb = FeedbackStore(store_path=store_path)
    summary = fb.summarize(last_n=last)

    print("\n  DataPilot — Feedback Summary")
    print("=" * 50)
    if summary.get("runs", 0) == 0:
        print("  No runs recorded yet. Run 'datapilot audit' with scoring to collect feedback.")
        print()
        return

    print(f"  Runs analyzed : {summary['runs']} (last {summary['last_n']})")
    if summary.get("avg_score") is not None:
        print(f"  Avg score     : {summary['avg_score']}%")
        print(f"  Min / Max     : {summary.get('min_score')}% / {summary.get('max_score')}%")
    print(f"  Passed        : {summary.get('passed_count', 0)} / {summary['runs']}")

    most_missed = summary.get("most_missed", [])
    if most_missed:
        print("\n  Most missed problem IDs:")
        for pid, count in most_missed:
            print(f"    {pid}: {count} times")

    print()


@main.command("init-config")
@click.option("--output", "-o", default="datapilot.yaml", help="Config file path")
def init_config(output):
    """Generate a default configuration file."""
    from datapilot.core.config import DataPilotConfig

    cfg = DataPilotConfig()
    cfg.to_yaml(output)
    print(f"  Generated config: {output}")


if __name__ == "__main__":
    main()
