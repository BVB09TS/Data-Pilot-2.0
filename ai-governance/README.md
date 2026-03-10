# AI Governance Platform

Multi-tenant AI governance system with OAuth authentication, workspace management, connection management (API keys & MCP), and lineage/DAG visualization.

## Tech Stack

- **Backend:** Node.js/TypeScript + Express + PostgreSQL
- **Frontend:** React/TypeScript + Vite + TailwindCSS
- **Auth:** OAuth (GitHub, Google)
- **Package Manager:** pnpm (monorepo)

## Project Structure

```
ai-governance/
├── apps/
│   ├── api/          # Express backend
│   └── web/          # React + Vite frontend
├── packages/
│   └── types/        # Shared TypeScript types
├── db/
│   ├── migrations/   # SQL migration files (9 total)
│   └── seeds/        # Seed data
└── [config files]
```

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Database setup

```bash
# Create PostgreSQL database
createdb ai_governance

# Run migrations
pnpm db:migrate

# Seed development data
pnpm db:seed
```

### 4. Run development

```bash
# Terminal 1: Backend
cd apps/api && pnpm dev

# Terminal 2: Frontend
cd apps/web && pnpm dev
```

Visit http://localhost:5173

## Implemented (Phase 1)

✅ Monorepo structure (pnpm workspaces)
✅ TypeScript + ESLint + Prettier config
✅ Shared types package
✅ Express backend skeleton
✅ React + Vite frontend skeleton
✅ 9 database migrations (users, workspaces, members, environments, connections, nodes, edges, runs, sessions)
✅ Migration runner (db:migrate)
✅ Seed data script (db:seed)

## Next Phase (Phase 2)

Run migrations with proper PostgreSQL database setup.

## Database Schema

9 tables with proper indexes, constraints, and cascade deletes:
1. users
2. workspaces
3. workspace_members
4. environments
5. connections
6. nodes
7. edges
8. runs
9. sessions
