# DataPilot — Project Context & Master Plan

> **How to use this file:** Paste it at the start of any AI conversation to instantly restore full project context. Last updated: 2026-03-01.

---

## 1. What Is DataPilot?

DataPilot is an AI-powered dbt project auditing agent. It automatically scans a dbt project, builds a lineage graph, and uses an LLM to detect data quality problems — dead models, broken lineage, duplicate metrics, wrong grain joins, orphaned models, deprecated source chains, and missing tests.

**The end goal:** A tool that a data team can point at any dbt project and get a prioritised report of problems, wasted compute spend, and risks — in minutes, not weeks.

---

## 2. Project Location & How to Run

**Run all commands from the project root:**

```bash
# Run a full audit (parses dbt project, runs AI agents, generates report)
datapilot audit

# Run audit on a specific project, then serve the dashboard
datapilot audit --project ./shopmesh_dbt --output ./output --serve

# Serve the dashboard only (uses existing report/graph files)
datapilot serve --report ./output/datapilot_report.json --graph ./output/datapilot_graph.json
```

**Legacy (deprecated):** `py agent/datapilot.py` — use `datapilot audit` instead.

---

## 3. Tech Stack

| Component | Tool | Notes |
|-----------|------|-------|
| Language | Python 3.13 | Use `py` not `python` on this machine |
| dbt adapter | dbt-duckdb | Local DuckDB file |
| Database | DuckDB | File: `shopmesh_dbt/shopmesh.duckdb` |
| LLM | Groq API | Model: `llama-3.3-70b-versatile` (free tier) |
| Graph engine | NetworkX | Lineage DAG analysis |
| Graph DB | KuzuDB | Persistent graph storage (Phase 3+) |
| SQL parsing | sqlglot | SQL AST analysis |
| Config | python-dotenv | `.env` file for secrets |
| Terminal | PowerShell | Windows 11 |
| Editor | VS Code | |

**API Key:** Groq (`GROQ_API_KEY`) stored in `.env`
**Get Groq key at:** console.groq.com → free, no credit card

---

## 4. Full Folder Structure

```
datapilot/
├── .env                          ← GROQ_API_KEY here
├── requirements.txt
├── README.md
├── datapilot_report.json         ← generated after each run
│
├── datapilot/                    ← Main package (canonical)
│   ├── cli.py                    ← Entry: datapilot audit | serve | integrations
│   ├── core/                     ← parser, graph, pipeline, reporter, config
│   ├── agents/                   ← router, analyst (multi-LLM)
│   ├── api/                      ← REST /api/v1 (health, report, trigger, metrics)
│   ├── web/                      ← Dashboard (Flask + D3 lineage)
│   ├── exporters/                 ← JSON, CSV, SARIF, HTML, Jira, etc.
│   └── integrations/             ← Airflow, Snowflake, Azure, AWS, GitLab, etc.
│
├── agent/                        ← DEPRECATED — use datapilot audit
│   └── datapilot.py              ← Legacy entry (prints deprecation warning)
│
├── scripts/
│   ├── answer_key.py             ← ground truth: 28 planted problems
│   └── validate_env.py           ← 9-check environment validator
│
└── shopmesh_dbt/                 ← The synthetic dbt project
    ├── dbt_project.yml
    ├── profiles.yml              ← DuckDB connection
    ├── packages.yml
    ├── query_history.json        ← 180 days of fake usage data
    │
    ├── models/
    │   ├── raw/          (24 models)   expose JSON from source systems
    │   ├── source/       (24 models)   light transforms: rename, cast, clean
    │   ├── core/         (25 models)   all business logic, joins, calculations
    │   └── analytics/    (27 models)   business-ready BI tables
    │
    ├── macros/
    │   ├── safe_divide.sql
    │   ├── cents_to_dollars.sql
    │   ├── is_valid_email.sql
    │   ├── surrogate_key.sql
    │   ├── union_relations.sql
    │   ├── generate_schema_name.sql
    │   └── not_null_proportion.sql
    │
    └── seeds/
        ├── currency_rates.csv
        ├── plan_definitions.csv
        ├── product_categories.csv
        └── market_regions.csv
```

