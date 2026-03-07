# DataPilot Architecture & System Design

> **Purpose:** Transform DataPilot into a clear, modular PoC suitable for demonstration to stakeholders, with a path to production-ready use by businesses, data platforms, and data engineers.

---

## 1. Current Structure (As-Is)

### 1.1 High-Level Layout

```
Data-Pilot/
├── datapilot/           # Main package (v2) — canonical implementation
│   ├── cli.py           # Entry: datapilot audit | serve | integrations | ...
│   ├── core/            # Parser, graph, pipeline, reporter, config
│   ├── agents/         # Router (multi-LLM), analyst (per-dimension agents)
│   ├── api/             # REST Blueprint /api/v1 — NOT wired to serve
│   ├── web/             # Dashboard app (Flask + static index.html)
│   ├── exporters/       # JSON, CSV, SARIF, HTML, Jira, Airflow, Power BI
│   └── integrations/   # Airflow, Snowflake, Azure, AWS, GitLab, Kafka, etc.
├── agent/               # Legacy (v1) — duplicate parser, graph, reporter, single-Groq
├── scripts/             # answer_key (ground truth), validate_env
├── shopmesh_dbt/        # Synthetic dbt project (ShopMesh)
├── tests/unit/          # Unit tests only
├── deploy/k8s/          # K8s manifests
└── bootstrap.py         # Regenerates shopmesh_dbt + scripts (large)
```

### 1.2 Data Flow (Current)

**Audit flow:**
1. **CLI** `datapilot audit` → loads config (YAML or defaults)
2. **Parser** → reads dbt project (models, YAML, query_history) → `project_data`
3. **Graph** → `build_graph(project_data)` → NetworkX DAG; static checks (dead, orphans, broken refs, transitive orphans)
4. **Pipeline** → `AuditPipeline.run()` → parallel analyst tasks (dead models, orphans, broken refs, deprecated sources, duplicate metrics, grain joins, logic drift, missing tests)
5. **Reporter** → `build_report(findings, cost_waste, ...)` → report dict; optional `score_against_answer_key(report, answer_key)`
6. **Export** → JSON/CSV/SARIF/HTML/etc. written to output dir; graph JSON saved
7. If `--serve` → **web app** reads report/graph files and serves dashboard

**Serve flow:**
- `datapilot serve` → `datapilot.web.app.create_app(report_path, graph_path, project_path)` only
- **`datapilot.api.routes` (Blueprint /api/v1) is never mounted** — trigger-audit, metrics, integrations API are unreachable

### 1.3 Pain Points

| Issue | Impact |
|-------|--------|
| **Two codebases** (agent/ vs datapilot/) | Duplicate parser, graph, reporter; two entry points and two dashboards; drift risk |
| **API not wired** | `/api/v1` (trigger audit, metrics, integrations) never used by default app |
| **No feedback loop** | Score vs answer key exists but does not persist or improve prompts/config |
| **Tests** | Unit only; no integration/e2e; agent/ not in package, not in CI |
| **Config/documentation** | DATAPILOT_CONTEXT.md points to legacy `py agent/datapilot.py`; README is ShopMesh-focused |
| **Unused dependencies** | requirements.txt has legacy (kuzu, etc.); Dockerfile includes agent/ |

---

