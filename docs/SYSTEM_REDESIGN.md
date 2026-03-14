# DataPilot Platform — System Redesign Plan
> Version: 3.0 Draft | Author: Architecture Review | Date: 2026-03-14
> Status: **AWAITING VALIDATION** — do not start implementation without approval

---

## 1. What We Are Actually Building

One sentence:

> **DataPilot is an AI intelligence layer that sits on top of a company's existing data platform, lets them control what the AI sees, and gives them actionable insights — without compromising their data privacy.**

A company (Tenant) connects their tools (dbt, Snowflake, GitLab, Kafka, Power BI, etc.).
They define a **Flow** — a scoped slice of their data (e.g. "Sales Flow = 20 models").
Our system reads that flow, masks sensitive data, sends only the safe context to the AI, and returns findings.

That is the product. Everything else is plumbing.

---

## 2. The Three Pillars (Not Three Products)

What we built as "three products" are actually **three layers of one platform**:

| What we called it | What it actually is | Layer |
|---|---|---|
| DataPilot Core | AI analysis engine — parse, graph, agents, findings | Intelligence Layer |
| AI Gateway | LLM proxy — multi-tenant, routing, cost control, quotas | LLM Layer |
| AI Governance | Privacy shield — scope control, masking, audit trail | Governance Layer |

They work in sequence, not in parallel:

```
Tenant Request
      │
      ▼
[Governance Layer]  ← "What is the AI allowed to see?"
      │               Flow selection, PII masking, policy check, audit log
      ▼
[LLM Layer]         ← "Which LLM, at what cost, with what limits?"
      │               Tier routing, quota check, retry, cost tracking
      ▼
[Intelligence Layer]← "What does the AI find?"
      │               Agents, lineage analysis, findings, recommendations
      ▼
Findings + Report
```

---

## 3. System Architecture

### 3.1 Full Layer Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                     │
│                                                                   │
│  Web Dashboard (React)    CLI (datapilot)    REST API Consumers   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────▼─────────────────────────────────┐
│  API GATEWAY LAYER                                                │
│                                                                   │
│  Auth Middleware (JWT / OAuth2 / API Keys)                        │
│  Rate Limiting (per tenant)                                       │
│  CORS (explicit allowlist, no wildcard)                           │
│  Request Logging + Tracing                                        │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                       │
┌─────────▼──────────┐  ┌───────▼────────┐  ┌──────────▼─────────┐
│  TENANT SERVICE    │  │  CONNECTOR     │  │  AUDIT SERVICE     │
│                    │  │  SERVICE       │  │                    │
│  Tenant CRUD       │  │                │  │  Run history       │
│  Flow definitions  │  │  dbt           │  │  Finding trends    │
│  Connection config │  │  Snowflake     │  │  Score tracking    │
│  User management   │  │  GitLab        │  │  Export (JSON,     │
│  Billing / quotas  │  │  Kafka         │  │  CSV, SARIF, HTML) │
└─────────┬──────────┘  │  Power BI      │  └──────────┬─────────┘
          │             │  Airflow       │             │
          │             │  AWS / Azure   │             │
          │             └───────┬────────┘             │
          │                     │                      │
┌─────────▼─────────────────────▼──────────────────────▼─────────┐
│  AI GOVERNANCE LAYER  ← THE PRIVACY SHIELD                      │
│                                                                  │
│  FlowSelector    → "Give me only the Sales Flow models"         │
│  PIIMasker       → Detect + mask sensitive column names/values  │
│  PolicyEngine    → Tenant-defined rules ("never send raw PII")  │
│  AuditTrail      → Immutable log: what was sent to AI, when     │
│  ScopeValidator  → Max token budget, depth limit, domain lock   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │  Only safe, scoped context passes
┌─────────────────────────────────▼────────────────────────────────┐
│  LLM GATEWAY LAYER                                               │
│                                                                  │
│  TierRouter      → free (Groq) / standard (GPT-4o-mini)         │
│                    / premium (Claude / GPT-4o)                   │
│  QuotaManager    → Per-tenant monthly token budget              │
│  CostTracker     → Real cost per call, per tenant, per run      │
│  KeyVault        → Encrypted provider keys (AES-GCM, never XOR) │
│  RetryEngine     → tenacity-based, provider-aware backoff       │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│  INTELLIGENCE LAYER                                              │
│                                                                  │
│  Parser          → Read dbt project (SQL, YAML, query history)  │
│  LineageGraph    → NetworkX DAG, static analysis                │
│  AgentOrchestra  → 8 specialist agents run in parallel          │
│    - dead_models, orphans, broken_refs, deprecated_sources      │
│    - duplicate_metrics, grain_joins, logic_drift, missing_tests │
│  AnomalyDetector → Cost spikes, schema drift, usage drops       │
│  Suggestor       → Actionable fix recommendations               │
│  Reporter        → Severity mapping, scoring, report build      │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│  PLATFORM LAYER                                                  │
│                                                                  │
│  PostgreSQL      → Tenant data, connections, findings history    │
│  Redis           → Job queue (async audits), caching            │
│  S3 / MinIO      → Reports, exports, audit logs (blob storage)  │
│  Celery Worker   → Background audit execution                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Concepts

