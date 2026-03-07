# DataPilot

AI-powered dbt project auditor with multi-agent intelligence and enterprise integrations. Scans dbt projects, builds lineage graphs, and uses LLMs to detect data quality problems — dead models, broken lineage, duplicate metrics, orphaned models, deprecated sources, and more.

---

## Quick Start

### 1. Install

```bash
pip install -e .
# Or: pip install -e ".[dev]"  # for tests, linting
```

### 2. Configure

Create a `.env` file with your LLM API key:

```
GROQ_API_KEY=your_key_here
```

Get a free key at [console.groq.com](https://console.groq.com).

### 3. Run Audit

```bash
# Audit the default project (shopmesh_dbt)
datapilot audit

# Audit a specific dbt project
datapilot audit --project ./my_dbt_project --output ./reports

# Audit and start the web dashboard
datapilot audit --project ./shopmesh_dbt --serve --port 5000
```

### 4. Serve Dashboard

```bash
# Serve the dashboard (uses existing report/graph files)
datapilot serve --report ./output/datapilot_report.json --graph ./output/datapilot_graph.json --port 5000
```

Open http://localhost:5000 for the interactive lineage graph and findings.

---

## Commands

| Command | Description |
|---------|-------------|
| `datapilot audit` | Run full dbt project audit (parse, graph, AI analysis, report) |
| `datapilot serve` | Start web dashboard |
| `datapilot integrations` | List and check enterprise integrations |
| `datapilot generate-dag` | Generate Airflow DAG for scheduled audits |
| `datapilot generate-k8s` | Generate Kubernetes manifests |
| `datapilot init-config` | Create example `datapilot.yaml` |

---

## API

When the dashboard is running, the following endpoints are available:

- **Dashboard:** `GET /` — Interactive UI
- **Report:** `GET /api/report` — Full audit report (JSON)
- **Graph:** `GET /api/graph` — Lineage graph (JSON)
- **Findings:** `GET /api/findings` — Filtered findings
- **Health:** `GET /api/health` — Service health
- **API v1:** `GET /api/v1/health`, `GET /api/v1/report`, `POST /api/v1/audit/trigger`, `GET /api/v1/metrics`, `GET /api/v1/integrations`

---

## Configuration

Use `datapilot.yaml` for project-level config:

```yaml
project_root: ./shopmesh_dbt
output_dir: ./output
llm_providers:
  - provider: groq
    model: llama-3.3-70b-versatile
    api_key_env: GROQ_API_KEY
    tier: free
```

Run `datapilot init-config` to generate an example config.

---

## ShopMesh (Sample Project)

The `shopmesh_dbt/` folder contains a synthetic 4-layer dbt project for testing:

| Layer | Purpose |
|-------|---------|
| raw/ | Receive JSON from source systems |
| source/ | Light transforms: rename, cast, clean |
| core/ | Business logic, joins, calculations |
| analytics/ | Business-ready BI tables |

```bash
cd shopmesh_dbt
dbt deps && dbt seed && dbt run && dbt test
```

---

## Documentation

- [docs/PLATFORM_DESIGN.md](docs/PLATFORM_DESIGN.md) — Platform vision, architecture, PoC scope
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design and evolution
- [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) — Refactoring phases
- [DATAPILOT_CONTEXT.md](DATAPILOT_CONTEXT.md) — Full project context for AI assistants

---

## License

MIT
