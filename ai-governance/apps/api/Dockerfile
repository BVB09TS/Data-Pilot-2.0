# Build context is the workspace root (ai-governance/)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/types ./packages/types
COPY apps/api ./apps/api

RUN pnpm --filter @types/shared run build 2>/dev/null || true
RUN pnpm --filter @app/api run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY apps/api/db ./db
COPY apps/api/scripts ./scripts

EXPOSE 3000

CMD ["node", "dist/index.js"]
