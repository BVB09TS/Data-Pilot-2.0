# DATAPILOT 2.0 — Production Readiness Task List

**Senior Engineering Audit — March 14, 2026**

> **Effort:** S = hours | M = 1–2 days | L = 3–5 days | XL = 1–2 weeks
>
> **Priority:** CRITICAL = ship blocker | HIGH = before beta | MEDIUM = before GA | LOW = nice-to-have
>
> **Total tasks: 55** — Critical: 10 | High: 21 | Medium: 17 | Low: 7

---

## 1. SECURITY — Fix Before Any Deployment

These are exploitable vulnerabilities. Nothing else matters until these are closed.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| S-1 | Add authentication to `/api/settings` POST endpoint | **CRITICAL** | M | ⏳ | Currently allows unauthenticated write to `.env` file — anyone can overwrite API keys remotely |
| S-2 | Replace CORS wildcard (`*`) with explicit origins | **CRITICAL** | S | ⏳ | `WebConfig.cors_origins` and `create_api_app` both default to `*` — any website can call your API |
| S-3 | Fail-closed on default `secret_key` | **CRITICAL** | S | ⏳ | Flask secret_key is `'change-me-in-production'` — refuse to start if unchanged |
| S-4 | Make keyvault refuse XOR fallback in production | **CRITICAL** | S | ⏳ | XOR "encryption" is trivially reversible — require `cryptography` package or fail to start |
| S-5 | Add rate limiting to all public API endpoints | **HIGH** | M | ⏳ | No rate limiting on `/api/chat`, `/api/settings`, `/api/v1/*` — wide open to abuse |
| S-6 | Add CSRF protection to state-changing endpoints | **HIGH** | M | ⏳ | POST endpoints accept requests without CSRF tokens |
| S-7 | Input validation and sanitization on all API inputs | **HIGH** | M | ⏳ | `request.get_json(silent=True)` used everywhere — no schema validation on payloads |
| S-8 | Remove `/api/settings/test-key` from production builds | **MEDIUM** | S | ⏳ | Endpoint lets anyone test arbitrary API keys against Groq/Anthropic/OpenAI |
| S-9 | Audit all file path operations for path traversal | **HIGH** | M | ⏳ | `_safe_resolve` exists in `api/routes.py` but `web/app.py` reads arbitrary paths |
| S-10 | Add security headers (CSP, X-Frame-Options, HSTS) | **MEDIUM** | S | ⏳ | No security headers on any response |

---

## 2. ARCHITECTURE — Cut the Fat, Focus the Product

You're building three products in one repo. Ship one sharp tool, not a dull Swiss army knife.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| A-1 | Extract or delete `datapilot/gateway/` module | **HIGH** | L | ⏳ | Full multi-tenant LLM proxy — separate product with its own attack surface. 6 files, ~500 LOC unrelated to dbt |
| A-2 | Delete all stub integration modules | **HIGH** | M | ⏳ | Airflow, Snowflake, Azure, AWS, GitLab, Kafka, PowerBI, K8s — none actually connect to anything |
| A-3 | Remove legacy `agent/` directory | **MEDIUM** | S | ⏳ | Duplicate parser, graph, reporter — drift risk. DATAPILOT_CONTEXT.md still points to it |
| A-4 | Clean up circular import: `graph.py` imports `github_actions.parser` | **MEDIUM** | S | ⏳ | Core module depending on integration module — invert the dependency |
| A-5 | Wire `/api/v1/audit/trigger` to actually run audits | **HIGH** | L | ⏳ | Returns 202 Accepted but does nothing — lying to consumers |
| A-6 | Delete `ai-governance/` sub-project or move to separate repo | **MEDIUM** | S | ⏳ | 487KB separate app in the same repo — confuses the codebase |
| A-7 | Update DATAPILOT_CONTEXT.md and README to match reality | **MEDIUM** | M | ⏳ | Context doc references legacy paths, outdated commands, and features that don't exist |
| A-8 | Trim `pyproject.toml` optional deps to things that work | **LOW** | S | ⏳ | Lists airflow, snowflake, kafka extras — none of which have working code |