**Total: 98 SQL models, 98 YML files (one per model)**

---

## 5. The ShopMesh Synthetic Project

ShopMesh is a fake e-commerce company built to test DataPilot. It has 8 source systems:

| Source | What it contains |
|--------|-----------------|
| Shopify | Orders, customers, products, variants, refunds |
| Stripe | Payments, refunds, subscriptions |
| Google Ads | Campaigns, daily performance |
| Salesforce | Accounts, contacts, opportunities |
| Mobile App | Events (clickstream) |
| Email Tool | Campaigns, engagement events |
| Web Analytics | Sessions |
| Warehouse Ops | Daily inventory snapshots |
| Legacy ERP | **DEPRECATED** — decommissioned 2024-01-01 |

### SQL Conventions
- **Leading comma CTE style** throughout:
```sql
with

orders as (
    select * from {{ ref('src_shopify_orders') }}
)

, payments as (
    select * from {{ ref('src_stripe_payments') }}
)
```
- Each model has its own `.yml` file (not a shared schema.yml)
- Macros used for safe_divide, cents_to_dollars, surrogate_key

---

## 6. The 28 Planted Problems (Answer Key)

These are hidden defects in the ShopMesh project. DataPilot must find them.
**Pass threshold: 70% = 20 problems found.**

### Dead Models (7) — $170/month wasted
| Model | Last Queried | Cost |
|-------|-------------|------|
| analytics_seller_dashboard_v1 | 2023-10-03 | $22/mo |
| analytics_seller_dashboard_v2 | never | $22/mo |
| analytics_legacy_kpis | 2023-12-15 | $15/mo |
| analytics_cac_analysis | 2023-09-22 | $18/mo |
| analytics_inventory_legacy | 2024-04-01 | $31/mo |
| analytics_churn_risk | 2024-02-10 | $28/mo |
| core_inventory_legacy | 2024-12-15 | $12/mo |

### Broken Lineage (2)
- `core_seller_metrics` → refs `src_shopify_sellers` which **does not exist**
- `src_shopify_gift_cards_v2` → refs `raw_shopify_gift_cards` → refs `shopify.gift_cards` source **never configured**

### Logic Drift / Duplicate (1)
- `src_orders_v2` — duplicate of `src_shopify_orders` with different column names (`ordered_at` vs `order_created_at`, `order_value` vs `order_total_amount`)

### Deprecated Source Chains (3)
- `src_erp_products` → uses `legacy_erp` (decommissioned 2024-01-01)
- `src_erp_warehouses` → uses `legacy_erp` (decommissioned 2024-01-01)
- `analytics_inventory_legacy` → full chain: `analytics_inventory_legacy` → `core_inventory_legacy` → `src_erp_products` → `legacy_erp`

### Duplicate Metrics (2)
- `total_revenue` defined **4 different ways** across 4 models:
  - `core_revenue_summary`: net orders only (Finance)
  - `analytics_revenue_v1`: gross orders only (Marketing)
  - `analytics_revenue_v2`: gross + subs (inflated via grain bug)
  - `analytics_executive_kpis`: net + subscriptions (Executives)
- `analytics_churn_risk` — redundant with `analytics_customer_health.churn_status`

### Orphaned Models (6)
- `core_coupon_analysis` — Q2 2023 promo, no downstream
- `core_experimental_ltv` — hackathon, superseded by `core_customers.estimated_ltv`
- `raw_mobile_sessions` — superseded by deriving sessions from events
- `raw_shopify_gift_cards` — gift card feature paused
- `src_erp_products` — no downstream refs (only dead models use it)
- `src_erp_warehouses` — no downstream refs

