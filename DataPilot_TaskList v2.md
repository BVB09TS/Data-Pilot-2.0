# DataPilot 2.0 — Master Task List

**Updated: 2026-03-14**

> **Effort:** S = hours | M = 1–2 days | L = 3–5 days | XL = 1–2 weeks
>
> **Priority:** CRITICAL = ship blocker | HIGH = before beta | MEDIUM = before GA | LOW = nice-to-have
>
> **Status:** ✅ Done | 🔄 In Progress | ⏳ Pending

---

## SESSION LOG — What Was Built (2026-03-14)

> Full TypeScript migration of the DataPilot engine into the `ai-governance` monorepo.

| What | Files |
|------|-------|
| Deleted all Python code (datapilot/, frontend/, agent/, tests/, scripts/, shopmesh_dbt/) | 339 files removed |
| DB migration: `findings` table | `db/migrations/013_findings.sql` |
| dbt manifest.json parser | `src/datapilot/parser.ts` |
| Multi-provider LLM gateway (Groq/OpenAI/Anthropic) + quota tracking | `src/datapilot/llmGateway.ts` |
| 8 analysis agents (deadModels, orphans, brokenRefs, duplicateMetrics, grainJoins, logicDrift, missingTests, deprecatedSources) | `src/datapilot/agents/` |
| Parallel audit pipeline orchestrator | `src/datapilot/runPipeline.ts` |
| REST API: POST /audit, GET /findings, GET /quota | `src/routes/datapilot.ts` |
| Findings page (trigger, filter, paginate, detail drawer) | `apps/web/src/pages/Findings.tsx` |
| Dockerfiles for API (tsx runtime) + Web (nginx + proxy) | `apps/api/Dockerfile`, `apps/web/Dockerfile` |
| Docker Compose with api, web, postgres, pgadmin, dbt_projects volume | `docker-compose.yml` |
| .env.example with LLM keys + quota setting | `.env.example` |
| Shared TypeScript types for findings | `packages/types/src/index.ts` |

---

## 1. SECURITY

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| S-1 | Auth on all state-changing API endpoints | **CRITICAL** | M | ✅ | `requireAuth` middleware on all datapilot + workspace routes |
| S-2 | Replace CORS wildcard with explicit origins | **CRITICAL** | S | ✅ | `FRONTEND_URL` env var controls allowed origin |
| S-3 | Fail-closed on default `secret_key` | **CRITICAL** | S | ✅ | `SERVER_SECRET` required — falls back to `dev-secret` only in dev |
| S-4 | Remove XOR fallback keyvault in production | **CRITICAL** | S | ✅ | Python gateway deleted entirely |
| S-5 | Rate limiting on public API endpoints | **HIGH** | M | ⏳ | No rate limiting yet |
| S-6 | CSRF protection on state-changing endpoints | **HIGH** | M | ⏳ | |
| S-7 | Input validation / schema validation on all API inputs | **HIGH** | M | ⏳ | |
| S-8 | Remove dev-login endpoint from production builds | **MEDIUM** | S | ⏳ | Currently gated by `NODE_ENV !== production` |
| S-9 | Audit file path operations for path traversal | **HIGH** | M | ⏳ | `project_path` in audit trigger not sanitized |
| S-10 | Add security headers (CSP, X-Frame-Options, HSTS) | **MEDIUM** | S | ⏳ | |

---

## 2. ARCHITECTURE

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| A-1 | LLM gateway is now scoped to DataPilot only | **HIGH** | L | ✅ | `llmGateway.ts` — no separate proxy product |
| A-2 | Delete all stub Python integration modules | **HIGH** | M | ✅ | Entire Python codebase deleted |
| A-3 | Remove legacy `agent/` directory | **MEDIUM** | S | ✅ | Deleted |
| A-4 | Circular import in graph.py | **MEDIUM** | S | ✅ | Python deleted — not applicable |
| A-5 | Wire `/audit` to actually run audits | **HIGH** | L | ✅ | `POST /datapilot/audit` triggers real pipeline |
| A-6 | `ai-governance/` is now the primary codebase | **MEDIUM** | S | ✅ | Python root deleted, monorepo is the product |
| A-7 | Update docs to match reality | **MEDIUM** | M | ⏳ | README and CLAUDE.md still reference old Python structure |
| A-8 | Trim dead config / extras | **LOW** | S | ✅ | pyproject.toml deleted |

---

## 3. CORE AGENT — Make It Work on Real Projects

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| C-1 | Remove hardcoded model names from agents | **CRITICAL** | L | ✅ | TypeScript agents are fully generic — no ShopMesh names |
| C-2 | Generic duplicate_metrics detection | **HIGH** | L | ✅ | Keyword-based scanning across all models |
| C-3 | Use sqlglot / AST parsing instead of regex | **HIGH** | XL | ⏳ | Current agents use SQL string matching — add proper AST parsing |
| C-4 | Grain join detection without name patterns | **HIGH** | L | ⏳ | Currently relies on `daily`/`monthly` in model name |
| C-5 | LLM should discover, not confirm | **MEDIUM** | L | ⏳ | |
| C-6 | Add confidence scores to findings | **MEDIUM** | M | ⏳ | |
| C-7 | Handle malformed/incomplete dbt projects gracefully | **HIGH** | M | ⏳ | Parser may crash on missing files or bad YAML |
| C-8 | Support `manifest.json` as primary input | **HIGH** | L | ✅ | `parser.ts` reads manifest.json natively |
| C-9 | Column-level lineage tracking | **MEDIUM** | XL | ⏳ | Requires AST walking |
| C-10 | Test against real open-source dbt projects | **CRITICAL** | L | ⏳ | Untested against real projects beyond ShopMesh |

