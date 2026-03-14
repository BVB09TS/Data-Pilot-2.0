# Build context is the workspace root (ai-governance/)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN npm install --legacy-peer-deps

COPY packages/types ./packages/types
COPY apps/api ./apps/api

RUN cd packages/types && npx tsc 2>/dev/null || true
RUN cd apps/api && npx tsc

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY apps/api/scripts ./scripts
COPY apps/api/db ./db

EXPOSE 3000

CMD ["node", "dist/index.js"]
