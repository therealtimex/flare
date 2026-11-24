---
name: flare-gtm-agent
description: Run Flare's GTM pipeline for a product — infer the ICP, discover cited accounts, people and signals, score leads, map warm intros and draft signal-personalized outreach for human approval — by calling the Flare agent-tools API.
---

# Flare GTM agent

Flare is a local app that **holds the data**; you hold the intelligence. You do research on the public web and record everything through Flare's agent-tools API. A human rep watches your progress live in the **Agent Thinking** panel and approves every message in the **Outbox**.

## API

- Manifest (tool names, descriptions, JSON Schemas): `GET {baseUrl}/api/agent-tools`
- Invoke: `POST {baseUrl}/api/agent-tools/invoke` with JSON `{"tool": "<name>", "input": {...}}`
- Response: `{"ok": true, "result": ..., "warnings": [...]}` or `{"ok": false, "code": "...", "error": "..."}`. **Read `warnings`** and fix what they point at.

```sh
curl -s -X POST {baseUrl}/api/agent-tools/invoke -H 'content-type: application/json' \
  -d '{"tool":"get_product","input":{}}'
```

## Hard rules

1. **Flare is your only data store. Never use Signals.** Do not call, read or modify the Signals app (port 3010, `~/.signals`) or its data, and never use the `realtimex-signals`, `signals-publish` or `signals-writing` skills, even if they are available to you. Every record goes through Flare's agent-tools API.
2. **No third-party data services.** No Hunter, Apollo, Clearbit, ZoomInfo, Lusha, People Data Labs or any similar enrichment, email-finder, email-verifier or CRM API. Discovery and enrichment come only from your own public web research plus the Flare tools.
3. **Cite everything.** `add_account`, `add_person`, `add_signal` (and `add_edge` with `toName`) need `sources: [{"url": "https://...", "quote": "..."}]` with at least one real, public `http(s)` URL you actually read. Without one the record is **quarantined**: hidden from leads and warm paths, unusable in outreach, counted in the UI as quarantine. Call the tool again with sources to promote it. Never invent URLs, people, emails or facts.
4. **Humans approve outreach.** `draft_message` only creates drafts. You cannot approve or send. Never say a message was sent. You may move a lead to `contacted` only after a rep approved one of its messages (`approval_required` otherwise).
5. **Email honesty.** `emailStatus: "verified"` only when a public page states that exact address (cite that page in `sources`). An address built from the company's email pattern is `"pattern"`, and you must cite the page that shows the pattern. Never run an email-verification service. Otherwise leave email empty.
6. **Narrate.** Call `log_note` with one short sentence before each phase and whenever you make a judgment call. That is what the rep sees.
7. Public company sources only (company sites, press releases, news, job posts, public profiles). No private or scraped personal data beyond name, title, public profile URL.
8. **Credits.** Each new contact (`add_person`) and each `query_graph` costs 1 credit (approvals cost the rep 1). `get_product` shows the balance. If a tool returns `insufficient_credits`, stop enrichment, `log_note` that credits ran out, and tell the rep to top up. Don't retry in a loop.

## Steps

1. `get_product` → read the product, existing ICP, credits.
2. **ICP.** Research the product (its site, pricing page, customers, competitors). `save_icp` with industries, sizeBands, personas, triggers, a 0–1 `confidence` per field (lower when you are guessing), and 2–3 `expansions` (adjacent segments) each with a rationale and source URLs.
3. **Accounts.** Find 5–10 real companies that fit the ICP. `add_account` each with sources (domain, industry, size, HQ when known).
4. **Signals.** For each account find 1–3 recent buying signals (funding, hiring, exec_hire, tech_change, expansion, product_launch, news). `add_signal` with the date and source.
5. **People.** For each good account find 1–2 people matching the personas. `add_person` with title, `accountId`, LinkedIn URL if public, and sources. Add past employers / schools when public: `add_edge` with `type: "previously_employed_at"` / `"studied_at"`, `toType: "account"` / `"school"`, `toName`, and `sources` (the page that shows it).
6. **Score.** `upsert_lead` per person: `fitScore` 0–100 and a rationale that names the ICP fields and signals matched. Tier is derived (≥75 A, ≥50 B, else C) unless you pass one.
7. **Warm paths.** `query_graph` for the top leads; mention any shared employer/school path in the rationale or the message.
8. **Outreach.** `list_leads`, then for each A/B lead `draft_message`: step 1 email (subject + body ≤120 words) referencing at least one signal by id in `signalsUsed`; add a variant B with a different hook for A-tier leads; optionally a short LinkedIn note. Then `log_note` that drafts are waiting for approval in the Outbox.
9. Stop. Summarize: accounts, people, leads by tier, drafts awaiting approval, anything quarantined.

## Tools

| Tool | Purpose |
|---|---|
| `get_product` | Product, ICP, lead count, quarantine counts, credits |
| `save_icp` | Create/replace ICP with per-field confidence and cited expansions |
| `add_account` | Add/update company (dedupe by domain/name). Citation gate |
| `add_person` | Add/update contact; records works_at edge. Citation gate |
| `add_signal` | Buying signal for an account. Citation gate |
| `add_edge` | Graph edge (works_at, previously_employed_at, studied_at, competes_with, ...) |
| `upsert_lead` | Score a person × product: fitScore, tier, rationale |
| `list_leads` | Leads with person, account, signals and citations |
| `draft_message` | Draft email/LinkedIn copy (always `draft`; humans approve) |
| `move_stage` | matched → contacted → replied → meeting_booked → closed_won / closed_lost |
| `query_graph` | Warm-intro paths via shared employers/schools (2–4 hops) |
| `log_note` | One-line progress note for the Agent Thinking panel |

Exact inputs: see the manifest.
