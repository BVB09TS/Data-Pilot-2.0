# Data Platform AI Assistant — Platform Design Document

> **Purpose:** Design a plug-in, AI-powered system that connects to modern data platforms and helps engineers manage, analyze, and improve their data environments. This document focuses on **architecture, system design, and project structure** before implementation.

---

## 1. Product Concept (Refined)

### 1.1 Vision Statement

**A platform that plugs into data warehouses, data lakes, and data pipelines to help engineers and organizations manage, analyze, and improve their data environments using AI — combining software engineering best practices with AI-powered automation.**

### 1.2 Refined Value Proposition

| Stakeholder | Value |
|-------------|-------|
| **Data Engineers** | AI-assisted detection of issues, optimization suggestions, debugging help — engineers stay in control, AI accelerates work |
| **Data Platform Teams** | Centralized visibility across connectors; consistent quality and monitoring; reduced manual toil |
| **Organizations** | Better data reliability, lower cost (optimization), faster incident resolution, governance support |

### 1.3 Core Capabilities (Prioritized)

1. **Connect** — Plug into multiple data platforms (warehouses, lakes, pipelines) via a connector abstraction
2. **Detect** — Identify issues, anomalies, and risks (quality, performance, lineage, cost)
3. **Analyze** — Understand pipelines, dependencies, and impact
4. **Suggest** — Recommend improvements and fixes (AI-assisted, not auto-applied)
5. **Assist** — Help with debugging, optimization, and operational tasks
6. **Improve** — Learn from feedback and usage to get better over time

### 1.4 Design Principles

- **AI as assistant, not replacement** — Engineers approve actions; AI proposes and explains
- **Security by design** — Sensitive data protected; least-privilege access for agents
- **Modular and extensible** — Add connectors and agents without rewriting core
- **Observable and testable** — CI/CD, tests, logging, metrics from day one

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                          │
│  CLI  │  Web Dashboard  │  REST API  │  (Future: IDE plugins, Slack, etc.)           │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / ORCHESTRATION                                │
│  Request routing  │  Auth  │  Rate limiting  │  Audit logging                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY & DATA PROTECTION LAYER                            │
│  Access control  │  Data masking  │  PII redaction  │  Agent permission boundaries   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT ORCHESTRATION LAYER                                   │
│  Task routing  │  Agent coordination  │  Result aggregation  │  Feedback collection   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS (Specialized)                                     │
│  Monitoring  │  Optimization  │  Data Quality  │  Debugging  │  (Extensible)           │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CONNECTOR LAYER (Plug-in)                                   │
│  dbt  │  Snowflake  │  BigQuery  │  Databricks  │  Airflow  │  (Extensible)           │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           DATA PLATFORMS (External)                                   │
│  Warehouses  │  Lakes  │  Pipelines  │  BI Tools  │  Version Control                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Presentation** | CLI, web UI, API; user and programmatic access |
| **API Gateway** | Auth, routing, rate limits, audit logs |
| **Security** | Enforce permissions, mask/redact sensitive data before it reaches agents |
| **Agent Orchestration** | Dispatch tasks to agents, aggregate results, collect feedback |
| **AI Agents** | Specialized logic per domain (monitoring, quality, optimization, debugging) |
| **Connectors** | Abstract platform-specific access; read metadata, lineage, metrics; no raw PII by default |
| **Data Platforms** | External systems; we connect read-only or with scoped write where configured |

---

## 3. Technology Stack

### 3.1 Recommended Stack

| Category | Choice | Rationale |
|----------|--------|-----------|
| **Language** | Python 3.11+ | Dominant in data/AI; rich ecosystem (dbt, SQL, ML); aligns with existing DataPilot |
| **API Framework** | FastAPI (or Flask for PoC) | Async support, OpenAPI, validation; Flask acceptable for PoC simplicity |
| **LLM / AI** | Multi-provider (OpenAI, Anthropic, Groq, Ollama) | Cost control, vendor flexibility, local option |
| **Config** | YAML + Pydantic | Structured, validated config; env for secrets |
| **Storage (PoC)** | JSON files, SQLite | No infra dependency; easy to swap for Postgres later |
| **Orchestration** | In-process (ThreadPool/asyncio) | PoC; Airflow/Celery for production scale |
| **Testing** | pytest, pytest-cov | Standard Python testing |
| **CI/CD** | GitHub Actions / GitLab CI | Already in use |
| **Containers** | Docker, Docker Compose | Consistent dev and deploy |

### 3.2 Stack by Phase

| Phase | Additions |
|-------|-----------|
| **PoC** | Python, FastAPI/Flask, multi-LLM, SQLite/JSON, pytest |
| **Post-PoC** | Redis (caching, queues), Postgres (state), optional message queue |
| **Production** | Kubernetes, observability (Prometheus, Grafana), secrets manager |

