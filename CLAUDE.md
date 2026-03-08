# CLAUDE.md — DataPilot 2.0

> AI assistant guide for the DataPilot 2.0 codebase. Read this before making changes.

---

## What Is DataPilot?

DataPilot 2.0 is an **AI-powered dbt project auditor**. It parses a dbt project, builds a lineage DAG, runs a set of deterministic + LLM-assisted analysis agents, and produces findings across multiple export formats. It ships with a web dashboard, a REST API, and enterprise integrations (Airflow, Snowflake, AWS, Azure, K8s, etc.).

The sample dbt project used for testing is called **ShopMesh** (`shopmesh_dbt/`). It is synthetic and contains 28 intentionally planted defects that DataPilot should detect.

---

## Repository Layout

```
Data-Pilot-2.0/
├── datapilot/                # Main Python package (v2.0.0)
│   ├── cli.py                # Click CLI: audit / serve / integrations / generate-*
│   ├── core/
│   │   ├── config.py         # Pydantic-based configuration (DataPilotConfig)
│   │   ├── parser.py         # dbt project parser (SQL + YAML + query_history.json)
│   │   ├── graph.py          # NetworkX lineage DAG + static analysis helpers
│   │   ├── pipeline.py       # AuditPipeline orchestrator (parallel execution)
│   │   ├── reporter.py       # Report builder (severity mapping, scoring)
│   │   └── feedback.py       # FeedbackStore (append-only run history)
│   ├── agents/
│   │   ├── router.py         # AgentRouter: task complexity → LLM tier selection
│   │   ├── analyst.py        # 8 specialist analysis agents + JSON parsing utils
│   │   ├── anomaly.py        # Rule-based anomaly detection (cost spikes, etc.)
│   │   └── suggestor.py      # Improvement suggestions from findings
│   ├── api/
│   │   └── routes.py         # Flask Blueprint /api/v1 (health, report, audit, metrics)
│   ├── web/
│   │   └── app.py            # Flask app factory; mounts API blueprint + static assets
│   ├── exporters/
│   │   └── formats.py        # JSON, CSV, SARIF, HTML, Jira, Airflow, Power BI export
│   └── integrations/
│       ├── base.py           # Abstract Integration + IntegrationRegistry
│       ├── airflow/          # Airflow DAG generation + REST API
│       ├── snowflake/        # Snowflake connector
│       ├── azure/            # Azure Storage + Identity
│       ├── aws/              # AWS S3 + Boto3
│       ├── gitlab/           # GitLab API
│       ├── kubernetes/       # K8s manifest generation
│       ├── dbt/              # dbt Cloud API
│       ├── docker/           # Docker registry
│       ├── messaging/        # Slack / email
│       ├── powerbi/          # Power BI datasets
│       └── github_actions/   # GitHub Actions + SARIF parsing
│
├── agent/                    # DEPRECATED v1 code — do not modify or import from here
│
├── shopmesh_dbt/             # Synthetic dbt project (test fixture)
│   ├── models/{raw,source,core,analytics}/  # 100 models total
│   ├── macros/               # Utility SQL macros
│   ├── seeds/                # CSV reference data
│   └── query_history.json    # 180-day synthetic query stats
│
├── tests/
│   ├── unit/                 # 11 test files with pytest
│   └── integration/          # Planned (currently empty)
│
├── scripts/
│   ├── answer_key.py         # Ground truth: 28 planted problems
│   └── validate_env.py       # 9-check environment validator
│
├── docs/
│   ├── ARCHITECTURE.md       # System design + future roadmap
│   ├── PLATFORM_DESIGN.md    # Product vision + stack rationale
│   └── REFACTORING_PLAN.md   # Multi-phase refactoring strategy
│
├── deploy/k8s/               # Kubernetes manifests (CronJob + Deployment + PVC)
├── bootstrap.py              # Regenerates entire ShopMesh dbt project
├── pyproject.toml            # Package metadata, extras, tool config
├── requirements.txt          # Core + legacy dependency pins
├── datapilot.example.yaml    # Full configuration reference
├── Dockerfile                # Multi-stage production image
├── docker-compose.yml        # Local dev (+ optional Redis profile)
├── .sqlfluff                 # SQL linting for shopmesh_dbt (DuckDB dialect)
├── .github/workflows/ci.yml  # GitHub Actions: lint → test → security → docker
└── .gitlab-ci.yml            # GitLab CI: lint → test → security → build → audit
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.10+ |
| Build | Hatchling (`pyproject.toml`) |
| Config | Pydantic v2 / pydantic-settings |
| CLI | Click 8+ |
| Web / API | Flask 3+ |
| dbt adapter | dbt-duckdb 1.8+ |
| Database | DuckDB (file-based, created on first `dbt run`) |
| Graph | NetworkX 3+ |
| SQL parsing | sqlglot 23+ |
| HTTP client | httpx 0.25+ |
| Templating | Jinja2 3.1+ |
| Logging | structlog 23+ |
| Retry | tenacity 8+ |
| Terminal UI | rich 13+ |
| LLM providers | groq, anthropic, openai |
| Linting | Ruff |
| Type checking | MyPy |
| Testing | pytest + pytest-asyncio + pytest-cov |

### Optional extras (installed via `pip install datapilot[<extra>]`)

`airflow`, `snowflake`, `azure`, `aws`, `dbt`, `kubernetes`, `powerbi`, `kafka`

---

## Development Setup

```bash
# 1. Create virtual environment
python -m venv .venv && source .venv/bin/activate