### Wrong Grain Join (1)
- `core_revenue_combined` — joins **DAILY** (`core_revenue_daily`) to **MONTHLY** (`core_revenue_monthly`) by truncating date to month. Every daily row inherits full monthly MRR → inflates subscription_revenue ~30x. Cascades to `analytics_revenue_v2`.

### Missing Tests (4)
- `core_orders` — no uniqueness/not_null on `order_id` (412 queries/30d, most critical model)
- `analytics_revenue_v2` — no tests at all
- `core_customers` — missing uniqueness + relationship tests
- `core_revenue_summary` — missing uniqueness on `revenue_month` (allows duplicate grain)

---

## 7. The Agent — How It Works

```
py agent/datapilot.py
```

**5-step pipeline:**

```
[1/5] Parse project
      → parser.py reads all 98 SQL + YML files into structured dicts
      → extracts refs(), source(), column names, planted hints

[2/5] Build lineage graph
      → graph.py builds NetworkX DiGraph
      → nodes = models, edges = upstream → downstream
      → phantom nodes for broken refs

[3/5] Static analysis (no LLM)
      → find_dead_models()    — query_count_90d == 0
      → find_orphans()        — no downstream consumers
      → find_broken_refs()    — ref() points to missing model
      → find_deprecated_chains() — legacy_erp in SQL

[4/5] LLM analysis (Groq llama-3.3-70b)
      → 8 separate analysis passes, each returns JSON array
      → analyze_dead_models()
      → analyze_orphans()
      → analyze_broken_refs()
      → analyze_duplicate_metrics()
      → analyze_grain_joins()
      → analyze_deprecated_sources()
      → analyze_missing_tests()
      → analyze_logic_drift()

[5/5] Report + scoring
      → reporter.py builds structured report
      → scores against scripts/answer_key.py
      → saves datapilot_report.json
      → prints to console
```

---

## 8. Environment Setup

### First time setup (already done on this machine)
```bash
py -m pip install dbt-duckdb duckdb networkx pandas rich pyyaml python-dotenv kuzu sqlglot groq
```

### .env file (already configured)
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

### Validate environment
```bash
py scripts/validate_env.py
```
Expected: **9/9 passed**

### Run dbt (optional — not needed to run the agent)
```bash
cd shopmesh_dbt
dbt deps
dbt seed
dbt run
dbt test
```

---

## 9. The Full Phase Plan

### ✅ Phase 1 — Bootstrap & Project Setup (COMPLETE)
**Goal:** Build the synthetic dbt project that DataPilot will audit.

**Deliverables:**
- `bootstrap.py` — single-file generator that creates the entire project
- 98 SQL models across 4 layers (raw → source → core → analytics)
- 98 YML files with column docs and tests
- 7 macros, 4 seeds, full config files
- 28 planted problems hidden in the models
- `query_history.json` — 180 days of fake usage statistics
- `scripts/answer_key.py` — ground truth for scoring
- `scripts/validate_env.py` — 9-check environment validator
- All 9/9 environment checks passing

---

### 🔄 Phase 2 — The Core Agent (IN PROGRESS)
**Goal:** Build the AI agent that finds the 28 planted problems.

**Target:** Find 20+ of 28 problems (70% pass rate)

**Deliverables:**
- `agent/parser.py` — parse all dbt SQL + YML files ✅
- `agent/graph.py` — NetworkX lineage graph + static analysis ✅
- `agent/analyzer.py` — 8 Groq LLM analysis passes ✅
- `agent/reporter.py` — scoring + report generation ✅
- `agent/datapilot.py` — main orchestrator ✅

**Next steps in Phase 2:**
- Run `py agent/datapilot.py` and check the score
- Tune analyzer prompts if score < 70%
- Add confidence scores to findings
- Save full report to `datapilot_report.json`

---

### 📋 Phase 3 — Graph Database & Deep Lineage (PLANNED)
**Goal:** Replace in-memory NetworkX with persistent KuzuDB graph for richer analysis.