---

## 3. CORE AGENT — Make It Work on Real Projects

The agents are hardcoded to ShopMesh. They need to be generic to deliver real value.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| C-1 | Remove hardcoded ShopMesh model names from `analyst.py` | **CRITICAL** | L | ⏳ | `analytics_churn_risk`, `src_orders_v2`, `src_shopify_orders` all hardcoded — won't work on any other project |
| C-2 | Make `duplicate_metrics` detection generic | **HIGH** | L | ⏳ | Currently only scans for `total_revenue` — needs to find ANY metric defined multiple ways |
| C-3 | Use sqlglot AST parsing instead of regex for SQL analysis | **HIGH** | XL | ⏳ | sqlglot is in requirements but unused — regex misses complex patterns, CTEs, subqueries |
| C-4 | Make `grain_joins` detection work without 'daily'/'monthly' in name | **HIGH** | L | ⏳ | Currently pattern-matches ref names — real projects don't name models this way |
| C-5 | Stop agents from rubber-stamping static analysis | **MEDIUM** | L | ⏳ | Agents ask LLM to "confirm" then backfill from static — LLM should discover, not confirm |
| C-6 | Add confidence scores to all findings | **MEDIUM** | M | ⏳ | No confidence levels — user can't tell high-certainty from speculative findings |
| C-7 | Handle malformed/incomplete dbt projects gracefully | **HIGH** | M | ⏳ | Parser crashes on missing files, bad YAML, non-standard layouts |
| C-8 | Support `manifest.json` as input (not just raw SQL files) | **HIGH** | L | ⏳ | Real dbt projects use compiled manifest — far richer metadata than raw parsing |
| C-9 | Add column-level lineage tracking | **MEDIUM** | XL | ⏳ | Needed for real grain-join detection and PII tracking — requires sqlglot AST walking |
| C-10 | Test against at least 3 real open-source dbt projects | **CRITICAL** | L | ⏳ | Only tested against ShopMesh (the project DataPilot itself created) |

---

## 4. TESTING — The Most Critical Path Is Untested

There are zero tests for the parser, graph builder, or end-to-end pipeline — the core value of the product.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| T-1 | Write unit tests for `parse_project()` | **CRITICAL** | M | ⏳ | Zero coverage on the parser — the first step of the entire pipeline |
| T-2 | Write unit tests for `build_graph()` and all `find_*` functions | **CRITICAL** | M | ⏳ | Graph building and static detection are completely untested |
| T-3 | Write integration test: parse → graph → pipeline → report | **CRITICAL** | L | ⏳ | End-to-end pipeline test against ShopMesh — `tests/integration/` is empty |
| T-4 | Add API endpoint tests (Flask test client) | **HIGH** | M | ⏳ | No tests for `/api/report`, `/api/findings`, `/api/chat`, `/api/settings` |
| T-5 | Add negative tests: bad input, missing files, invalid YAML | **HIGH** | M | ⏳ | Parser and graph assume well-formed input — need failure mode tests |
| T-6 | Set up CI pipeline (GitHub Actions) | **HIGH** | M | ⏳ | No CI at all — tests don't run automatically on push/PR |
| T-7 | Add test coverage reporting and enforce minimum threshold | **MEDIUM** | S | ⏳ | pytest-cov is in dev deps but no coverage config or enforcement |
| T-8 | Add frontend tests (at least smoke tests for key components) | **MEDIUM** | L | ⏳ | React frontend has zero tests |
| T-9 | Test LLM agent responses with mock/fixture responses | **MEDIUM** | M | ⏳ | Agent tests should work without live LLM API keys |

---

## 5. FRONTEND — Ship It or Cut It

