# Build context is the workspace root (ai-governance/)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Bundle API into a single file with esbuild (skips type-checking)
RUN node_modules/.bin/esbuild apps/api/src/index.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --packages=external \
      --outfile=apps/api/dist/index.js \
      --sourcemap

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
