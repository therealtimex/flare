# Flare

AI GTM engine: plain-language product intake → inferred ICP → cited lead discovery → knowledge graph → verified enrichment → human-approved outreach → pipeline dashboard.

Built at HackwithBay 4.0 (2026-11-24) by the RealTimeX team.

## Setup

Requires **Node 22.16.0** (see `.nvmrc`).

```bash
nvm use            # or put ~/.nvm/versions/node/v22.16.0/bin first on PATH
npm ci
cp .env.example .env.local   # optional keys: FLEXPRICE_API_KEY, HUNTER_API_KEY
npm run db:migrate
npm run seed
npm run dev        # http://localhost:3020
```

Checks: `npm run lint && npm run typecheck && npm test`.

Data lives in SQLite at `$FLARE_DATA_DIR/flare.db` (default `./.flare-data/`, gitignored).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · radix-ui · Drizzle ORM + better-sqlite3 · zod · vitest.