React frontend exists but has never been built or tested against the actual backend.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| F-1 | Get frontend building (`npm run build` → `dist/`) | **CRITICAL** | M | ⏳ | `frontend/dist/` does not exist — `app.py` falls back to legacy static file |
| F-2 | Wire React Router for all pages in `App.tsx` | **HIGH** | M | ⏳ | Pages exist in `pages/` but no routing setup |
| F-3 | Connect chat panel to `/api/chat` backend | **HIGH** | M | ⏳ | Chat UI built but not wired to backend |
| F-4 | Fix lineage graph depth selector (backend filtering) | **MEDIUM** | M | ⏳ | UI built, backend depth filtering missing |
| F-5 | Link findings to models in lineage graph | **MEDIUM** | M | ⏳ | Clicking a finding should highlight the model in the graph |
| F-6 | Add frontend build step to CI | **HIGH** | S | ⏳ | Build should fail CI if frontend TypeScript has errors |
| F-7 | Remove or properly scope public marketing pages | **LOW** | S | ⏳ | Landing, pricing, community pages exist but are premature — focus on the dashboard |

---

## 6. DEVOPS & DEPLOYMENT

Docker is set up but CI, environment management, and deployment are missing.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| D-1 | Set up GitHub Actions CI (lint + test + build) | **HIGH** | M | ⏳ | No CI pipeline at all |
| D-2 | Add `.env.example` with all required environment variables | **MEDIUM** | S | ⏳ | No template — new devs have to read source code to find needed vars |
| D-3 | Fix Dockerfile: uses Python 3.12 but project says 3.13 | **LOW** | S | ⏳ | DATAPILOT_CONTEXT says Python 3.13 but Dockerfile uses 3.12-slim |
| D-4 | Add Docker Compose for full local dev (API + frontend + DB) | **MEDIUM** | M | ⏳ | `docker-compose.yml` exists but is minimal |
| D-5 | Add health check endpoint that verifies LLM connectivity | **MEDIUM** | S | ⏳ | Current `/health` just returns `{status: healthy}` regardless of actual state |
| D-6 | Add structured logging with request IDs for tracing | **LOW** | M | ⏳ | structlog is used but no request ID correlation |

---

## 7. DOCUMENTATION

Good internal docs exist but user-facing documentation is missing.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| DOC-1 | Write a real README with quickstart for new users | **HIGH** | M | ⏳ | Current README is sparse — no install instructions, no screenshots, no examples |
| DOC-2 | Document all API endpoints with request/response examples | **MEDIUM** | M | ⏳ | No API docs — users have to read Flask routes |
| DOC-3 | Add CONTRIBUTING.md for open source contributors | **LOW** | S | ⏳ | No contribution guide |
| DOC-4 | Create architecture diagram (actual, not aspirational) | **MEDIUM** | M | ⏳ | ARCHITECTURE.md describes target state, not current state |
| DOC-5 | Write configuration reference (`datapilot.yaml` options) | **MEDIUM** | S | ⏳ | `datapilot.example.yaml` exists but no docs explaining each option |

---

## 8. POST-MVP — After Core Is Solid

Only pursue these after Sections 1–7 are complete. These add real value but aren't ship-blockers.

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| P-1 | Best Practices Engine (user-defined rules YAML) | **HIGH** | XL | ⏳ | Biggest differentiator — teams define their own dbt standards and DataPilot enforces them |
| P-2 | GitLab/GitHub MR Review Bot | **HIGH** | XL | ⏳ | Auto-post findings as PR/MR comments on dbt changes |
| P-3 | dbt Cloud integration (pull `manifest.json` via API) | **HIGH** | L | ⏳ | First real integration — most dbt teams use dbt Cloud |
| P-4 | Snowflake query cost connector | **MEDIUM** | L | ⏳ | Replace fake cost data with real warehouse spend per model |
| P-5 | YAML documentation quality scorer | **MEDIUM** | L | ⏳ | Score models on description completeness, owners, tags |
| P-6 | Persistent graph database (KuzuDB or similar) | **MEDIUM** | XL | ⏳ | Cross-session lineage memory, impact analysis queries |
| P-7 | Refactoring Assistant (AI-suggested model splits) | **LOW** | XL | ⏳ | AI suggests how to break apart large models |
| P-8 | Multi-tenant SaaS mode with team workspaces | **LOW** | XL | ⏳ | Only after product-market fit — premature complexity otherwise |