**Tenant**
A company. Has users, connections, flows, policies, and a quota.

**Connection**
A live link to one data platform. A tenant can have multiple connections.
```
Tenant XYZ Corp:
  - Connection A: dbt project at /dbt/shopmesh (local or Cloud)
  - Connection B: Snowflake ACCOUNT_XYZ, warehouse COMPUTE_WH
  - Connection C: GitLab project 12345
  - Connection D: Kafka broker kafka.xyz.com:9092
```

**Flow**
A named, scoped subset of a connection that defines what the AI is allowed to analyze.
```
Flow "Sales Analytics":
  - Source: Connection A (dbt)
  - Include: models tagged "sales" OR in path analytics/sales/
  - Max models: 40
  - Depth limit: 3 hops upstream
  - Masking policy: mask columns matching /customer_.*id/
```

This is the unit of AI context. The AI never sees more than what a Flow allows.

**Audit Run**
One execution of the intelligence pipeline on a Flow.
Produces a set of Findings with severity, recommendations, and cost.
Every run is logged immutably.

---

## 4. Folder Structure (Target)

```
Data-Pilot-2.0/
│
├── datapilot/                        # Main Python package
│   ├── cli.py                        # CLI: audit | serve | tenants | flows | connections
│   │
│   ├── core/                         # Intelligence Layer
│   │   ├── config.py                 # DataPilotConfig (Pydantic)
│   │   ├── parser.py                 # dbt project parser
│   │   ├── graph.py                  # NetworkX lineage DAG
│   │   ├── pipeline.py               # AuditPipeline orchestrator
│   │   ├── reporter.py               # Report builder + severity mapping
│   │   └── feedback.py               # Run history store
│   │
│   ├── agents/                       # AI Agents
│   │   ├── router.py                 # AgentRouter (tier-based LLM routing)
│   │   ├── analyst.py                # 8 specialist analysis agents
│   │   ├── anomaly.py                # Anomaly detection (cost, usage, schema)
│   │   └── suggestor.py              # Fix recommendations from findings
│   │
│   ├── governance/                   # AI Governance Layer (THE PRIVACY SHIELD)
│   │   ├── __init__.py
│   │   ├── flow_selector.py          # Select models by flow definition
│   │   ├── masker.py                 # PII detection + masking (presidio or regex)
│   │   ├── policy.py                 # Tenant governance policy engine
│   │   ├── scope_validator.py        # Token budget, depth limit, domain check
│   │   └── audit_trail.py            # Immutable log of all AI context sent
│   │
│   ├── gateway/                      # LLM Gateway Layer
│   │   ├── __init__.py
│   │   ├── router.py                 # Tier routing (free/standard/premium)
│   │   ├── auth.py                   # API key management
│   │   ├── quota.py                  # Per-tenant token + cost quotas
│   │   ├── keyvault.py               # AES-GCM encrypted key storage (NO XOR fallback)
│   │   └── cost_tracker.py           # Real cost per call tracking
│   │
│   ├── connectors/                   # Connection Layer (renamed from integrations/)
│   │   ├── base.py                   # BaseConnector interface
│   │   ├── registry.py               # ConnectorRegistry (auto-discovery)
│   │   ├── dbt/                      # dbt local + Cloud connector
│   │   ├── snowflake/                # Snowflake connector
│   │   ├── gitlab/                   # GitLab (MR reviews, pipelines)
│   │   ├── kafka/                    # Kafka / event bus
│   │   ├── powerbi/                  # Power BI datasets
│   │   ├── airflow/                  # Airflow DAG integration
│   │   ├── aws/                      # AWS S3 + Glue
│   │   └── azure/                    # Azure Storage + Synapse
│   │
│   ├── tenants/                      # Multi-tenant management
│   │   ├── models.py                 # Pydantic: Tenant, Connection, Flow, Policy
│   │   ├── store.py                  # PostgreSQL CRUD (SQLAlchemy or raw psycopg)
│   │   └── service.py                # Business logic: create tenant, add connection
│   │
│   ├── api/                          # REST API
│   │   ├── routes.py                 # Core endpoints (health, report, audit)
│   │   ├── tenant_routes.py          # /tenants, /connections, /flows
│   │   ├── auth.py                   # JWT + API key middleware
│   │   └── middleware.py             # CORS (allowlist), rate limit, logging
│   │
│   ├── web/                          # Flask app factory (SLIM)
│   │   └── app.py                    # create_app(): mounts blueprints + serves frontend
│   │
│   └── exporters/                    # Export formats
│       └── formats.py                # JSON, CSV, SARIF, HTML, Jira
│
├── frontend/                         # Single React + Vite dashboard (KEEP, improve)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx         # Overview + run history
│       │   ├── Lineage.tsx           # D3 lineage graph
│       │   ├── Findings.tsx          # Findings browser
│       │   ├── Flows.tsx             # Flow management UI
│       │   ├── Connections.tsx       # Connection setup UI
│       │   └── Settings.tsx          # Tenant settings (NO direct key display)
│       └── components/
│
├── tests/
│   ├── unit/                         # Per-module unit tests
│   └── integration/                  # Full pipeline + API tests (fill these in)
│
├── deploy/
│   ├── k8s/                          # Kubernetes manifests
│   ├── docker/                       # Docker + Compose
│   └── terraform/                    # (future) infra as code
│
├── docs/
│   ├── SYSTEM_REDESIGN.md            # This file
│   ├── ARCHITECTURE.md               # Living architecture doc
│   └── API.md                        # REST API reference
│
├── shopmesh_dbt/                     # Test fixture (do not modify)
├── scripts/
│   ├── answer_key.py                 # Ground truth (28 planted problems)
│   └── validate_env.py               # Environment check
│
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
└── datapilot.example.yaml
```

