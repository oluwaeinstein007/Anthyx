# Project Structure

```
Anthyx/
├── apps/
│   ├── api/                          # Hono/Node.js backend
│   │   ├── Dockerfile
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # App entry point
│   │       ├── db/
│   │       │   ├── client.ts
│   │       │   ├── schema.ts
│   │       │   └── seed.ts
│   │       ├── mcp/
│   │       │   ├── server.ts
│   │       │   └── tools/
│   │       │       ├── generate-image-asset.ts
│   │       │       ├── read-engagement-analytics.ts
│   │       │       ├── retrieve-brand-context.ts
│   │       │       ├── retrieve-brand-rules.ts
│   │       │       ├── retrieve-brand-voice.ts
│   │       │       ├── retrieve-diet-instructions.ts
│   │       │       ├── schedule-post.ts
│   │       │       └── web-search-trends.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts
│   │       │   └── validate.ts
│   │       ├── queue/
│   │       │   ├── client.ts
│   │       │   └── jobs.ts
│   │       ├── routes/
│   │       │   ├── accounts.ts
│   │       │   ├── agents.ts
│   │       │   ├── analytics.ts
│   │       │   ├── auth.ts
│   │       │   ├── billing.ts
│   │       │   ├── brands.ts
│   │       │   ├── guardrails.ts
│   │       │   ├── plans.ts
│   │       │   └── posts.ts
│   │       ├── services/
│   │       │   ├── agent/
│   │       │   │   ├── brand-context.ts
│   │       │   │   ├── copywriter.ts
│   │       │   │   ├── guardrails.ts
│   │       │   │   ├── logger.ts
│   │       │   │   ├── orchestrator.ts
│   │       │   │   ├── prompt-builder.ts
│   │       │   │   ├── reviewer.ts
│   │       │   │   └── strategist.ts
│   │       │   ├── analytics/
│   │       │   │   └── scorer.ts
│   │       │   ├── assets/
│   │       │   │   ├── ai-generator.ts
│   │       │   │   ├── cdn.ts
│   │       │   │   ├── generator.ts
│   │       │   │   └── template-renderer.ts
│   │       │   ├── billing/
│   │       │   │   ├── limits.ts
│   │       │   │   ├── stripe.ts
│   │       │   │   └── usage-tracker.ts
│   │       │   ├── brand-ingestion/
│   │       │   │   ├── embedder.ts
│   │       │   │   ├── extractor.ts
│   │       │   │   └── parser.ts
│   │       │   ├── oauth-proxy/
│   │       │   │   ├── crypto.ts
│   │       │   │   ├── index.ts
│   │       │   │   └── refreshers.ts
│   │       │   └── posting/
│   │       │       ├── executor.ts
│   │       │       └── proxy-router.ts
│   │       └── workers/
│   │           ├── index.ts
│   │           ├── analytics.worker.ts
│   │           ├── content.worker.ts
│   │           ├── plan.worker.ts
│   │           └── post.worker.ts
│   │
│   └── dashboard/                    # Next.js frontend
│       ├── Dockerfile
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   ├── globals.css
│           │   ├── providers.tsx
│           │   ├── (auth)/
│           │   │   ├── login/page.tsx
│           │   │   └── register/page.tsx
│           │   └── (dashboard)/
│           │       ├── layout.tsx
│           │       └── dashboard/
│           │           ├── page.tsx
│           │           ├── accounts/page.tsx
│           │           ├── agents/page.tsx
│           │           ├── analytics/page.tsx
│           │           ├── billing/
│           │           │   ├── page.tsx
│           │           │   └── upgrade/page.tsx
│           │           ├── brands/
│           │           │   ├── page.tsx
│           │           │   └── [id]/
│           │           │       ├── page.tsx
│           │           │       └── ingest/page.tsx
│           │           ├── plans/
│           │           │   ├── page.tsx
│           │           │   └── [id]/page.tsx
│           │           └── review/page.tsx
│           ├── components/
│           │   └── sidebar.tsx
│           └── lib/
│               └── api.ts
│
├── packages/
│   ├── config/                       # Shared config & env schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── schemas.ts
│   └── types/                        # Shared TypeScript types
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── agents.ts
│           ├── billing.ts
│           ├── plans.ts
│           └── platforms.ts
│
├── config.ts
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── turbo.json
├── technical.md
├── .env
├── .env.example
├── .gitignore
└── .prettierrc
```
