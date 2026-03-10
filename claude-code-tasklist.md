# AI Platform — Claude Code Build Instructions

> You are a Senior Full-Stack Engineer. Build this AI governance platform step by step.
> Stack: Node.js + TypeScript (backend), React + TypeScript + TailwindCSS (frontend), PostgreSQL (database).
> Follow this task list in order. Complete each phase before starting the next.

---

## PHASE 1 — Project Scaffolding

**Task 1.1 — Monorepo setup**
- Create a monorepo with two packages: `apps/api` (Node.js/TypeScript) and `apps/web` (React/TypeScript/Vite)
- Add shared `packages/types` for shared TypeScript interfaces
- Configure `tsconfig`, `eslint`, `prettier` at root level

**Task 1.2 — Database setup**
- Configure PostgreSQL connection using `pg` + `node-postgres`
- Add `dotenv` for environment variables
- Create a `db/migrate.ts` script that runs SQL migration files in order
- Add `db/seed.ts` for development seed data

---

## PHASE 2 — Core Database Schema

**Task 2.1 — Run these migrations in order:**

```sql
-- 001_users.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL, -- 'github' | 'google' | 'gitlab'
  provider_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 002_workspaces.sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 003_workspace_members.sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'owner' | 'admin' | 'developer' | 'viewer'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 004_environments.sql
CREATE TABLE environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'dev' | 'staging' | 'prod'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 005_connections.sql
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES environments(id),
  type TEXT NOT NULL, -- 'api' | 'mcp'
  provider TEXT,      -- 'openai' | 'anthropic' | 'custom' etc.
  name TEXT NOT NULL,
  encrypted_secret TEXT,
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown', -- 'healthy' | 'degraded' | 'down' | 'unknown'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 006_nodes.sql
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'workflow' | 'source' | 'adapter' | 'output'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 007_edges.sql
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_node_id, target_node_id)
);

-- 008_runs.sql
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES environments(id),
  node_id UUID REFERENCES nodes(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'success' | 'failed'
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  logs JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 009_sessions.sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## PHASE 3 — Authentication System

**Task 3.1 — OAuth2 backend (GitHub first, then Google)**
- Install: `passport`, `passport-github2`, `passport-google-oauth20`, `express-session`
- Create `src/auth/github.strategy.ts` and `src/auth/google.strategy.ts`
- On successful OAuth callback:
  - Upsert user in `users` table
  - Create or assign default workspace
  - Create session token (JWT or opaque)
  - Return session cookie

**Task 3.2 — Auth API endpoints**
```
GET  /auth/github          → redirect to GitHub OAuth
GET  /auth/github/callback → handle callback, set cookie, redirect to /dashboard
GET  /auth/google          → redirect to Google OAuth
GET  /auth/google/callback → handle callback, set cookie, redirect to /dashboard
POST /auth/logout          → clear session
GET  /auth/me              → return current user + workspace memberships
```

**Task 3.3 — Auth middleware**
- Create `requireAuth` middleware that validates session token
- Attach `req.user` and `req.workspaceId` to every authenticated request
- Return 401 if unauthenticated

---

## PHASE 4 — Connections API

**Task 4.1 — Secret encryption utility**
- Create `src/utils/crypto.ts`
- Implement `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string`
- Use AES-256-GCM with `SERVER_SECRET` env variable as key
- Never log or return raw secrets

**Task 4.2 — Connections API endpoints**
```
GET    /api/workspaces/:workspaceId/connections           → list all connections
POST   /api/workspaces/:workspaceId/connections           → create connection (encrypt secret)
GET    /api/workspaces/:workspaceId/connections/:id       → get single (never return secret)
PATCH  /api/workspaces/:workspaceId/connections/:id       → update (re-encrypt if secret changes)
DELETE /api/workspaces/:workspaceId/connections/:id       → delete
POST   /api/workspaces/:workspaceId/connections/:id/ping  → test connection health, update status
```

**Task 4.3 — Health check service**
- Create `src/services/healthCheck.ts`
- For `type: 'api'`: make a lightweight test call to the provider
- For `type: 'mcp'`: ping the MCP server endpoint
- Update `health_status` and `last_health_check` in DB

---

## PHASE 5 — Lineage / DAG System

**Task 5.1 — Nodes & Edges API**
```
GET    /api/workspaces/:workspaceId/nodes          → list nodes
POST   /api/workspaces/:workspaceId/nodes          → create node
PATCH  /api/workspaces/:workspaceId/nodes/:id      → update node
DELETE /api/workspaces/:workspaceId/nodes/:id      → delete node (cascade edges)

