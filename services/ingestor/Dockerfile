FROM node:22-alpine AS base
RUN corepack enable
ENV NODE_OPTIONS=--dns-result-order=ipv4first
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/ingestor/package.json ./services/ingestor/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/queue-contracts/package.json ./packages/queue-contracts/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --fetch-retries=5

FROM base AS builder
ENV CI=true
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --fetch-retries=5
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ingestor/src/ ./services/ingestor/src/
COPY services/ingestor/tsconfig.json ./services/ingestor/
RUN pnpm --filter @anthyx/types build
RUN pnpm --filter @anthyx/config build
RUN pnpm --filter @anthyx/queue-contracts build
RUN pnpm --filter @anthyx/ingestor build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/services/ingestor/node_modules ./services/ingestor/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/ingestor/dist ./services/ingestor/dist
COPY services/ingestor/package.json ./services/ingestor/

CMD ["node", "services/ingestor/dist/worker.js"]