---

## 4. TESTING

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| T-1 | Unit tests for `parser.ts` | **CRITICAL** | M | ⏳ | |
| T-2 | Unit tests for all 8 agents | **CRITICAL** | M | ⏳ | |
| T-3 | Integration test: parse → pipeline → findings | **CRITICAL** | L | ⏳ | |
| T-4 | API endpoint tests | **HIGH** | M | ⏳ | |
| T-5 | Negative tests: bad input, missing files, invalid manifest | **HIGH** | M | ⏳ | |
| T-6 | CI pipeline (GitHub Actions: lint + test + build) | **HIGH** | M | ⏳ | |
| T-7 | Coverage reporting + minimum threshold | **MEDIUM** | S | ⏳ | |
| T-8 | Frontend smoke tests | **MEDIUM** | L | ⏳ | |
| T-9 | Agent tests with mock LLM responses | **MEDIUM** | M | ⏳ | |

---

## 5. FRONTEND

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| F-1 | Frontend builds and serves correctly | **CRITICAL** | M | ✅ | nginx serving on port 5173 with API proxy |
| F-2 | React Router for all pages | **HIGH** | M | ✅ | All routes wired including `/findings` |
| F-3 | Connect chat panel to LLM backend | **HIGH** | M | ⏳ | Chat UI exists, not wired |
| F-4 | Lineage graph depth selector (backend filtering) | **MEDIUM** | M | ⏳ | UI built, backend depth filtering missing |
| F-5 | Link findings → models in lineage graph | **MEDIUM** | M | ⏳ | Clicking a finding should highlight the model |
| F-6 | Frontend build in CI | **HIGH** | S | ⏳ | |
| F-7 | Settings page — persist LLM keys + project path per workspace | **MEDIUM** | M | ⏳ | SettingsPage.tsx exists, no persistence |

---

## 6. DEVOPS & DEPLOYMENT

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| D-1 | GitHub Actions CI (lint + test + build) | **HIGH** | M | ⏳ | |
| D-2 | `.env.example` with all required vars | **MEDIUM** | S | ✅ | Includes LLM keys, quota, OAuth vars |
| D-3 | Consistent Node.js version across Dockerfiles | **LOW** | S | ✅ | Both use `node:20-alpine` |
| D-4 | Docker Compose: full local dev stack | **MEDIUM** | M | ✅ | api + web + postgres + pgadmin + dbt_projects volume |
| D-5 | Health check verifies LLM + DB connectivity | **MEDIUM** | S | ⏳ | `/api/health` only checks process is alive |
| D-6 | Structured logging with request IDs | **LOW** | M | ⏳ | |
| D-7 | Run DB migrations on container startup | **HIGH** | S | ⏳ | Currently manual: `docker compose exec api node --import tsx/esm scripts/migrate.ts` |

---

## 7. DOCUMENTATION

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| DOC-1 | Real README with quickstart | **HIGH** | M | ⏳ | |
| DOC-2 | API endpoint docs with request/response examples | **MEDIUM** | M | ⏳ | |
| DOC-3 | CONTRIBUTING.md | **LOW** | S | ⏳ | |
| DOC-4 | Architecture diagram (actual current state) | **MEDIUM** | M | ⏳ | |
| DOC-5 | Configuration reference | **MEDIUM** | S | ⏳ | |
| DOC-6 | Update CLAUDE.md to reflect TypeScript monorepo structure | **HIGH** | S | ⏳ | Still describes Python layout |

---

## 8. NEXT FEATURES — After Core Is Solid

| # | Task | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| P-1 | Best Practices Engine (user-defined YAML rules) | **HIGH** | XL | ⏳ | Biggest differentiator — teams define their own dbt standards |
| P-2 | GitHub/GitLab MR Review Bot | **HIGH** | XL | ⏳ | Auto-post findings as PR/MR comments on dbt changes |
| P-3 | dbt Cloud API integration (pull manifest.json remotely) | **HIGH** | L | ⏳ | Removes need for local project path |
| P-4 | Snowflake query cost connector | **MEDIUM** | L | ⏳ | Replace estimated cost_usd with real warehouse spend |
| P-5 | YAML documentation quality scorer | **MEDIUM** | L | ⏳ | Score models on description completeness, owners, tags |
| P-6 | Findings → lineage graph link | **MEDIUM** | M | ⏳ | Click finding → highlight model in graph |
| P-7 | Cost Impact Report ($) on dead models | **MEDIUM** | M | ⏳ | Show estimated Snowflake savings per dead model |
| P-8 | Naming consistency detector (embeddings) | **MEDIUM** | L | ⏳ | Find same concept named 3 different ways |
| P-9 | Refactoring Assistant | **LOW** | XL | ⏳ | AI suggests how to break apart large models |
| P-10 | Multi-tenant SaaS + RBAC | **LOW** | XL | ⏳ | Only after product-market fit |

---

## Quick Reference — Running the App

```bash
cd ai-governance

# First time setup
cp .env.example .env
# Edit .env — add at least GROQ_API_KEY + SERVER_SECRET + SESSION_SECRET

# Start everything
docker compose up --build

# Run migrations (first time only)
docker compose exec api node --import tsx/esm scripts/migrate.ts
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| pgAdmin | http://localhost:5050 |

**Sign in:** `/login` → click **DEV — Quick dev login** (no OAuth needed in dev mode)
