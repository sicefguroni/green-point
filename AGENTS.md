# GreenPoint — Agent Guide

## Quick-start

```bash
npm install                    # runs prisma generate via postinstall
cp .env.example .env.local     # fill in secrets
npm run db:push                # pushes Prisma schema to Supabase (uses dotenv -e .env.local)
npm run dev                    # http://localhost:3000
```

All db scripts load `.env.local` automatically — never use bare `prisma` CLI (Prisma reads `.env`, not `.env.local`).

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (next/core-web-vitals + next/typescript) |
| `npm run test` | Vitest — all `src/**/*.test.ts` |
| `npm run db:generate` | Prisma generate (also runs on postinstall) |
| `npm run db:push` | Push schema to Supabase |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:validate` | Prisma schema validation |
| `npm run data:pipeline:warm` | Warms GEE/AQI caches |

**Run order**: `lint` → `npm run build` (catches type errors + build issues). `npm run test` is independent — Vitest, node env.

## Architecture

```
src/                      Next.js 15 App Router
  app/                    Routes (app router)
    (app)/                Authenticated layout (explore, dashboard, profile, saved-solutions)
    api/                  18 route groups (admin, auth, barangays, chat, cost-estimate, cron, data,
                          geophotos, metrics, openapi, profile, recommendations, saved-solutions,
                          simulation, timeline, timelines, trees, users)
    auth/                 Auth pages (login, signup, onboarding)
  components/             Shared React components
    ui/                   shadcn/ui components
    map/                  Mapbox GL + Leaflet components
    explore/              Explore map views
    auth/                 Auth-related components
    charts/               Recharts charts
    solutions/            Recommendation cards
  config/                 mapConfig, legendConfig
  context/                React contexts
  hooks/                  Custom hooks
  lib/                    Business logic (ai/, auth/, avatar/, data-api/, data-pipeline/, geo/, map/,
                          prisma.ts, rag/, recommendations/, simulation/, storage/, supabase/,
                          timeline/, utils.ts, vision/)
  middleware.ts           Supabase session refresh + route protection
  types/                  TypeScript type definitions
  utils/                  Utility functions
prisma/
  schema.prisma           34 models (User, Profile, City, Barangay, Point, GreenerIndex, TaggedTree, SavedSolution, Checkpoint, etc.)
  migrations/             Prisma migrations
supabase/
  config.toml             Supabase local dev config
  migrations/             RLS/SQL migrations (run separately from Prisma)
python-services/
  timeline_swarm/         FastAPI service (LangGraph agent for timeline generation)
scripts/                  Data pipeline scripts (seed, aggregate, backfill, warm)
public/
  geo/                    Static GeoJSON — long cache (86400s, stale-while-revalidate 604800s)
```

## Key conventions

- **Path alias**: `@/*` → `./src/*` (tsconfig paths + vitest alias)
- **CSS**: Tailwind 4 + `tw-animate-css`, shadcn/ui (new-york style, neutral base)
- **Icons**: lucide-react
- **Map libs**: mapbox-gl (primary), leaflet + react-leaflet (secondary)
- **Prisma 7**: uses `@prisma/adapter-pg` with `pg` Pool (not the default constructor). `serverExternalPackages: ["@prisma/client"]` in next.config.
- **Auth**: Supabase SSR (`@supabase/ssr`) — client for browser, server for API routes, middleware for session refresh. Protected paths defined in `middleware.ts`.
- **DB connection**: `DATABASE_URL` (pooled, port 6543) for runtime; `DIRECT_URL` (port 5432) for Prisma CLI.
- **Image remote patterns**: `dummyimage.com`, `ui-avatars.com`, `*.googleusercontent.com`, `*.supabase.co/storage/v1/**`.
- **Python service**: Lives at `python-services/timeline_swarm/` — FastAPI + LangGraph. Run separately from Next.js. See `requirements.txt`.
- **Supabase RLS**: Managed via raw SQL migrations in `supabase/migrations/`. Not in Prisma. Refer to `RLS_POLICIES_README.md` for role-based access rules.
- **Data pipeline**: GEE satellite data fetched at runtime via API routes (`/api/data?bundle=map-env`). Warm script: `data-pipeline-warm.mjs`.
- **Recommendations**: AI-generated via RAG (pgvector). Dual provider in `lib/ai/` — both `gemini.ts` + `openai.ts`. Uses `ResearchStudy` + `StudyChunk` models for context.

## Testing

- Vitest, node environment, `src/**/*.test.ts`
- 15 test files exist — focus on lib/ and API route tests
- No e2e or integration test runner configured (manual browser validation expected)

## Environment variables

Use `.env.local`. Key vars (from `.env.example`):

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres (pooled vs direct)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — never expose client-side
- `GEMINI_API_KEY` — AI recommendations
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — maps
- `CRON_SECRET` — optional, secures `/api/cron/data-pipeline`

## Available skills

`.agents/skills/supabase-postgres-best-practices/` — loaded automatically for Postgres/Supabase tasks.

## Git / PR

PR template at `.github/pull_request_template.md`. Checks: `npm run build`, `npm run db:validate` (if schema changed), manual browser validation.