# 2. Install in editable mode with dev dependencies
pip install -e ".[dev]"

# 3. Copy example config and set LLM keys
cp datapilot.example.yaml datapilot.yaml
cp .env.example .env          # if exists, otherwise create .env manually

# 4. Validate environment
python scripts/validate_env.py

# 5. Run the full audit on the ShopMesh sample project
datapilot audit --project ./shopmesh_dbt --output ./output
```

### Required environment variables

```
GROQ_API_KEY=gsk_...           # Required (free tier, default LLM)
ANTHROPIC_API_KEY=sk-ant-...   # Optional (premium tier)
OPENAI_API_KEY=sk-...          # Optional (standard tier)
```

Place these in a `.env` file at the repo root (it is git-ignored).

---

## Running the Application

```bash
# Full audit + start web dashboard
datapilot audit --project ./shopmesh_dbt --output ./output --serve --port 5000

# Serve a previously generated report
datapilot serve --report ./output/datapilot_report.json

# Check integration health
datapilot integrations --check

# Generate Airflow DAG
datapilot generate-dag --schedule "0 6 * * *"

# Generate Kubernetes manifests
datapilot generate-k8s --image datapilot:2.0.0

# Run as a Python module
python -m datapilot audit --project ./shopmesh_dbt
```

### Docker / Docker Compose

```bash
# Local dev with Docker Compose
docker compose up

# With Redis caching enabled
docker compose --profile full up

# Build image manually
docker build -t datapilot:2.0.0 .
```

---

## Running Tests

```bash
# Run all unit tests
pytest tests/unit/ -v

# Run with coverage
pytest tests/ --cov=datapilot --cov-report=term-missing

# Run a specific test file
pytest tests/unit/test_analyst.py -v

# Validate against ground-truth answer key
python scripts/answer_key.py
```

**Pass threshold:** DataPilot must find ≥ 20 of 28 planted problems (70%) to pass validation.

---

## Linting and Type Checking

```bash
# Lint with Ruff
ruff check datapilot/
ruff format datapilot/

# Type check
mypy datapilot/

# SQL linting (shopmesh_dbt)
sqlfluff lint shopmesh_dbt/models/
```

CI runs `ruff check`, `ruff format --check`, and `mypy` on every push.

---

## Audit Pipeline — How It Works

```
parse_project()          # Read SQL + YAML + query_history.json
    ↓
build_graph()            # NetworkX DiGraph (nodes=models, edges=refs)
    ↓
static analysis          # find_dead_models / find_orphans / find_broken_refs
    ↓
