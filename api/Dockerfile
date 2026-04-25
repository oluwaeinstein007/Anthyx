FROM node:22-alpine AS base
RUN corepack enable

WORKDIR /app

# ---- deps (production only) ----
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---- build ----
FROM base AS builder
ENV CI=true
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY config.ts ./
COPY packages/ ./packages/
COPY api/src/ ./api/src/
COPY api/tsconfig.json ./api/
RUN pnpm --filter @anthyx/types build
RUN pnpm --filter @anthyx/config build
RUN pnpm --filter @anthyx/api build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/api/node_modules ./api/node_modules
COPY --from=builder /app/api/dist ./dist
COPY api/package.json ./

EXPOSE 4000

CMD ["node", "dist/index.js"]