**What gets deleted:**
- `agent/` — v1 deprecated code. Gone.
- `datapilot/web/static/` — legacy static frontend. Gone. React is the only frontend.
- `ai-governance/` — TypeScript monorepo. Logic migrated into `datapilot/governance/` (Python). Directory removed.

---

## 5. Security Architecture

### 5.1 Authentication

| Method | Used For |
|--------|----------|
| JWT (short-lived, 15min) | Web dashboard user sessions |
| Refresh tokens (7 days, rotated) | Session renewal |
| API keys (SHA-256 stored) | CLI, machine-to-machine, CI/CD |
| OAuth2 (GitHub / Google) | User signup/login |

Every API endpoint requires auth. No exceptions. The settings endpoint dies.

### 5.2 Authorization (RBAC)

| Role | Can Do |
|------|--------|
| `admin` | Manage tenant, connections, users, flows |
| `analyst` | Run audits, view findings, export |
| `viewer` | Read-only: findings, lineage, reports |
| `service` | Machine account: trigger audits via API |

Row-level security: tenants never see each other's data at the DB level.

### 5.3 Secrets Management

- Provider API keys (Groq, Anthropic, OpenAI): stored encrypted (AES-GCM) in DB, decrypted in-memory only at call time, never returned via API
- Connector credentials (Snowflake, AWS): same pattern — encrypted at rest
- `GATEWAY_MASTER_KEY` is **required** at startup — no fallback, no XOR
- In production: use AWS Secrets Manager / Azure Key Vault, not env vars
- Web dashboard settings page: shows `****` only, accepts new values, never returns plaintext

### 5.4 Network Security

- CORS: explicit origin allowlist per deployment (env var `ALLOWED_ORIGINS`)
- Rate limiting: 100 req/min per tenant default, configurable
- CSRF: `flask-wtf` for form endpoints or SameSite cookie + token for API
- All internal service communication: mTLS in K8s

---

## 6. Data Model

### Core Entities

```
Tenant
  id, name, slug, plan, created_at
  ├── Users (id, email, role, tenant_id)
  ├── Connections (id, type, name, config_encrypted, tenant_id)
  ├── Flows (id, name, connection_id, filter_rules, masking_policy, tenant_id)
  └── Quotas (monthly_token_budget, monthly_cost_limit_usd)

AuditRun
  id, tenant_id, flow_id, started_at, completed_at, status
  ├── Findings (id, run_id, type, severity, model, description, recommendation)
  └── CostRecord (run_id, provider, tokens_in, tokens_out, cost_usd)

GovernanceAuditLog (IMMUTABLE)
  id, run_id, tenant_id, timestamp
  context_hash (SHA-256 of what was sent to AI)
  policy_applied, models_included, fields_masked
```

