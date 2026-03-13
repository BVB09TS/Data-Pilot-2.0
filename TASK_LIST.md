# DataPilot 2.0 — Master Task List

> Updated: 2026-03-13
> Status legend: ✅ Done | 🔄 In Progress | ⏳ Pending

---

## PHASE 0 — Carry-Over (Still Pending from Before)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Wire real dbt project connector (replace ShopMesh static data) | ⏳ | Real projects via dbt Discovery API or local parse |
| 0.2 | Connect real AI to chat panel (Anthropic / OpenAI / Groq) | ⏳ | Chat panel UI is built, needs backend wiring |
| 0.3 | Fix GitHub OAuth auth flow | ⏳ | Auth scaffold exists, OAuth not completed |
| 0.4 | Lineage modal depth selector (upstream/downstream `+model+` syntax) | ⏳ | UI built, backend depth filtering pending |
| 0.5 | Findings tab — link each finding to its model in the lineage graph | ⏳ | |
| 0.6 | Settings page — save user preferences (LLM key, project path, theme) | ⏳ | SettingsPage.tsx exists, no persistence yet |

---

## PHASE 1 — Today: Public Web Pages

> Goal: DataPilot has a proper web presence. Anyone landing on the product sees a professional, clear product.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | **Landing Page** — Hero, features, how it works, CTA | ⏳ | Main marketing page |
| 1.2 | **Login Page** — Email + password form, GitLab SSO button | ⏳ | Clean auth UI |
| 1.3 | **Documentation Page** — Getting started, CLI reference, config reference | ⏳ | Structured docs layout |
| 1.4 | **Community Page** — GitHub link, Discord/Slack invite, contributors | ⏳ | Open source community hub |
| 1.5 | **Pricing Page** — Free tier vs Team tier vs Enterprise | ⏳ | Simple 3-column layout |
| 1.6 | **Privacy Policy Page** — Standard privacy policy text | ⏳ | Legal requirement |
| 1.7 | **Terms of Service Page** — Standard ToS text | ⏳ | Legal requirement |
| 1.8 | **Changelog Page** — What's new, version history | ⏳ | Builds trust, shows momentum |
| 1.9 | **Navigation / Router** — Connect all pages with React Router | ⏳ | App.tsx needs routing setup |
| 1.10 | **Shared layout** — Navbar (public) + Footer for all public pages | ⏳ | Consistent branding |

---

## PHASE 2 — Core Feature Improvements

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | **Best Practices Engine** — Teams upload a YAML rules file, DataPilot enforces it | ⏳ | Biggest differentiator |
| 2.2 | **GitLab MR Review Bot** — Auto-post findings as MR comments on dbt changes | ⏳ | PRISM-style (like Zscaler) |
| 2.3 | **YAML Docs Quality Scorer** — Score models on description completeness, owner, tags | ⏳ | |
| 2.4 | **Naming Consistency Detector** — Find the same concept named 3 different ways across models | ⏳ | Semantic dedup via embeddings |
| 2.5 | **Refactoring Assistant** — AI suggests how to split large models, generates SQL stubs | ⏳ | |
| 2.6 | **Lineage-as-Code Reader** — Queryable graph: "which models touch PII columns?" | ⏳ | |
| 2.7 | **Cost Impact Report** — $ estimate for removing dead models from Snowflake | ⏳ | |

---

## PHASE 3 — Integrations Deep Dive

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | **Snowflake Deep Scan** — Cost per model, query patterns, clustering analysis | ⏳ | Cross-ref with dbt lineage |
| 3.2 | **Azure Service Bus Listener** — Detect schema change events → alert on breaking changes | ⏳ | Real-time proactive governance |
| 3.3 | **GitLab Integration** — MR reviews, pipeline status, branch diff analysis | ⏳ | |
| 3.4 | **Power BI Impact Analysis** — "If I change this model, which reports break?" | ⏳ | Lineage all the way to consumption |
| 3.5 | **dbt Cloud API** — Trigger runs, read job history, pull manifest.json remotely | ⏳ | |
| 3.6 | **Data Contracts Validation** — Validate models against declared contracts | ⏳ | |

---

## PHASE 4 — Advanced / Visionary

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | **Data Galaxy Catalog Sync** — Compare DataGalaxy metadata vs actual dbt models, flag drift | ⏳ | |
| 4.2 | **MLOps Feature Store Audit** — Check if dbt models feeding ML features are reliable + fresh | ⏳ | |
| 4.3 | **Semantic Model Clustering** — Group similar models by business concept using embeddings | ⏳ | |
| 4.4 | **Auto PR Approval** — Clean PRs (pass CI + best practices) get auto-approved | ⏳ | |
| 4.5 | **AI Governance Dashboard** — Track AI usage, audit logs, compliance reports | ⏳ | Fits the AI Transformation Leader role |
| 4.6 | **Multi-tenant SaaS** — Team workspaces, RBAC, SSO | ⏳ | |

---

## Current Frontend Structure (Built)

```
frontend/src/
├── App.tsx                          ← needs React Router added
├── components/
│   ├── findings/FindingsTab.tsx     ✅
│   ├── home/HomePage.tsx            ✅
│   ├── integrations/IntegrationsTab.tsx ✅
│   ├── layout/Header.tsx            ✅
│   ├── layout/Shell.tsx             ✅
│   ├── layout/Sidebar.tsx           ✅
│   ├── lineage/LineageGraph.tsx     ✅
│   ├── lineage/LineageTab.tsx       ✅
│   ├── lineage/ModelNode.tsx        ✅
│   ├── lineage/NodeDetailPanel.tsx  ✅
│   ├── models/ModelsTab.tsx         ✅
│   ├── overview/OverviewTab.tsx     ✅
│   └── settings/SettingsPage.tsx    ✅
├── contexts/ThemeContext.tsx        ✅
└── types.ts                         ✅
```

---

## Pages to Build Today (Phase 1 Detail)

### New files to create:
```
frontend/src/pages/
├── LandingPage.tsx       ← hero + features + how it works + CTA
├── LoginPage.tsx         ← email form + GitLab SSO
├── DocsPage.tsx          ← structured documentation
├── CommunityPage.tsx     ← GitHub + Discord + contributors
├── PricingPage.tsx       ← Free / Team / Enterprise tiers
├── PrivacyPage.tsx       ← privacy policy
├── TermsPage.tsx         ← terms of service
└── ChangelogPage.tsx     ← version history

frontend/src/components/public/
├── PublicNavbar.tsx      ← shared navbar for public pages
└── PublicFooter.tsx      ← shared footer
```

### App.tsx update:
- Install `react-router-dom`
- Add routes: `/`, `/login`, `/docs`, `/community`, `/pricing`, `/privacy`, `/terms`, `/changelog`
- Route `/dashboard` → existing Shell (the app)
