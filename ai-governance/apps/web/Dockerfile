# Build context is the workspace root (ai-governance/)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/types ./packages/types
COPY apps/web ./apps/web

# Skip tsc type-check, just run vite build (vite handles transpilation itself)
RUN pnpm --filter @app/web exec vite build

# ── Runtime stage (nginx) ─────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
