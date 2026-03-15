# DataPilot API Reference

Base URL: `http://localhost:3000`

All workspace endpoints require authentication. Include the `token` cookie (set automatically after login) on every request. All request and response bodies are JSON.

---

## Authentication

### Dev Login (development only)
```
POST /auth/dev-login
```
Creates or retrieves the dev seed user and returns a `token` cookie.

**Response `200`**
```json
{ "user": { "id": "...", "name": "Dev User", "email": "dev@localhost" } }
```

### GitHub OAuth
```
GET /auth/github          → redirects to GitHub
GET /auth/github/callback → sets token cookie, redirects to /dashboard
```

### Google OAuth
```
GET /auth/google
GET /auth/google/callback
```

### GitLab OAuth
```
GET /auth/gitlab
GET /auth/gitlab/callback
```

### Get Current User
```
GET /auth/me
```
**Response `200`**
```json
{ "id": "uuid", "name": "Alice", "email": "alice@example.com", "avatar_url": null }
```

### Logout
```
POST /auth/logout
```
Clears the token cookie.

---

## Health Check
```
GET /api/health
```
**Response `200`** (all ok) or `207` (degraded)
```json
{
  "status": "ok",
  "timestamp": "2026-03-15T12:00:00Z",
  "checks": {
    "database": "ok",
    "groq": "ok",
    "openai": "error",
    "anthropic": "error"
  },
  "llmQuota": { "used_usd": 0.12, "limit_usd": 1.00, "reset_at": "..." }
}
```

---

## Workspaces

All routes below are scoped to `/api/workspaces/:workspaceId`.

---

## Connections

Connections represent external data sources (database, API key, MCP server, etc.).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/connections` | List all connections |
| `POST` | `/connections` | Create a connection |
| `GET` | `/connections/:id` | Get a connection |
| `PATCH` | `/connections/:id` | Update a connection |
| `DELETE` | `/connections/:id` | Delete a connection |
| `POST` | `/connections/:id/ping` | Test connection reachability |

**Create connection body**
```json
{
  "name": "Production DW",
  "type": "snowflake",
  "config": { "account": "...", "database": "..." },
  "credentials": { "username": "...", "password": "..." }
}
```

---

## Nodes

Nodes are the vertices of your lineage graph (dbt models, sources, seeds, etc.).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/nodes?type=model` | List nodes (optional `type` filter) |
| `POST` | `/nodes` | Create a node |
| `GET` | `/nodes/:id` | Get a node |
| `PATCH` | `/nodes/:id` | Update a node |
| `DELETE` | `/nodes/:id` | Delete a node |

---

## Edges

Edges are the directed dependencies between nodes.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/edges` | List all edges |
| `POST` | `/edges` | Create an edge |
| `DELETE` | `/edges/:id` | Delete an edge |

---

## Lineage

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/lineage` | Full lineage graph `{ nodes, edges }` |
| `GET` | `/lineage/manifest` | Parsed dbt manifest data |
| `GET` | `/lineage/ancestors/:nodeId` | All upstream ancestors of a node |
| `GET` | `/lineage/descendants/:nodeId` | All downstream descendants of a node |

---

## Environments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/environments` | List environments |
| `POST` | `/environments` | Create environment |
| `PATCH` | `/environments/:id` | Update environment |
| `DELETE` | `/environments/:id` | Delete environment |

---

## Runs

An audit run is created when a DataPilot audit is triggered.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/runs?status=pending&limit=20&offset=0` | List runs |
| `POST` | `/runs` | Create a run record |
| `GET` | `/runs/:id` | Get a run |
| `PATCH` | `/runs/:id/status` | Update run status |
| `POST` | `/runs/:id/logs` | Append log entries |
| `GET` | `/runs/:id/logs` | Get all log entries for a run |

**Run statuses:** `pending` → `running` → `completed` / `failed`

---

## Policies

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/policies` | List policies |
| `POST` | `/policies` | Create a policy |
| `GET` | `/policies/:id` | Get a policy |
| `PATCH` | `/policies/:id` | Update a policy |
| `DELETE` | `/policies/:id` | Delete a policy |
| `POST` | `/policies/:id/evaluate` | Evaluate a policy against nodes |
| `GET` | `/policies/:id/evaluations` | Get evaluation history |