## 2. Proposed Architecture (To-Be)

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Presentation Layer                                                       │
│  • CLI (datapilot audit / serve / integrations / generate-*)             │
│  • Web Dashboard (single app: static + /api/* + /api/v1/*)                │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  API Layer                                                               │
│  • /api/report, /api/graph, /api/health, /api/findings, /api/models      │
│  • /api/v1/health, /api/v1/report, /api/v1/audit/trigger, /api/v1/metrics │
│  • Single Flask app with both route sets                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  Application / Orchestration Layer                                        │
│  • AuditPipeline (orchestrates parse → graph → static → agents → report) │
│  • FeedbackLoop (collect scores, store, suggest prompt/config tweaks)    │
│  • Trigger service (for API-triggered audits)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  Domain / Agent Layer                                                    │
│  • Parser, Graph (static analysis)                                       │
│  • AgentRouter (multi-LLM routing by tier)                               │
│  • Analyst agents (dead_models, orphans, broken_refs, deprecated_sources, │
│    duplicate_metrics, grain_joins, logic_drift, missing_tests)           │
│  • AnomalyDetector (optional: statistical/heuristic anomalies)          │
│  • ImprovementSuggestor (suggest fixes from findings + feedback)         │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  Infrastructure / Cross-Cutting                                          │
│  • Config (DataPilotConfig, YAML, env)                                   │
│  • Exporters (formats), Integrations (Airflow, Snowflake, …)             │
│  • Storage: report/graph files; optional feedback store (JSON/SQLite)   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Map (Target)

```
datapilot/
├── cli.py                 # CLI only; delegates to application layer
├── core/
│   ├── config.py          # (unchanged) DataPilotConfig, providers, routing
│   ├── parser.py          # (unchanged) parse_project
│   ├── graph.py           # (unchanged) build_graph, find_*
│   ├── pipeline.py        # AuditPipeline (unchanged)
│   ├── reporter.py        # build_report, score_against_answer_key
│   └── feedback.py        # NEW: store run results, score history, suggest improvements
├── agents/
│   ├── router.py          # AgentRouter
│   ├── analyst.py         # analyze_* functions
│   ├── anomaly.py         # NEW (optional): detect anomalies beyond agent findings
│   └── suggestor.py       # NEW: suggest improvements from findings + feedback
├── api/
│   └── routes.py          # Blueprint /api/v1; mounted by web app
├── web/
│   └── app.py             # create_app() mounts api_bp, serves static + /api + /api/v1
├── exporters/
├── integrations/
└── storage/               # NEW (optional): feedback_store, run_history
```

### 2.3 Single Entry & Single Web App

- **One CLI:** `datapilot` (from `datapilot.cli:main`). Deprecate `agent/datapilot.py`; remove or keep as legacy script with clear doc.
- **One web app:** `datapilot.web.app.create_app()`:
  - Serves static dashboard.
  - Serves existing `/api/report`, `/api/graph`, `/api/health`, `/api/findings`, `/api/models`, etc.
  - **Mounts** `datapilot.api.routes.api_bp` at `/api/v1` so trigger-audit, metrics, integrations are available.

### 2.4 Config & Paths

- **Single source of truth:** `datapilot.yaml` (or env) for project_root, output_dir, LLM, routing, integrations.
- CLI resolves paths from config first; fallbacks (e.g. `shopmesh_dbt`) only when config is missing.
- Document in README and DATAPILOT_CONTEXT.md: “Run: `datapilot audit` / `datapilot serve`”.

---

## 3. AI Agent System Design

### 3.1 Roles

| Component | Role |
|-----------|------|
| **Detection (existing)** | Analyst agents (dead models, orphans, broken refs, deprecated sources, duplicate metrics, grain joins, logic drift, missing tests) + static graph analysis. |
| **Anomaly detection (new, optional)** | Lightweight layer: e.g. cost spikes, sudden drop in model usage, schema drift indicators — can be rule-based or small model; output as “anomaly” findings. |
| **Suggestions** | **ImprovementSuggestor:** Consumes findings + (optional) feedback store; suggests concrete actions (e.g. “add test on order_id”, “deprecate model X”, “align metric Y with core_revenue_summary”). |
| **Feedback loop** | **FeedbackLoop:** After each run, store (run_id, score, findings_count, missed_ids, timestamp). Periodically (or on demand) analyze history and suggest prompt/config tweaks to improve score or coverage. |

### 3.2 Detection (Current + Optional Anomaly)

- **Keep:** All current analyst agents and static analysis.
- **Add (PoC):** Optional `agents/anomaly.py` that:
  - Input: `project_data`, `query_history`, `report`.
  - Uses simple heuristics (e.g. cost > threshold, zero queries last N days, refs to deprecated sources) or small set of rules.
  - Output: list of “anomaly” findings merged into report.

### 3.3 Suggestions (ImprovementSuggestor)

- **Input:** Report findings, optional feedback store (e.g. “user dismissed finding X”, “user applied fix Y”).
- **Output:** List of suggested actions with priority (e.g. critical/high/medium), model/metric, and text (e.g. RECOMMENDED_ACTIONS in analyst.py).
- **PoC:** Implement as a module that maps finding types to recommended actions (already partially in analyst.py); optionally use LLM to tailor message per finding.

### 3.4 Feedback Loop (Continuous Improvement)

- **Store:** Persist per run: `run_id`, `timestamp`, `score_pct`, `problems_found`, `missed_ids`, `findings_count`, `project_root` (optional). Backend: JSON file or SQLite under output dir.
- **Analyze:** Periodically (e.g. after each run or via CLI `datapilot feedback summarize`):
  - Compute trends (e.g. score over time, recurring missed_ids).
  - Optionally suggest: “Try routing task X to premium tier” or “Add prompt hint for Y”.
- **PoC:** Implement storage + one “summarize” command; no automatic prompt rewriting yet.

---

## 4. Modularity & Scalability

### 4.1 Boundaries

- **Core** does not depend on agents or web. **Agents** depend on core (config, graph, parser) and router. **Pipeline** depends on core + agents. **Web** depends on core (for optional trigger that runs pipeline) and api.
- **Integrations** and **exporters** are pluggable; add new ones without changing pipeline.

### 4.2 Adding New Analysts

- Add a new `analyze_<topic>()` in `agents/analyst.py` with the same signature pattern (router, context, …) → list of findings.
- Register the task in config (routing tier) and call it from `AuditPipeline.run()`.

### 4.3 Adding New Integrations

- Implement the interface in `integrations/base.py`; register in `IntegrationRegistry`. CLI and API already list integrations; new ones appear automatically.

### 4.4 Evolution

- **Phase 1 (PoC):** Unify app (wire API), remove or deprecate agent/, add feedback store + summarize, document entry point and config.
- **Phase 2:** Add ImprovementSuggestor and optional AnomalyDetector; expose suggestions in report and UI.
- **Phase 3:** Strengthen feedback loop (trends, prompt/config suggestions); optional KuzuDB or DB for larger deployments.

---

## 5. Summary

| Aspect | Current | Target |
|--------|---------|--------|
| Entry | CLI + legacy agent/datapilot.py | Single CLI `datapilot` |
| Web | Dashboard only; /api/v1 unused | One app: dashboard + /api + /api/v1 |
| Agents | Detection only | Detection + optional anomaly + suggestions |
| Feedback | Score vs answer key, not persisted | Stored runs + summarize + future prompt/config hints |
| Structure | Duplicate agent/ vs datapilot/ | Single package, clear layers |
| Docs | Context points to legacy | README + context aligned with CLI and config |

This gives you a **clear architecture**, **modular components**, **AI agents** that can detect, suggest, and improve over time, and a **refactoring path** without building a perfect final product — a strong PoC for demonstration and iteration.
