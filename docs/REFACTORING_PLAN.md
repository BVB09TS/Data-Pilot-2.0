# DataPilot Refactoring Plan

> **Goal:** Transform the codebase into a clean, extensible PoC with clear architecture, modular components, and AI-driven improvement loops. Execute in phases to minimize risk and allow incremental demos.

---

## Code to Clean or Remove (Redundancy & Dead Code)

| Item | Location | Action |
|------|----------|--------|
| **Legacy agent/** | `agent/parser.py`, `agent/graph.py`, `agent/analyzer.py`, `agent/reporter.py`, `agent/web/` | Deprecate; add notice in `agent/datapilot.py`; remove from Dockerfile; optionally delete after Phase 1 |
| **Duplicate parser** | `agent/parser.py` vs `datapilot/core/parser.py` | Remove agent/parser; use core only |
| **Duplicate graph** | `agent/graph.py` vs `datapilot/core/graph.py` | Remove agent/graph; use core only |
| **Duplicate reporter** | `agent/reporter.py` vs `datapilot/core/reporter.py` | Remove agent/reporter; use core only |
| **Unused API** | `datapilot/api/routes.py` — `create_api_app()` | Wire `api_bp` into `datapilot.web.app.create_app()`; `create_api_app` can remain for standalone API use if needed |
| **Legacy deps** | `requirements.txt`: kuzu | Remove if no imports; verify with grep |
| **Outdated context** | `DATAPILOT_CONTEXT.md` — "Run: py agent/datapilot.py" | Update to `datapilot audit` / `datapilot serve` |
| **bootstrap.py** | References to agent/ | Remove agent/ from bootstrap output if present |

---

## Phase 1: Consolidation & Cleanup (Foundation)

**Objective:** Remove redundancy, wire the API, and align documentation. No new features yet.

### 1.1 Deprecate or Remove Legacy `agent/`

| Step | Action | Notes |
|------|--------|-------|
| 1.1.1 | Add deprecation notice to `agent/datapilot.py` | Print "DEPRECATED: Use `datapilot audit` instead" when run |
| 1.1.2 | Update Dockerfile | Remove `agent/` from COPY; use only `datapilot` package |
| 1.1.3 | Update bootstrap.py | Stop generating or referencing agent/ if it's regenerated |
| 1.1.4 | (Optional) Delete agent/ | After confirming no external consumers; or keep as `agent_legacy/` with README |

**Files to modify:** `agent/datapilot.py`, `Dockerfile`, `bootstrap.py` (if applicable)

### 1.2 Wire API Blueprint to Web App

| Step | Action | Notes |
|------|--------|-------|
| 1.2.1 | In `datapilot/web/app.py`, import `api_bp` from `datapilot.api.routes` | Add: `from datapilot.api.routes import api_bp` |
| 1.2.2 | Register blueprint in `create_app()` | `app.register_blueprint(api_bp)` |
| 1.2.3 | Pass report/graph/project paths to API | `api_bp` uses `request.args.get("path")`; set app config or inject paths so API can resolve them |
| 1.2.4 | Add `create_api_app` usage or merge | Either use `create_api_app` as the main app, or merge its routes into `create_app`; simplest: register `api_bp` in `create_app` and ensure API routes receive paths from app config |

**Files to modify:** `datapilot/web/app.py`, possibly `datapilot/api/routes.py` (to read paths from `app.config`)

### 1.3 Unify Path Resolution

| Step | Action | Notes |
|------|--------|-------|
| 1.3.1 | Store report_path, graph_path, project_path in `app.config` | When `create_app(report_path, graph_path, project_path)` is called, store in config |
| 1.3.2 | Update API routes | Use `current_app.config` to get paths instead of `request.args.get("path")` when not provided |

**Files to modify:** `datapilot/web/app.py`, `datapilot/api/routes.py`

### 1.4 Update Documentation

| Step | Action | Notes |
|------|--------|-------|
| 1.4.1 | Update DATAPILOT_CONTEXT.md | Change "Run: py agent/datapilot.py" → "Run: datapilot audit" and "datapilot serve"; update folder structure to match current layout |
| 1.4.2 | Update README.md | Add "How to run DataPilot" section: `datapilot audit`, `datapilot serve`, config via `datapilot.yaml` |
| 1.4.3 | Add docs/README.md | Link to ARCHITECTURE.md and REFACTORING_PLAN.md |

**Files to modify:** `DATAPILOT_CONTEXT.md`, `README.md`; create `docs/README.md`

### 1.5 Trim Dependencies

| Step | Action | Notes |
|------|--------|-------|
| 1.5.1 | Audit requirements.txt | Remove kuzu if unused; keep dbt-duckdb, pandas, duckdb only if shopmesh_dbt or scripts need them |
| 1.5.2 | Update pyproject.toml | Ensure optional deps match actual usage |

**Files to modify:** `requirements.txt`, `pyproject.toml` (if needed)

---

## Phase 2: Feedback Loop & Suggestions (PoC Value) — DONE

**Objective:** Add a feedback store and improvement suggestion layer to demonstrate "continuous improvement" capability.

### 2.1 Feedback Store

| Step | Action | Notes |
|------|--------|-------|
| 2.1.1 | Create `datapilot/core/feedback.py` | `FeedbackStore` class: append run record to JSON file (run_id, timestamp, score_pct, problems_found, missed_ids, findings_count, project_root) |
| 2.1.2 | Call store after audit | In CLI audit command, after `score_against_answer_key`, call `FeedbackStore.append(run_record)` |
| 2.1.3 | Add CLI command `datapilot feedback summarize` | Reads store, prints summary (last N runs, score trend, most missed problem IDs) |

**Files to create:** `datapilot/core/feedback.py`  
**Files to modify:** `datapilot/cli.py`

### 2.2 Improvement Suggestor

| Step | Action | Notes |
|------|--------|-------|
| 2.2.1 | Create `datapilot/agents/suggestor.py` | `ImprovementSuggestor` class: given report findings, returns list of `{action, priority, model, description}` using RECOMMENDED_ACTIONS mapping |
| 2.2.2 | Integrate into report | Add `suggestions` key to report dict; call suggestor in `build_report` or in pipeline |
| 2.2.3 | Expose in API and UI | `/api/suggestions` or include in `/api/findings`; show in dashboard |

**Files to create:** `datapilot/agents/suggestor.py`  
**Files to modify:** `datapilot/core/reporter.py` or `datapilot/core/pipeline.py`, `datapilot/web/app.py`, `datapilot/web/static/index.html` (optional)

### 2.3 Optional Anomaly Detector

| Step | Action | Notes |
|------|--------|-------|
| 2.3.1 | Create `datapilot/agents/anomaly.py` | `AnomalyDetector` with simple rules: e.g. cost_waste > threshold, models with zero queries in last 90 days, refs to deprecated sources |
| 2.3.2 | Call from pipeline | Add anomaly findings to report before or after analyst findings |
| 2.3.3 | Make it configurable | Config flag `enable_anomaly_detection: bool` to turn on/off |

**Files to create:** `datapilot/agents/anomaly.py`  
**Files to modify:** `datapilot/core/pipeline.py`, `datapilot/core/config.py`

---

## Phase 3: Testing & Polish

**Objective:** Improve test coverage and polish for demo.

### 3.1 Integration Tests

| Step | Action | Notes |
|------|--------|-------|
| 3.1.1 | Create `tests/integration/` | Add `test_audit_e2e.py`: run `datapilot audit` on shopmesh_dbt, assert report JSON exists and has expected structure |
| 3.1.2 | Add conftest.py | Shared fixtures: temp dbt project, paths |
| 3.1.3 | CI | Run integration tests in GitHub Actions |

**Files to create:** `tests/integration/test_audit_e2e.py`, `tests/conftest.py`

### 3.2 Dashboard Polish

| Step | Action | Notes |
|------|--------|-------|
| 3.2.1 | Add suggestions section | If not done in Phase 2, show suggestions in findings view |
| 3.2.2 | Add feedback summary | Optional: small widget showing last run score and trend |
| 3.2.3 | Fix any UI bugs | Ensure lineage graph, model tree, findings load correctly |

**Files to modify:** `datapilot/web/static/index.html`, related JS/CSS

### 3.3 Demo Script

| Step | Action | Notes |
|------|--------|-------|
| 3.3.1 | Create `scripts/demo.sh` or `scripts/demo.ps1` | One-command demo: audit → serve, with clear output |
| 3.3.2 | Document in README | "Quick demo: ./scripts/demo.sh" or equivalent |

**Files to create:** `scripts/demo.ps1` (Windows), `scripts/demo.sh` (Unix)

---

## Phase 4: Future Enhancements (Post-PoC)

- **Automatic prompt tuning:** Use feedback history to suggest prompt changes (e.g. "Add example for DEAD-001").
- **KuzuDB / graph DB:** Persistent lineage for large projects.
- **Async pipeline:** Use asyncio for LLM calls to improve throughput.
- **Plugin system:** Load analysts and exporters as plugins.

---

## Execution Order

1. **Phase 1** (1–2 days): Consolidation, API wiring, docs. **Deliverable:** Single entry point, working /api/v1, no legacy confusion.
2. **Phase 2** (1–2 days): Feedback store, suggestor, optional anomaly. **Deliverable:** Demonstrable "improvement loop" and suggestions.
3. **Phase 3** (1 day): Integration tests, dashboard polish, demo script. **Deliverable:** Reliable, presentable PoC.

---

## Checklist Before Demo

- [ ] `datapilot audit` runs successfully on shopmesh_dbt
- [ ] `datapilot serve` starts dashboard; `/api/report`, `/api/graph`, `/api/v1/health` work
- [ ] Report includes suggestions (or at least recommended actions per finding)
- [ ] `datapilot feedback summarize` shows run history (if answer key used)
- [ ] README explains how to run and configure
- [ ] Demo script runs end-to-end without errors
