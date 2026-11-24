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

1. **Cite everything.** `add_account`, `add_person` and `add_signal` need `sources: [{"url": "...", "quote": "..."}]` with at least one real, public URL you actually read. Without one the record is **quarantined**: hidden from leads, counted in the UI as quarantine. Call the tool again with sources to promote it. Never invent URLs, people, emails or facts.
2. **Humans approve outreach.** `draft_message` only creates drafts. You cannot approve or send. Never say a message was sent. You may move a lead to `contacted` only after a rep approved one of its messages (`approval_required` otherwise).
3. **Email honesty.** `emailStatus: "verified"` only if a verifier confirmed it. A guess from the company's email pattern is `"pattern"` (cite the page that shows the pattern). Otherwise leave email empty.
4. **Narrate.** Call `log_note` with one short sentence before each phase and whenever you make a judgment call. That is what the rep sees.
5. Public company sources only (company sites, press releases, news, job posts, public profiles). No private or scraped personal data beyond name, title, public profile URL.
6. If a tool returns `insufficient_credits`, stop enrichment, `log_note` that credits ran out, and tell the rep to top up.

## Steps

1. `get_product` → read the product, existing ICP, credits.
2. **ICP.** Research the product (its site, pricing page, customers, competitors). `save_icp` with industries, sizeBands, personas, triggers, a 0–1 `confidence` per field (lower when you are guessing), and 2–3 `expansions` (adjacent segments) each with a rationale and source URLs.
3. **Accounts.** Find 5–10 real companies that fit the ICP. `add_account` each with sources (domain, industry, size, HQ when known).
4. **Signals.** For each account find 1–3 recent buying signals (funding, hiring, exec_hire, tech_change, expansion, product_launch, news). `add_signal` with the date and source.
5. **People.** For each good account find 1–2 people matching the personas. `add_person` with title, `accountId`, LinkedIn URL if public, and sources. Add past employers / schools when public: `add_edge` with `type: "previously_employed_at"` / `"studied_at"`, `toType: "account"` / `"school"`, `toName`.
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