**Deliverables:**
- `agent/kuzu_store.py` — persist lineage graph to KuzuDB
- Cross-session lineage memory (run agent multiple times, it learns)
- Impact analysis: "if I delete model X, what breaks?"
- Column-level lineage tracking
- Multi-hop dependency chains

**Key features:**
- Store every model, column, and relationship as graph nodes/edges
- Query: "find all models downstream of deprecated sources"
- Query: "which columns flow from raw_shopify_orders to analytics_executive_kpis?"

---

### 📋 Phase 4 — Interactive CLI & Reporting (PLANNED)
**Goal:** Make DataPilot usable by non-technical data engineers.

**Deliverables:**
- Rich terminal UI with `rich` library
- Interactive problem explorer (navigate findings)
- HTML report export
- Slack/email notification support
- Priority scoring (cost × risk × usage)
- `--fix` mode: generate dbt deprecation PRs automatically

**CLI design:**
```bash
py datapilot.py --project ./shopmesh_dbt --output html
py datapilot.py --project ./shopmesh_dbt --fix dead_models
py datapilot.py --project ./shopmesh_dbt --notify slack
```

---

### 📋 Phase 5 — Multi-Project & Continuous Monitoring (PLANNED)
**Goal:** Run DataPilot continuously across multiple dbt projects.

**Deliverables:**
- Schedule agent to run daily/weekly
- Track problems over time (did we fix them?)
- Compare projects: "ShopMesh is healthier than ProjectX"
- REST API so other tools can query DataPilot results
- GitHub Actions integration — fail PRs that introduce problems
- Cost trend dashboard

---

### 📋 Phase 6 — SaaS / Product (FUTURE VISION)
**Goal:** Turn DataPilot into a product other teams can use.

**Deliverables:**
- Web UI (React frontend)
- Multi-tenant support
- Connect to real Snowflake/BigQuery/Databricks warehouses
- Real query history via warehouse connectors
- Team collaboration (assign problems, track resolution)
- Pricing: per-project or per-user SaaS

---

## 10. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM | Groq (free) → Anthropic (prod) | Free for POC, upgrade for accuracy |
| Database | DuckDB local file | Zero infrastructure, fast, portable |
| Graph | NetworkX in-memory | Simple for Phase 2, KuzuDB in Phase 3 |
| SQL style | Leading comma CTEs | User's team convention |
| One YML per model | Yes | Easier to diff, cleaner git history |
| Bootstrap approach | Single `bootstrap.py` | Easy to regenerate, portable |

---

## 11. Quick Commands Reference

```bash
# Run the agent
py agent/datapilot.py

# Validate environment
py scripts/validate_env.py

# Check answer key
py scripts/answer_key.py

# Regenerate the entire dbt project from scratch
py bootstrap.py

# Run dbt
cd shopmesh_dbt && dbt run

# Install all packages
py -m pip install dbt-duckdb duckdb networkx pandas rich pyyaml python-dotenv kuzu sqlglot groq
```

---

## 12. Known Issues & Notes

- **Python command:** Use `py` not `python` on this Windows machine
- **Groq rate limits:** Free tier has RPM limits — if agent fails mid-run, wait 60s and retry
- **98 models not 100:** Bootstrap generates 98 (close enough, threshold was 98+)
- **bootstrap.py is 6277 lines** — do not edit manually, edit `make_bootstrap.py` instead
- **DuckDB file:** `shopmesh_dbt/shopmesh.duckdb` is created when you run `dbt run`
- **answer_key.py has 28 problems** — scoring threshold is 70% = 20 found

---

## 13. Files To Never Delete

| File | Why |
|------|-----|
| `bootstrap.py` | Regenerates entire project |
| `scripts/answer_key.py` | Ground truth for scoring |
| `shopmesh_dbt/query_history.json` | Fake usage data (dead model detection) |
| `.env` | Your Groq API key |
| `agent/datapilot.py` | Main entry point |

---

*End of context document. Paste this at the top of any new conversation to resume the project.*