---

## Audit Log

Read-only log of workspace actions.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit?limit=50&offset=0` | List audit events |

**Event fields:** `id`, `action`, `resource_type`, `resource_id`, `user_id`, `metadata`, `created_at`

---

## GitHub Integration

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/github/webhook` | Receive GitHub webhook events (HMAC-verified) |
| `GET` | `/github/pr-reviews` | List PR review records |
| `GET` | `/github/pr-reviews/:id` | Get a single PR review |

---

## DataPilot Audit Engine

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/datapilot/audit` | Trigger a new audit run |
| `GET` | `/datapilot/findings` | List findings |
| `GET` | `/datapilot/findings/:id` | Get a single finding |
| `GET` | `/datapilot/quota` | LLM quota status |

### POST `/datapilot/audit`

**Body**
```json
{
  "project_path": "/absolute/path/to/dbt/project",
  "environment_id": "uuid (optional)",
  "query_history": { "model_name": 42 }
}
```

**Response `202`**
```json
{
  "run_id": "uuid",
  "status": "pending",
  "message": "Audit started. Poll GET /runs/:runId for status."
}
```

### GET `/datapilot/findings`

**Query params:** `severity`, `type`, `run_id`, `limit` (default 20), `offset` (default 0)

**Response `200`**
```json
{
  "findings": [
    {
      "id": "uuid",
      "run_id": "uuid",
      "node_id": "uuid or null",
      "model_name": "orders",
      "type": "dead_model",
      "severity": "high",
      "title": "Dead model: orders",
      "description": "...",
      "recommendation": "...",
      "confidence": 1.0,
      "cost_usd": 0.001,
      "metadata": {},
      "created_at": "2026-03-15T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Finding types:** `dead_model`, `orphan`, `broken_ref`, `duplicate_metric`, `grain_join`, `logic_drift`, `missing_tests`, `deprecated_source`

**Severity levels:** `critical`, `high`, `medium`, `low`

**Confidence score:** `1.0` = deterministic rule, `< 1.0` = LLM-assisted (findings with `confidence < 0.4` are filtered out)

---

## AI Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Send a message to the AI assistant |

**Body**
```json
{
  "message": "Which models have the most critical findings?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "context_finding_id": "uuid (optional — grounds response on this finding)",
  "context_model_name": "orders (optional — grounds response on this model's findings)"
}
```

**Response `200`**
```json
{
  "reply": "The model 'orders' has 3 critical findings: ...",
  "cost_usd": 0.0008,
  "model": "llama-3.1-8b-instant"
}
```

---

## Workspace Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Read settings (API keys masked to last 4 chars) |
| `PATCH` | `/settings` | Update settings |

### GET `/settings`

**Response `200`**
```json
{
  "groq_api_key": "****Xk9z",
  "openai_api_key": null,
  "anthropic_api_key": null,
  "default_project_path": "/dbt_projects/my_project",
  "updated_at": "2026-03-15T12:00:00Z"
}
```

### PATCH `/settings`

Send only the fields you want to update. Leave a field out to keep the existing value.

**Body**
```json
{
  "groq_api_key": "gsk_...",
  "default_project_path": "/dbt_projects/my_project"
}
```

**Response `200`**
```json
{ "ok": true }
```

---

## Error Responses

All errors follow this shape:

```json
{ "error": "Human-readable message" }
```

Or for validation errors with multiple fields:

```json
{ "errors": ["project_path is required", "environment_id must be a valid UUID"] }
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error |
| `401` | Not authenticated |
| `403` | Not a member of this workspace |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