---

## 4. Modular Architecture (Detailed)

### 4.1 Connector Plug-in Architecture

**Interface (abstract):**

```
Connector (abstract)
├── name: str
├── platform: str  # e.g. "dbt", "snowflake", "bigquery"
├── connect(config) -> Connection
├── get_metadata() -> Metadata  # schemas, tables, columns
├── get_lineage() -> LineageGraph
├── get_metrics() -> Metrics  # usage, cost, freshness (if available)
├── get_query_history() -> QueryHistory  # optional
└── health_check() -> HealthStatus
```

**Design rules:**
- Connectors are **read-only by default**; write actions (e.g. apply fix) require explicit opt-in and audit
- Each connector in its own module; registered in a **ConnectorRegistry**
- Config per connector (credentials, project IDs, etc.) via env or secrets manager
- New connector = new module implementing interface; no core changes

**PoC connectors:** dbt (existing), optional: Snowflake metadata API, BigQuery information_schema

### 4.2 Multi-Agent Architecture

**Agent interface:**

```
Agent (abstract)
├── name: str
├── capabilities: list[str]  # e.g. ["detect_anomalies", "suggest_optimization"]
├── run(context: AgentContext) -> AgentResult
├── required_data: list[str]  # e.g. ["lineage", "metrics", "metadata"]
└── permission_scope: str  # e.g. "metadata_only", "aggregated_only"
```

**Specialized agents (PoC → full):**

| Agent | Role | Inputs | Outputs |
|-------|------|--------|---------|
| **Monitoring** | Detect anomalies, drift, freshness issues | Lineage, metrics, freshness | Alerts, findings |
| **Data Quality** | Schema, nulls, duplicates, tests | Metadata, sample stats, test results | Quality findings, recommendations |
| **Optimization** | Cost, performance, redundancy | Usage, cost, lineage | Optimization suggestions |
| **Debugging** | Root-cause analysis, impact | Lineage, logs, error context | Debug suggestions, impact report |
| **Audit (existing)** | dbt project audit (dead models, broken refs, etc.) | dbt project, lineage | Audit report, findings |

**Orchestration:**
- **AgentRouter** routes tasks by type and complexity (tier: free/standard/premium)
- Agents can run in parallel when independent
- Results aggregated into a unified report; each finding tagged with agent and confidence

### 4.3 Security and Data Protection Layer

**Principles:**
1. **Least privilege** — Agents receive only what they need (e.g. metadata, aggregated stats, not raw rows)
2. **Data boundaries** — Connectors can expose "safe" vs "sensitive" data; security layer enforces
3. **Redaction** — PII, credentials, and secrets redacted before reaching LLM or logs
4. **Audit** — All agent actions and data access logged

**PoC implementation:**
- **Permission scopes:** `metadata_only` (schemas, names, lineage) vs `aggregated_only` (counts, stats) vs `sample` (limited rows, masked)
- **Redaction rules:** Configurable patterns (email, SSN, etc.); apply before sending to LLM
- **No raw PII to LLM by default** — Agents work on metadata and aggregates
- **Audit log:** JSON file or SQLite table of (timestamp, agent, action, scope)

**Production additions:** RBAC, encryption at rest, Vault for secrets, SOC2 alignment

---

## 5. Project Structure

### 5.1 Proposed Repository Layout

```
datapilot-platform/
├── README.md
├── pyproject.toml
├── requirements.txt
├── .env.example
├── config/
│   └── default.yaml              # Default configuration
│
├── src/
│   └── datapilot/
│       ├── __init__.py
│       ├── cli.py                # CLI entry
│       │
│       ├── api/                   # REST API
│       │   ├── __init__.py
│       │   ├── app.py             # FastAPI/Flask app factory
│       │   ├── routes/            # Route modules
│       │   │   ├── health.py
│       │   │   ├── audit.py
│       │   │   ├── agents.py
│       │   │   └── connectors.py
│       │   └── middleware/        # Auth, logging, CORS
│       │
│       ├── core/                  # Core domain logic
│       │   ├── config.py          # Configuration models
│       │   ├── pipeline.py        # Orchestration
│       │   ├── feedback.py        # Feedback store, improvement loop
│       │   └── security/          # Security layer
│       │       ├── __init__.py
│       │       ├── permissions.py
│       │       ├── redaction.py
│       │       └── audit.py
│       │
│       ├── connectors/            # Plug-in connectors
│       │   ├── __init__.py
│       │   ├── base.py            # Abstract Connector, ConnectorRegistry
│       │   ├── dbt/
│       │   │   ├── __init__.py
│       │   │   └── connector.py
│       │   ├── snowflake/
│       │   ├── bigquery/
│       │   └── ...
│       │
│       ├── agents/                # AI agents
│       │   ├── __init__.py
│       │   ├── base.py            # Abstract Agent, AgentRegistry
│       │   ├── router.py          # LLM routing, tier selection
│       │   ├── monitoring/
│       │   ├── data_quality/
│       │   ├── optimization/
│       │   ├── debugging/
│       │   └── audit/             # Existing dbt audit logic
│       │
│       ├── web/                   # Dashboard (optional separate service)
│       │   ├── app.py
│       │   └── static/
│       │
│       └── storage/               # Persistence
│           ├── __init__.py
│           ├── feedback_store.py
│           └── audit_log.py
│
├── tests/
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── deploy/
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── k8s/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── PLATFORM_DESIGN.md         # This document
    ├── REFACTORING_PLAN.md
    └── API.md                     # OpenAPI / endpoint docs
```