LLM agents (parallel)    # 8 analyst agents refine and explain findings
    ↓
build_report()           # Aggregate, assign severity & recommendations
    ↓
export_all()             # JSON / CSV / SARIF / HTML / Jira / ...
    ↓
(optional) web dashboard # Flask + D3.js lineage graph
```

The pipeline is orchestrated by `AuditPipeline` in `datapilot/core/pipeline.py` using a `ThreadPoolExecutor` for parallel agent execution.

---

## LLM Routing (Multi-Provider)

`AgentRouter` in `datapilot/agents/router.py` maps each task type to a cost tier:

| Tier | Provider | Used For |
|------|---------|---------|
| `free` | Groq (Llama) | Simple tasks: `missing_tests`, `broken_refs` |
| `standard` | OpenAI GPT-4o-mini | Medium tasks: `dead_models`, `orphans` |
| `premium` | Anthropic Claude / GPT-4o | Complex tasks: `duplicate_metrics`, `grain_joins` |

Fallback chain: premium → standard → free if a key is missing. Routing is configurable in `datapilot.yaml` under `routing:`.

---

## Analysis Agents

All 8 agents live in `datapilot/agents/analyst.py`:

| Agent Function | Detects |
|----------------|---------|
| `analyze_dead_models` | Models with 0 queries in 90 days |
| `analyze_orphans` | Models with no downstream consumers |
| `analyze_broken_refs` | `ref()` calls pointing to non-existent models |
| `analyze_deprecated_sources` | Source chains feeding deprecated models |
| `analyze_duplicate_metrics` | Metrics computed multiple times with different logic |
| `analyze_grain_joins` | Joins across incompatible data grains |
| `analyze_logic_drift` | Business logic that diverged from source definitions |
| `analyze_missing_tests` | Models lacking dbt tests (not_null, unique, etc.) |

Each agent combines deterministic graph analysis with LLM reasoning. LLM output is always JSON — the `parse_json_response()` utility handles markdown-wrapped and partial JSON gracefully.

---

## Severity and Recommendations

`datapilot/core/reporter.py` maps finding types to severities:

| Finding Type | Severity |
|-------------|---------|
| `broken_lineage` | critical |
| `wrong_grain_join` | critical |
| `dead_model` | high |
| `orphaned_model` | medium |
| `missing_tests` | medium |
| `duplicate_metric` | high |
| `logic_drift` | medium |
| `deprecated_source` | low |

Each finding also includes a `recommended_action` string and `cost_usd` estimate.

---

## Export Formats

`datapilot/exporters/formats.py` writes the following files to `--output`:

| File | Format | Use Case |
|------|--------|---------|
| `datapilot_report.json` | JSON | Programmatic access, API responses |
| `datapilot_findings.csv` | CSV | Spreadsheet review |
| `datapilot_report.sarif` | SARIF 2.1.0 | GitHub / GitLab security scanning |
| `datapilot_report.html` | HTML | Standalone browser report |
| `jira_issues.json` | JSON (Jira) | Jira ticket creation |

---

## REST API Endpoints

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/report` | Serve latest audit report JSON |
| POST | `/audit/trigger` | Trigger a new audit run |
| GET | `/metrics` | Prometheus-style metrics |
| GET | `/integrations` | List integration health |

---

## Configuration Hierarchy

1. `datapilot.yaml` (highest priority, git-ignored in production)
2. Environment variables (`.env` loaded via `python-dotenv`)
3. Hardcoded defaults in `DataPilotConfig` (lowest priority)

Key config sections in `datapilot.example.yaml`:

- `project_root` / `output_dir` / `log_level`
- `llm_providers`: per-provider API key + model name
- `routing`: task-type → tier mapping
- `pipeline`: `max_workers`, retry logic, caching
- `integrations`: per-integration connection settings
- `web`: host, port, CORS origins

---

## ShopMesh Sample Project

`shopmesh_dbt/` is a fully synthetic e-commerce dbt project with four model layers:

