FROM node:22-alpine AS base
RUN corepack enable
ENV NODE_OPTIONS=--dns-result-order=ipv4first
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/agent/package.json ./services/agent/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/queue-contracts/package.json ./packages/queue-contracts/
RUN pnpm install --frozen-lockfile --prod --fetch-retries=5

FROM base AS builder
ENV CI=true
RUN pnpm install --frozen-lockfile --fetch-retries=5
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/agent/src/ ./services/agent/src/
COPY services/agent/tsconfig.json ./services/agent/
RUN pnpm --filter @anthyx/types build
RUN pnpm --filter @anthyx/config build
RUN pnpm --filter @anthyx/queue-contracts build
RUN pnpm --filter @anthyx/agent build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/services/agent/node_modules ./services/agent/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/agent/dist ./services/agent/dist
COPY services/agent/package.json ./services/agent/

CMD ["node", "services/agent/dist/index.js"]
