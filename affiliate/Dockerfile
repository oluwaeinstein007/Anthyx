FROM node:22-alpine AS base
RUN corepack enable

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY affiliate/package.json ./affiliate/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @anthyx/types build
RUN pnpm --filter @anthyx/config build
WORKDIR /app/affiliate
RUN pnpm build
WORKDIR /app

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/affiliate/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/affiliate/.next/static ./affiliate/.next/static

USER nextjs
EXPOSE 3002
ENV PORT=3002

CMD ["node", "affiliate/server.js"]