### Database

- **PostgreSQL** (primary store — tenant data, findings, runs)
- **Redis** (job queue for async audits, short-term caching)
- **S3 / MinIO** (reports, export files, graph JSON blobs)
- **No JSON file persistence for production** (JSON files are dev/test only)

---

## 7. Async Audit Execution

Audits are long-running (10-60 seconds depending on project size and LLM calls).
They run async via Celery:

```
POST /api/v1/flows/{flow_id}/audit
  → validate auth + quota
  → enqueue Celery task
  → return { run_id, status: "queued" }

GET /api/v1/runs/{run_id}
  → return { status: "running" | "completed" | "failed", progress: 0.7 }

WebSocket /ws/runs/{run_id}
  → stream real-time progress events to dashboard
```

This replaces the current synchronous blocking execution that hangs the HTTP request.

---

## 8. Connector Interface

Every data platform integration implements `BaseConnector`:

```python
class BaseConnector(ABC):
    """Standard interface for all data platform connections."""

    @abstractmethod
    def test_connection(self) -> ConnectionResult:
        """Verify credentials and connectivity."""

    @abstractmethod
    def fetch_metadata(self, flow: FlowDefinition) -> ProjectData:
        """Fetch scoped metadata (models, schema, lineage) for a given flow."""

    @abstractmethod
    def fetch_query_history(self, days: int = 90) -> list[QueryRecord]:
        """Fetch historical query stats for dead model detection."""

    @property
    @abstractmethod
    def connector_type(self) -> str:
        """e.g. 'dbt', 'snowflake', 'gitlab'"""
```

Connectors are discovered automatically via `ConnectorRegistry`.
New connectors: create a subclass, register it — zero changes to the pipeline.

---

## 9. AI Governance Flow (The Privacy Shield in Detail)

```
fetch_metadata(flow)
        │
        ▼
FlowSelector.apply(raw_metadata, flow.filter_rules)
  → "Sales flow only" — filter to 20 models instead of 400
        │
        ▼
ScopeValidator.check(scoped_data, flow.constraints)
  → enforce max_models, max_depth, max_tokens_estimated
  → REJECT if over budget (before any LLM call)
        │
        ▼
PIIMasker.mask(scoped_data, flow.masking_policy)
  → detect column names matching PII patterns
  → replace: customer_email → [MASKED_EMAIL], ssn → [MASKED_SSN]
  → log what was masked
        │
        ▼
AuditTrail.log(context_hash, models_included, fields_masked, policy)
  → immutable record: "Run X sent N models to AI, masked M fields"
        │
        ▼
→ SAFE, SCOPED CONTEXT → LLM Gateway → Analysis Agents
```

The customer can always audit: "What did you send to the AI?"
Answer: the exact hash + field-level masking log.

---

## 10. Phased Roadmap

### Phase 1 — Foundation (Weeks 1–3)
**Goal: Clean, secure, working core**

