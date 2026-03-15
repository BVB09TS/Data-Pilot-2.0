# DataPilot AI Governance Platform

An AI-powered dbt project auditing and governance platform. Parses dbt projects, builds lineage DAGs, runs deterministic + LLM-assisted analysis agents, and surfaces findings in a web dashboard.

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Audit Engine** | 8 analysis agents detect dead models, orphans, broken refs, duplicate metrics, grain joins, logic drift, missing tests, deprecated sources |
| **Lineage Graph** | Interactive ReactFlow DAG — click any model to see docs, SQL, columns, and upstream/downstream |
| **Findings** | Paginated findings table with severity + type filters; click a model name to jump to lineage |
| **AI Chat** | Floating chat panel grounded in your workspace's real findings and model data |
| **Policies** | Define governance rules; evaluate them against your dbt models |
| **PR Reviews** | Automated review comments via GitHub webhook integration |
| **Settings** | Per-workspace LLM API key management (Groq, OpenAI, Anthropic) + default project path |
| **Audit Log** | Immutable record of all workspace actions |

---

## Quick Start (Docker — recommended)

**Prerequisites:** Docker + Docker Compose, and at least one LLM API key.

```bash
# 1. Clone and enter the governance platform directory
git clone <repo-url>
cd Data-Pilot-2.0/ai-governance

# 2. Create .env from example
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set JWT_SECRET, DATABASE_URL, and at least GROQ_API_KEY

# 3. Start everything (Postgres + API + Web + pgAdmin)
docker compose up

# 4. Open the app
#   Web dashboard: http://localhost:5173
#   API:           http://localhost:3000
#   pgAdmin:       http://localhost:5050  (admin@admin.com / admin)
```

The API runs database migrations automatically on startup — no manual `db:migrate` step needed.

---

## Quick Start (Local Dev — no Docker)

**Prerequisites:** Node.js 20+, pnpm 8+, PostgreSQL 14+.

```bash
# 1. Install dependencies
cd ai-governance
pnpm install

# 2. Build shared types first
pnpm --filter @types/shared build

# 3. Create and configure the API .env
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/datapilot
JWT_SECRET=<generate: openssl rand -hex 32>
GROQ_API_KEY=gsk_...          # required — free at console.groq.com
OPENAI_API_KEY=sk-...         # optional
ANTHROPIC_API_KEY=sk-ant-...  # optional
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

```bash
# 4. Create the database
createdb datapilot

# 5. Start the API (auto-runs migrations on startup)
pnpm --filter @app/api dev    # → http://localhost:3000

# 6. Start the frontend (new terminal)
pnpm --filter @app/web dev    # → http://localhost:5173
```

---

## First Login

In development mode a **dev-login** shortcut is available:

1. Go to `http://localhost:5173/login`
2. Click **"Dev Login"** (only shown when `NODE_ENV=development`)
3. You're logged in as the seed developer user with a pre-created workspace

For production, configure one of the OAuth providers (GitHub, Google, GitLab) and set the corresponding client ID/secret in `.env`.

---

## Running an Audit

1. Navigate to **Findings** in the sidebar
2. Enter the **absolute path** to a dbt project in the "Run New Audit" box
   - Example: `/dbt_projects/my_project` (or `./shopmesh_dbt` from the repo root)
3. Click **Run Audit** — you'll get a run ID immediately
4. Click **Refresh** after a few seconds to see new findings appear
5. Click any finding row to see the full details drawer
6. Click a model name to jump to the **Lineage** graph for that model

> **Tip:** Set a default project path in **Settings** so you don't have to type it every time.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | 32-64 char random string for signing tokens |
| `GROQ_API_KEY` | ✅* | Groq API key (free tier, primary LLM) |
| `OPENAI_API_KEY` | ❌ | OpenAI key (standard tier) |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic key (premium tier — complex analysis) |
| `FRONTEND_URL` | ✅ | CORS origin, e.g. `http://localhost:5173` |
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | ❌ | API listen port (default: `3000`) |
| `DBT_PROJECTS_DIR` | ❌ | Restrict audit paths to this directory (production safety) |
| `LLM_QUOTA_USD_PER_HOUR` | ❌ | LLM cost cap per hour (default: `1.00`) |
| `GITHUB_CLIENT_ID/SECRET` | ❌ | GitHub OAuth |
| `GOOGLE_CLIENT_ID/SECRET` | ❌ | Google OAuth |
| `GITLAB_CLIENT_ID/SECRET` | ❌ | GitLab OAuth |

*At least one of `GROQ_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` is required for audit analysis.

---

## Project Structure

```
ai-governance/
├── apps/
│   ├── api/               # Express + PostgreSQL REST API (@app/api)
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point: migrations → server
│   │   │   ├── auth/              # OAuth strategies + dev-login
│   │   │   ├── db/                # Pool + migration runner
│   │   │   ├── middleware/        # Auth, rate-limit, CSRF, validate, logging
│   │   │   ├── routes/            # One file per resource
│   │   │   └── datapilot/         # Audit engine: parser, agents, pipeline, LLM
│   │   └── db/migrations/         # 015 SQL migration files (auto-applied)
│   └── web/               # React + Vite SPA (@app/web)
│       └── src/
│           ├── main.tsx           # React Router config
│           ├── components/        # Layout, ChatPanel
│           ├── contexts/          # AuthContext, ThemeContext
│           ├── lib/api.ts         # Typed axios client for all endpoints
│           └── pages/             # One file per page
├── packages/
│   └── shared/            # Shared TypeScript types (@types/shared)
├── docker-compose.yml     # Postgres + API + Web + pgAdmin
└── .github/workflows/ci.yml  # api-test → web-build → docker-build
```

---

## Running Tests

```bash
# API tests (vitest — mocks DB + LLM)
pnpm --filter @app/api test

# API tests with coverage report
pnpm --filter @app/api test -- --coverage

# Frontend smoke tests
pnpm --filter @app/web test:run
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| API runtime | Node.js 20 + TypeScript (tsx) |
| API framework | Express 4 |
| Database | PostgreSQL 16 (pg driver) |
| Auth | JWT cookie + OAuth (GitHub / Google / GitLab) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Graph | ReactFlow + dagre |
| LLM providers | Groq (Llama) · OpenAI · Anthropic Claude |
| Tests | vitest + jsdom + @testing-library/react |
| Package manager | pnpm workspaces |
| CI | GitHub Actions |

---

## Security Notes

- All state-mutating API requests require a valid JWT cookie **and** pass Origin/Referer CSRF validation
- API keys in workspace settings are stored as plain text in PostgreSQL and masked on all GET responses (shows last 4 chars only) — use PostgreSQL TDE or pgcrypto for encryption at rest in production
- The `DBT_PROJECTS_DIR` env var restricts which filesystem paths the audit engine can access (path traversal prevention)
- Rate limiting: 20 req/min on auth endpoints, 200 req/min on API endpoints
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, HSTS (production), CSP (production)