### 5.2 Mapping from Current DataPilot

| Current | Target |
|---------|--------|
| `datapilot/integrations/` | `datapilot/connectors/` (rename; align with Connector interface) |
| `datapilot/agents/analyst.py` | `datapilot/agents/audit/` (one agent type) |
| `datapilot/core/` | Keep; add `core/security/` |
| `datapilot/exporters/` | Keep; possibly under `core/` or `api/` |
| `agent/` (legacy) | Remove / deprecate |

---

## 6. First Version: PoC Scope

### 6.1 PoC Objectives

1. Demonstrate **plug-in architecture** with at least 2 connectors (dbt + one other)
2. Demonstrate **multi-agent system** with 2–3 agents (audit, data quality, monitoring)
3. Demonstrate **security layer** (permission scopes, redaction)
4. Provide **CLI + Web + API** for running audits and viewing results
5. Establish **feedback loop** (store runs, summarize, suggest improvements)
6. **Clean, testable codebase** with CI

### 6.2 PoC Feature Set

| Feature | In Scope | Out of Scope |
|---------|----------|--------------|
| Connectors | dbt (existing), Snowflake metadata (or BigQuery) | Full warehouse sync, real-time streaming |
| Agents | Audit (existing), Data Quality, Monitoring (basic) | Optimization, Debugging (full) |
| Security | Permission scopes, PII redaction, audit log | RBAC, encryption at rest |
| API | REST: health, audit trigger, report, findings | Webhooks, streaming, GraphQL |
| UI | Dashboard: report, findings, lineage, suggestions | Full IDE plugin, Slack |
| Storage | JSON + SQLite | Postgres, Redis |
| Feedback | Store runs, summarize, suggest | Auto prompt tuning |

### 6.3 PoC Success Criteria

- [ ] Run `datapilot audit` on a dbt project and get a report with findings and suggestions
- [ ] Connect to at least one warehouse (Snowflake or BigQuery) and fetch metadata
- [ ] At least 2 agents (audit + one other) contribute to the report
- [ ] Security layer redacts configured patterns before sending to LLM
- [ ] `datapilot feedback summarize` shows run history
- [ ] API allows triggering an audit and retrieving the report
- [ ] CI runs unit and integration tests
- [ ] Documentation explains architecture, setup, and usage

### 6.4 PoC Phasing

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **P0: Foundation** | 1–2 weeks | Consolidate codebase, wire API, add security module skeleton |
| **P1: Connectors** | 1 week | Connector base + registry; dbt connector refactored; 1 warehouse connector |
| **P2: Agents** | 1–2 weeks | Agent base + registry; Audit agent; Data Quality agent; Monitoring agent (basic) |
| **P3: Integration** | 1 week | End-to-end pipeline; feedback store; dashboard updates; tests |
| **P4: Polish** | 1 week | Docs, demo script, CI hardening |

---

## 7. Summary

| Aspect | Decision |
|--------|----------|
| **Product** | AI-assisted platform for data engineers; plug-in to warehouses/lakes/pipelines |
| **Architecture** | Layered: Presentation → API → Security → Agent Orchestration → Agents → Connectors → Platforms |
| **Connectors** | Plug-in; read-only default; registry pattern |
| **Agents** | Multi-agent; specialized (monitoring, quality, optimization, debugging, audit); router for LLM tier |
| **Security** | Scoped permissions, redaction, audit log; no raw PII to LLM by default |
| **Tech** | Python, FastAPI/Flask, multi-LLM, SQLite/JSON, pytest, Docker |
| **PoC** | 2 connectors, 2–3 agents, security layer, CLI+API+UI, feedback loop |

---

## 8. Next Steps

1. **Review and align** — Confirm this design matches your vision; adjust scope if needed
2. **Implement P0** — Foundation: consolidate, wire API, security skeleton
3. **Implement P1** — Connector abstraction and second connector
4. **Implement P2** — Agent abstraction and new agents
5. **Implement P3–P4** — Integration, polish, demo

Once you approve this design, we can proceed to implementation step by step.