- [ ] Delete `agent/` (v1) and legacy `web/static/` frontend
- [ ] Fix all 5 critical security issues (auth, CORS, key handling, encryption)
- [ ] Add PostgreSQL as primary store (SQLAlchemy models for Tenant, Connection, Flow)
- [ ] Add JWT authentication to all API endpoints
- [ ] Celery + Redis for async audit execution
- [ ] Wire `datapilot/api/routes.py` into the main app (it's not mounted right now)
- [ ] Enforce AES-GCM only in KeyVault (no XOR fallback — hard error)
- [ ] Basic CI: lint + type check + unit tests must pass

**Deliverable:** Secure, working audit pipeline with proper auth and DB.

---

### Phase 2 — Multi-Tenant Platform (Weeks 4–6)
**Goal: Tenant onboarding + connection management**

- [ ] Tenant CRUD API + UI (create account, invite users)
- [ ] Connection management (add dbt, Snowflake, GitLab connections via UI)
- [ ] Flow definition (select models by tag/path/depth)
- [ ] Governance layer (FlowSelector + PIIMasker basic implementation)
- [ ] AuditTrail logging (what went to AI, when, from which tenant)
- [ ] dbt connector fully implemented (local + dbt Cloud)
- [ ] Snowflake connector fully implemented (query history)
- [ ] Run history per tenant (PostgreSQL, not JSON files)

**Deliverable:** A tenant can sign up, connect their dbt project, define a flow, and run an audit.

---

### Phase 3 — Intelligence Depth (Weeks 7–9)
**Goal: Better findings, better UX**

- [ ] Suggestor agent (actionable fix recommendations per finding)
- [ ] AnomalyDetector (cost spikes, schema drift, usage drops)
- [ ] Finding trends across runs (is this getting better or worse?)
- [ ] Real cost tracking per tenant per run (accurate, not estimated)
- [ ] GitLab connector (PR review acceleration)
- [ ] Kafka connector (event bus lineage)
- [ ] WebSocket real-time audit progress in dashboard
- [ ] Improved lineage visualization (filter by flow, highlight findings)

**Deliverable:** Findings are deep, actionable, and improving over time.

---

### Phase 4 — Enterprise & Scale (Weeks 10+)
**Goal: Enterprise-ready**

- [ ] SSO / SAML support (Okta, Azure AD)
- [ ] RBAC fine-grained (custom roles, model-level permissions)
- [ ] Advanced governance policies (custom PII patterns, domain isolation)
- [ ] Power BI + Airflow connectors fully implemented
- [ ] Kubernetes operator for self-hosted deployment
- [ ] SLA dashboard (audit reliability, LLM uptime, connector health)
- [ ] Terraform modules for cloud deployment (AWS, Azure, GCP)
- [ ] Compliance exports (SOC 2, GDPR audit trail)

---

## 11. What Stays vs What Changes

| Component | Decision | Reason |
|-----------|----------|--------|
| `datapilot/core/` (parser, graph, pipeline) | **KEEP** | Solid, working, well-designed |
| `datapilot/agents/` (router, analyst) | **KEEP + EXTEND** | Core intelligence, add suggestor + anomaly |
| `datapilot/gateway/` | **KEEP + FIX** | Good design, fix encryption fallback |
| `datapilot/integrations/` | **RENAME → connectors/, REWRITE** | Skeleton implementations, needs real connectors |
| `datapilot/web/app.py` | **SLIM DOWN** | Remove key handling, settings endpoints, make it just the app factory |
| `datapilot/api/routes.py` | **FIX + EXTEND** | Wire it in, add auth, fix CORS |
| `ai-governance/` (TypeScript) | **MIGRATE → datapilot/governance/** | Logic is right, language is wrong for this stack |
| `agent/` (v1) | **DELETE** | Dead code |
| `web/static/` (legacy) | **DELETE** | React is the frontend |
| `frontend/` (React) | **KEEP + IMPROVE** | Modern, keep it |
| JSON file persistence | **REPLACE** | PostgreSQL for prod, JSON only for dev/test |
| Flask | **KEEP** | Works fine, add async via Celery |

---

## 12. Technology Additions

| What | Why |
|------|-----|
| PostgreSQL + SQLAlchemy | Real multi-tenant data store |
| Redis + Celery | Async audit execution, job queue |
| Flask-JWT-Extended | Authentication middleware |
| presidio-analyzer | PII detection in governance layer |
| S3/MinIO | Blob storage for reports and exports |
| pytest + testcontainers | Integration tests with real DB |
| alembic | Database migrations |

What we **do NOT add:**
- No GraphQL (REST is fine, keep it simple)
- No microservices split (monolith until we need scale — YAGNI)
- No Kubernetes operator yet (Phase 4)
- No message broker yet (Redis is enough for Phase 1–3)

---

## 13. Open Questions for Validation

Before starting Phase 1, confirm:

1. **Deployment model:** Self-hosted only, or SaaS (multi-tenant cloud)?
   - This changes whether we need tenant isolation at DB level or just per-deployment

2. **Who are the first users?** Internal team testing, or external companies?
   - If external → auth + tenant management in Phase 1, not Phase 2

3. **Which connectors first?** dbt + Snowflake are obvious. Is GitLab or Kafka needed for Phase 2?

4. **Governance strictness:** Should the system BLOCK an audit if scope exceeds limits, or just WARN?

5. **Frontend rebuild:** Keep the current React dashboard and evolve it, or redesign the UI from scratch?

---

*This plan supersedes `docs/ARCHITECTURE.md`, `docs/PLATFORM_DESIGN.md`, and `docs/REFACTORING_PLAN.md`.*
*Those files can be archived once this plan is approved.*