| Layer | Count | Purpose |
|-------|-------|---------|
| `raw/` | 24 | JSON-sourced raw tables |
| `source/` | 24 | Light transforms on raw |
| `core/` | 25 | Business logic |
| `analytics/` | 27 | BI-ready aggregates |

The project uses **DuckDB** as its adapter (connection in `profiles.yml`). Run `dbt run` inside `shopmesh_dbt/` to materialize the database.

**28 planted problems** (ground truth in `scripts/answer_key.py`):

| Category | Count |
|----------|-------|
| Dead models (0 queries in 90d) | 7 |
| Broken lineage refs | 2 |
| Duplicate metrics | 1 |
| Deprecated source chains | 3 |
| Orphaned models | 6 |
| Wrong grain joins | 1 |
| Missing tests | 4 |

---

## Key Conventions

### Code Style
- **Linter:** Ruff (configured in `pyproject.toml`). Run `ruff check` before committing.
- **Formatter:** Ruff format (replaces Black). Run `ruff format` to auto-format.
- **Type hints:** Required on all public functions. MyPy must pass.
- **Logging:** Use `structlog` exclusively. Never use `print()` in library code.

### Imports
- Use absolute imports from the `datapilot` package root.
- Never import from `agent/` (deprecated v1).

```python
# Correct
from datapilot.core.config import DataPilotConfig
from datapilot.agents.router import AgentRouter

# Wrong — do not do this
from agent.datapilot import something
```

### LLM Calls
- All LLM calls go through `AgentRouter`. Do not instantiate provider clients directly in analyst code.
- Always handle LLM output as potentially malformed JSON — use `parse_json_response()` from `datapilot/agents/analyst.py`.
- Use `tenacity` for retry logic (already wired in the router).

### Configuration
- Add new config fields to `DataPilotConfig` in `datapilot/core/config.py` using Pydantic `Field`.
- Always provide a sensible default so the tool works without a `datapilot.yaml`.
- Document new fields in `datapilot.example.yaml`.

### Integrations
- New integrations must subclass `BaseIntegration` from `datapilot/integrations/base.py`.
- Register them in `IntegrationRegistry`.
- Place integration code in a new subdirectory under `datapilot/integrations/`.
- Gate optional dependencies with `try/except ImportError` — never hard-require optional extras.

### Tests
- All new logic requires a unit test in `tests/unit/`.
- Test file naming: `test_<module>.py`.
- Use `pytest.mark.asyncio` for async tests.
- Mock LLM provider calls — do not make live API calls in tests.

### Commit Messages
- Use imperative mood: "Add grain join detection agent", "Fix JSON parsing for partial LLM output".
- Reference the relevant module in the message when applicable.

---

## Deployment

### Kubernetes
Manifests live in `deploy/k8s/datapilot-deployment.yaml`:
- **CronJob** — runs `datapilot audit` daily at 06:00 UTC
- **Deployment** — serves the web dashboard continuously
- **PVC** — 1Gi persistent volume for output files
- **Secret** — holds LLM API keys

Update the image tag in the manifest when releasing a new version.

### Docker
```bash
docker build -t datapilot:2.0.0 .
docker run -p 5000:5000 \
  -e GROQ_API_KEY=$GROQ_API_KEY \
  -v $(pwd)/shopmesh_dbt:/app/shopmesh_dbt:ro \
  -v $(pwd)/output:/app/output \
  datapilot:2.0.0
```

---

## Files to Avoid Modifying

| File / Directory | Reason |
|-----------------|--------|
| `agent/` | Deprecated v1 code, kept for reference only |
| `bootstrap.py` | Auto-generated ShopMesh scaffold — re-run to regenerate |
| `shopmesh_dbt/` | Test fixture — changes break ground-truth scoring |
| `scripts/answer_key.py` | Ground truth — edit only when planted problems change |

---

## Further Reading

- `DATAPILOT_CONTEXT.md` — master context document (pipeline details, planted problems, roadmap)
- `docs/ARCHITECTURE.md` — layered architecture design and target state
- `docs/PLATFORM_DESIGN.md` — product vision, design principles
- `datapilot.example.yaml` — full configuration reference with inline comments