GET    /api/workspaces/:workspaceId/edges          → list edges
POST   /api/workspaces/:workspaceId/edges          → create edge (validates no cycles)
DELETE /api/workspaces/:workspaceId/edges/:id      → delete edge
```

**Task 5.2 — Lineage graph endpoint**
```
GET /api/workspaces/:workspaceId/lineage
```
Returns:
```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": { "nodeCount": 12, "edgeCount": 15, "generatedAt": "..." }
}
```

**Task 5.3 — Cycle detection**
- Before inserting an edge, run a DFS cycle check
- Return 400 with a clear error if the new edge would create a cycle

**Task 5.4 — Manifest export**
```
GET /api/workspaces/:workspaceId/manifest
```
Returns a JSON manifest (dbt-style) describing all nodes, edges, and metadata for the workspace. This is the source of truth for the whole graph.

---

## PHASE 6 — Runs API

**Task 6.1 — Runs endpoints**
```
GET  /api/workspaces/:workspaceId/runs             → list runs (paginated)
GET  /api/workspaces/:workspaceId/runs/:id         → get single run with logs
POST /api/workspaces/:workspaceId/runs             → trigger a new run
```

---

## PHASE 7 — Frontend: App Shell

**Task 7.1 — Routing setup**
- Install `react-router-dom`
- Define routes:
  - `/login` → LoginPage
  - `/dashboard` → DashboardPage (protected)
  - `/lineage` → LineagePage (protected)
  - `/connections` → ConnectionsPage (protected)
  - `/connections/new` → NewConnectionPage (protected)
  - `/nodes/:nodeId` → NodeDocPage (protected)
  - `/runs` → RunsPage (protected)
  - `/settings` → SettingsPage (protected)

**Task 7.2 — Auth context**
- Create `src/contexts/AuthContext.tsx`
- On mount, call `GET /auth/me` to hydrate user + workspace
- Provide `user`, `workspace`, `isLoading`, `logout()` to the whole app
- Create `<ProtectedRoute>` component that redirects to `/login` if unauthenticated

**Task 7.3 — Sidebar layout**
- Create `<AppLayout>` component with:
  - Left sidebar with nav links: Dashboard, Lineage, Connections, Runs, Settings
  - Workspace name at top
  - User avatar + logout at bottom
  - Main content area on the right

---

## PHASE 8 — Frontend: Login Page

**Task 8.1 — LoginPage**
- Clean centered card layout
- App name/logo at top
- "Continue with GitHub" button → links to `GET /auth/github`
- "Continue with Google" button → links to `GET /auth/google`
- No password fields
- No form submission — pure OAuth redirects

---

## PHASE 9 — Frontend: Connections Page

**Task 9.1 — ConnectionsPage**
- Two tabs: "API Keys" and "MCP Servers"
- Each tab shows a list of existing connections with:
  - Name, provider, environment, health status badge (green/yellow/red)
  - Enable/disable toggle
  - Edit and Delete buttons
- "Add Connection" button opens a modal

**Task 9.2 — Add/Edit Connection Modal**
- For API type: fields for Name, Provider (dropdown), API Key (password input), Default Model, Environment, Token Limit
- For MCP type: fields for Name, Server URL, Auth Token, Environment
- On submit: POST to connections API
- Health check runs automatically after creation

---

## PHASE 10 — Frontend: Lineage Page

**Task 10.1 — LineagePage setup**
- Install: `reactflow`, `dagre`
- Fetch `/api/workspaces/:id/lineage` on mount
- Pass nodes and edges to React Flow

**Task 10.2 — DAG layout**
- Use `dagre` to compute automatic top-down layout positions for all nodes
- Apply positions to React Flow nodes before rendering

**Task 10.3 — Custom node types**
Create custom React Flow node components for each type:
- `WorkflowNode` — blue, shows name + description
- `SourceNode` — green, shows provider icon
- `AdapterNode` — orange, shows connection name
- `OutputNode` — purple, shows output label

**Task 10.4 — Node interactions**
- Clicking a node opens a right-side panel with:
  - Node name, type, description
  - Upstream dependencies list
  - Downstream dependents list
  - "View full docs" link → navigates to `/nodes/:nodeId`
- Hovering a node highlights its direct edges
- Minimap in bottom-right corner
- Zoom controls in bottom-left

---

## PHASE 11 — Frontend: Node Documentation Page

**Task 11.1 — NodeDocPage (dbt-style)**

Layout:
- Left sidebar: linked list of all nodes in workspace (searchable)
- Main content area:
  - Node name as H1
  - Type badge
  - Description (rendered as markdown)
  - Metadata table (key/value pairs from `metadata` JSON)
  - "Depends on" section: list of upstream node links
  - "Used by" section: list of downstream node links
  - "Recent Runs" table: last 10 runs with status, timestamp, duration

---

## PHASE 12 — Frontend: Runs Page

**Task 12.1 — RunsPage**
- Table of all runs across workspace
- Columns: Node, Environment, Status (badge), Started, Duration
- Click a run → expand to show logs
- Status filter: All / Success / Failed / Running

---

## PHASE 13 — Polish & Production Readiness

**Task 13.1 — Error handling**
- Global error boundary in React
- API returns consistent error shape: `{ error: string, code: string }`
- Toast notifications for success/failure on mutations

**Task 13.2 — Environment variables**
Document all required env vars in a `.env.example` file:
```
DATABASE_URL=
SERVER_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=
FRONTEND_URL=
PORT=
```

**Task 13.3 — Docker setup**
- `Dockerfile` for the API
- `docker-compose.yml` with api + postgres services
- Health check on postgres before API starts

**Task 13.4 — README**
- Setup instructions
- How to run migrations
- How to add a new OAuth provider
- How to add a new node type

---

## Key Principles (Do Not Deviate)

1. **Workspace is the center of gravity** — every resource belongs to a workspace
2. **Never store plaintext secrets** — always encrypt before writing to DB, decrypt only when executing
3. **Never return secrets from the API** — redact or omit encrypted_secret in all GET responses
4. **DAG must be acyclic** — validate on every edge insertion
5. **All routes are multi-tenant** — always scope queries by `workspace_id`
6. **No passwords** — OAuth only
