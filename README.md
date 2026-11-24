# Flare

**An AI GTM engine.** Describe your product in plain language; Flare infers your ideal customer profile, finds real accounts and decision-makers **with a public source cited for every fact**, maps warm-intro paths in a knowledge graph, drafts signal-personalized outreach that **a human must approve**, and tracks every lead through the pipeline, with agent vs. rep attribution and metered, credit-gated usage.

Built at HackwithBay 4.0 (2026-11-24) by the RealTimeX team.

## How it works

```
 Intake ──► Run GTM agent ──► RealTimeX terminal agent (the intelligence)
                                   │  calls tools over HTTP
                                   ▼
 Flare (Next.js + SQLite) ◄── /api/agent-tools/invoke {tool, input}
   │   citation gate · credit gate · activity log · knowledge graph
   ▼
 ICP ─► Leads (cited) ─► Outbox (human approves) ─► Pipeline ─► credits meter
```

**The app holds the data; the agent holds the intelligence.** Flare has no LLM API key. It is a local Next.js app with SQLite and a stable **agent-tools API**. ICP inference, web discovery, enrichment and copywriting run in a [RealTimeX](https://realtimex.ai) terminal agent that follows [`agent/SKILL.md`](agent/SKILL.md) and calls those tools. Every tool call is written to an activity log that the **Agent Thinking** panel shows live.

### Rules the app enforces (not just the prompt)

| Rule | Where |
|---|---|
| **Citations or quarantine.** `add_account`, `add_person` and `add_signal` need at least one `http(s)` source. Without one, the record is quarantined: hidden from leads, excluded from graph paths, refused as an outreach signal, and counted in the UI. | `src/lib/tools/` |
| **Human-in-the-loop.** The agent can only draft. Approve / Reject / edit happen in the Outbox; nothing is sent without Approve, and the agent can't move a lead past *Matched* without a rep-approved message. | `src/app/api/messages/`, tools |
| **Attribution.** Every stage change and decision records `actorKind` = `agent` or `rep`. | `activity` table |
| **Metering + credit gate.** `lead_enriched`, `graph_query` and `outreach_sent` each cost a credit (atomic decrement). At 0 credits these return `402 insufficient_credits` until you top up. Events go to [Flexprice](https://flexprice.io) when a key is set (fail-soft); otherwise metering stays local. | `src/lib/metering.ts` |
| **No third-party data services.** No Signals CRM, no Hunter/Apollo/Clearbit-style enrichment. Email status is `pattern` (with the source of the pattern) unless a public page states the address. | `agent/SKILL.md` |

### Data model

SQLite via Drizzle: `products`, `icps` (per-field confidence 0–1, expansion segments with rationale + sources), `accounts`, `people` (email status `unverified | pattern | verified`), `signals` (funding, hiring, exec hire, tech change…), `sources` (URL + quote per entity), `edges` (works_at, previously_employed_at, studied_at, competes_with, …), `leads` (fit score 0–100, tier A/B/C, stage, owner), `messages` (email/LinkedIn, step, A/B variant, signals used, status), `activity`, `usage_events`, `credits`.

The **knowledge graph** is the `edges` table, queried with recursive CTEs for 2–4-hop warm-intro paths through shared employers and schools (`query_graph`).

Stages: **Matched → Contacted → Replied → Meeting Booked → Closed Won / Closed Lost.**

## Setup

Requires **Node 22.16.0** (`.nvmrc`).

```bash
nvm use
npm ci
cp .env.example .env.local     # all settings are optional
npm run db:migrate
npm run seed                   # one demo product + 100 credits
npm run dev                    # http://localhost:3020
```

Checks: `npm run lint && npm run typecheck && npm test`.

Data lives in SQLite at `$FLARE_DATA_DIR/flare.db` (default `./.flare-data/`, gitignored).

### Running the agent

Click **Run GTM agent** on the Intake page. If [`realtimex-pp-cli`](https://www.npmjs.com/package/@realtimex/pp-cli) is available, Flare opens a RealTimeX terminal session with the rendered brief ([`agent/BRIEF.md`](agent/BRIEF.md)). Otherwise it shows the brief with a **Copy** button: paste it into any coding agent that can make HTTP calls, pointed at `FLARE_BASE_URL`.

The tool manifest (JSON Schema) is at `GET /api/agent-tools`; the agent instructions at `GET /api/agent-tools/skill`.

### Flexprice (optional)

1. Put your key in the environment at launch (from your secret manager, not a committed file): `FLEXPRICE_API_KEY=… npm run dev`.
2. Run `npm run flexprice:setup` once with the key set. It creates the customer (`FLEXPRICE_CUSTOMER_ID`, default `flare-demo`) and one metered feature per billable event. Re-running is safe.

Without a key, the credits meter shows **Flexprice: not configured** and everything else works.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `FLARE_DATA_DIR` | `./.flare-data` | Folder for the SQLite file |
| `FLARE_BASE_URL` | `http://localhost:3020` | Base URL the agent calls |
| `FLEXPRICE_API_KEY` | — | Enables Flexprice event sending |
| `FLEXPRICE_API_URL` | `https://us.api.flexprice.io/v1` | Flexprice API host |
| `FLEXPRICE_CUSTOMER_ID` | `flare-demo` | `external_customer_id` on every event |
| `FLARE_PP_CLI` | `realtimex-pp-cli` on PATH | Absolute path to the CLI if it isn't on the server's PATH |
| `FLARE_AGENT_NAME`, `FLARE_RTX_WORKSPACE`, `FLARE_RTX_THREAD` | `claude`, `hackwithbay4`, `flare-agent` | Where the agent session opens |
| `FLARE_RUN_DISPATCH` | on | `off` always shows the copyable brief |

## Project layout

| Path | What |
|---|---|
| `src/app/(intake, icp, leads, outbox, pipeline)` | Pages |
| `src/app/api/` | `agent-tools`, `runs`, `products`, `icp`, `leads`, `messages`, `activity`, `credits`, `usage`, `health` |
| `src/lib/tools/` | The agent tools, zod-validated, with the citation gate |
| `src/lib/metering.ts` | Usage events, credit gate, Flexprice client |
| `src/lib/db/` | Drizzle schema, migrations, seed |
| `src/lib/types.ts` | Shared domain types |
| `agent/` | Agent skill and run brief |
| `design-system/` | Flare design system: tokens, `fl-` component classes, logos |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · radix-ui · Drizzle ORM + better-sqlite3 · zod · vitest.
