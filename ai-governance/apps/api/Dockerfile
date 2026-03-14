# Build context is the workspace root (ai-governance/)
# No separate build step needed — tsx transpiles TypeScript at runtime.
FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/types ./packages/types
COPY apps/api ./apps/api

ENV NODE_ENV=production

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
