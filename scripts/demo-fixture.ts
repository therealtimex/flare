// Loads a FICTIONAL demo dataset into a running Flare server, the same way the
// GTM agent would (POST /api/agent-tools/invoke), then plays the rep through
// the UI routes (approve/reject drafts, move leads through the pipeline).
//
// Every company, person, email and URL here is invented. Domains use the
// reserved .example TLD (RFC 2606), so nothing points at a real person.
//
//   npm run db:migrate && npm run seed      # fresh FLARE_DATA_DIR recommended
//   FLARE_URL=http://localhost:3020 npm run demo:fixture
//
// Run against a server started with FLARE_RUN_DISPATCH=off. Refuses to load
// twice into a database that already has leads.

const BASE = (process.env.FLARE_URL ?? "http://localhost:3020").replace(/\/$/, "");

type Json = Record<string, unknown>;

async function http(path: string, method: string, body?: unknown): Promise<Json> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${String(data.error ?? JSON.stringify(data))}`);
  return data;
}

async function tool(name: string, input: Json): Promise<Json> {
  const r = await http("/api/agent-tools/invoke", "POST", { tool: name, input });
  return (r.result ?? {}) as Json;
}

const idOf = (r: Json, key: string): number => {
  const v = (r[key] as Json | undefined)?.id ?? r.id;
  if (typeof v !== "number") throw new Error(`No ${key}.id in ${JSON.stringify(r)}`);
  return v;
};

const note = (summary: string) => tool("log_note", { summary });

// ---- fictional dataset ----
type AccountSeed = { key: string; name: string; domain: string; industry: string; size: string; hq: string };
const ACCOUNTS: AccountSeed[] = [
  { key: "northwind", name: "Northwind Inference", domain: "northwind-inference.example", industry: "AI infrastructure", size: "51-200", hq: "San Francisco, CA" },
  { key: "tidepool", name: "Tidepool Vector", domain: "tidepool-vector.example", industry: "AI infrastructure", size: "11-50", hq: "Seattle, WA" },
  { key: "brightforge", name: "Brightforge APIs", domain: "brightforge.example", industry: "Developer tools", size: "51-200", hq: "Austin, TX" },
  { key: "quarry", name: "Quarry Cloud", domain: "quarry-cloud.example", industry: "Developer tools", size: "201-500", hq: "Denver, CO" },
  { key: "lumen", name: "Lumen Ledger", domain: "lumen-ledger.example", industry: "Data platforms", size: "51-200", hq: "New York, NY" },
  { key: "cobalt", name: "Cobalt Metrics", domain: "cobalt-metrics.example", industry: "Data platforms", size: "11-50", hq: "Boston, MA" },
];

const src = (domain: string, path: string, quote?: string) => ({ url: `https://${domain}/${path}`, ...(quote ? { quote } : {}) });

const SIGNALS: { account: string; kind: string; summary: string; date: string; path: string; quote: string }[] = [
  { account: "northwind", kind: "funding", summary: "Raised a $24M Series A to scale its hosted inference API", date: "2026-10-14", path: "news/series-a", quote: "We raised $24M to bring per-token inference to every team." },
  { account: "northwind", kind: "hiring", summary: "Hiring a Head of Billing Systems", date: "2026-11-02", path: "careers/head-of-billing", quote: "Own usage metering and invoicing for our API." },
  { account: "tidepool", kind: "product_launch", summary: "Launched a pay-per-query vector search tier", date: "2026-11-05", path: "blog/pay-per-query", quote: "Pay only for the queries you run." },
  { account: "brightforge", kind: "tech_change", summary: "Moving from seat pricing to usage-based API credits", date: "2026-10-28", path: "changelog/credits", quote: "Seats are going away; credits are coming." },
  { account: "quarry", kind: "exec_hire", summary: "Appointed a new CFO from a public cloud company", date: "2026-09-30", path: "press/new-cfo", quote: "Our new CFO will lead pricing and monetization." },
  { account: "lumen", kind: "expansion", summary: "Opened an EU region with metered storage pricing", date: "2026-10-20", path: "blog/eu-region", quote: "EU customers are billed per GB-month." },
  { account: "cobalt", kind: "news", summary: "Published a post on billing pain at 10M events/day", date: "2026-08-12", path: "blog/billing-at-scale", quote: "Our homegrown billing broke at 10M events a day." },
];

type PersonSeed = { account: string; name: string; title: string; handle: string; email: string; emailStatus: "verified" | "pattern" | "unverified" };
const PEOPLE: PersonSeed[] = [
  { account: "northwind", name: "Maya Okonkwo-Reyes", title: "VP Engineering", handle: "maya", email: "maya@northwind-inference.example", emailStatus: "verified" },
  { account: "northwind", name: "Theo Lindqvist", title: "Head of Finance", handle: "theo", email: "theo@northwind-inference.example", emailStatus: "pattern" },
  { account: "tidepool", name: "Priya Halvorsen", title: "Co-founder & CTO", handle: "priya", email: "priya@tidepool-vector.example", emailStatus: "verified" },
  { account: "brightforge", name: "Jonah Abernathy", title: "Head of Product", handle: "jonah", email: "jonah@brightforge.example", emailStatus: "pattern" },
  { account: "quarry", name: "Selma Vantongeren", title: "CFO", handle: "selma", email: "selma@quarry-cloud.example", emailStatus: "verified" },
  { account: "quarry", name: "Rafael Quintero-Moss", title: "Director of Platform", handle: "rafael", email: "rafael@quarry-cloud.example", emailStatus: "unverified" },
  { account: "lumen", name: "Ingrid Castellanos", title: "VP Revenue Operations", handle: "ingrid", email: "ingrid@lumen-ledger.example", emailStatus: "pattern" },
  { account: "cobalt", name: "Dev Ramaswamy-Ortiz", title: "Founding Engineer", handle: "dev", email: "dev@cobalt-metrics.example", emailStatus: "verified" },
];

// fitScore + tier per person handle
const LEADS: Record<string, { fitScore: number; tier: "A" | "B" | "C"; rationale: string }> = {
  maya: { fitScore: 92, tier: "A", rationale: "AI infrastructure, 51-200, VP Engineering; fresh Series A and a billing-systems hire." },
  priya: { fitScore: 86, tier: "A", rationale: "AI infrastructure; just launched pay-per-query pricing; CTO owns metering." },
  jonah: { fitScore: 81, tier: "A", rationale: "Developer tools moving from seats to usage credits; Head of Product owns pricing." },
  selma: { fitScore: 68, tier: "B", rationale: "Developer tools, 201-500; new CFO tasked with monetization." },
  ingrid: { fitScore: 63, tier: "B", rationale: "Data platform adding metered EU storage; RevOps runs invoicing." },
  theo: { fitScore: 58, tier: "B", rationale: "Same account as a Tier A lead; finance buyer, secondary persona." },
  dev: { fitScore: 44, tier: "C", rationale: "Billing pain is public, but 11-50 and an engineer, not a buyer persona." },
  rafael: { fitScore: 38, tier: "C", rationale: "Platform director; unverified email and no direct pricing signal." },
};

// Drafts: [handle, variant, channel, subject, body]
const DRAFTS: [string, "A" | "B", "email" | "linkedin", string | undefined, string][] = [
  ["maya", "A", "email", "Metering for Northwind's per-token API", "Hi Maya,\n\nCongrats on the Series A. Teams scaling a per-token API usually hit billing limits right after a raise. Flexprice meters usage events and invoices on credits, so your new billing hire starts with a working system.\n\nWorth a 20-minute look?"],
  ["maya", "B", "email", "Before your Head of Billing starts", "Hi Maya,\n\nSaw you're hiring a Head of Billing Systems. Open-source metering could give them a running start instead of a rebuild. Happy to share how other inference APIs set it up."],
  ["priya", "A", "email", "Pay-per-query, without building billing", "Hi Priya,\n\nThe pay-per-query tier looks great. Flexprice can meter each query and turn it into invoices and credit balances, so your team keeps shipping search features.\n\nOpen to a quick call?"],
  ["priya", "B", "linkedin", undefined, "Hi Priya, congrats on the pay-per-query launch. We help vector DB teams meter usage and bill on it. Open to comparing notes?"],
  ["jonah", "A", "email", "Seats to credits at Brightforge", "Hi Jonah,\n\nRead the changelog on moving to usage credits. Migrations like that go smoother with metering and credit grants already in place. Want to see how Flexprice handles the switch?"],
  ["jonah", "B", "email", "Your credits migration", "Hi Jonah,\n\nQuick one: who owns the credits rollout? We've helped API companies move off seats in weeks, not quarters."],
  ["selma", "A", "email", "Monetization in your first 90 days", "Hi Selma,\n\nCongrats on the CFO role at Quarry Cloud. Usage-based pricing is often a new CFO's first lever. Flexprice gives finance a clean usage-to-invoice trail. Worth a conversation?"],
];

async function main() {
  const ctx = await tool("get_product", {});
  const product = ctx.product as Json | null;
  if (!product) throw new Error("No product. Run `npm run db:migrate && npm run seed` first.");
  if (Number(ctx.leadCount ?? 0) > 0) {
    console.log(`Database at ${BASE} already has ${String(ctx.leadCount)} leads; not loading the fixture twice.`);
    return;
  }
  const productId = product.id as number;

  await note("Reading the Flexprice brief and inferring the ICP from public pricing pages.");
  const icpRes = await tool("save_icp", {
    productId,
    industries: ["AI infrastructure", "Developer tools", "Data platforms"],
    sizeBands: ["11-50", "51-200", "201-500"],
    personas: ["VP Engineering", "CTO", "Head of Product", "CFO", "VP Revenue Operations"],
    triggers: ["Raised a round in the last 6 months", "Launched usage-based pricing", "Hiring for billing or pricing"],
    confidence: { industries: 0.86, sizeBands: 0.72, personas: 0.64, triggers: 0.41 },
    expansions: [
      {
        segment: "Vertical SaaS adding AI features",
        rationale: "Teams bolting on AI features start charging per generation and need metering.",
        sources: [src("saas-pricing-review.example", "2026/ai-addons", "Most AI add-ons launched this year are priced per use.")],
      },
      {
        segment: "IoT platforms billing per device-hour",
        rationale: "Device telemetry is metered usage at high event volume.",
        sources: [src("iot-weekly.example", "issues/212", "Per-device-hour billing is replacing flat plans.")],
      },
    ],
  });
  const expansions = ((icpRes.icp as Json).expansions ?? []) as { id: string }[];

  await note("ICP saved. Searching public news and job posts for accounts with usage-pricing signals.");
  const accountIds: Record<string, number> = {};
  for (const a of ACCOUNTS) {
    const r = await tool("add_account", {
      name: a.name,
      domain: a.domain,
      industry: a.industry,
      size: a.size,
      hq: a.hq,
      sources: [src(a.domain, "about", `${a.name} is headquartered in ${a.hq}.`)],
    });
    accountIds[a.key] = idOf(r, "account");
  }
  // Citation gate demo: an account and a person with no source get quarantined.
  await tool("add_account", { name: "Halcyon Meter Co", domain: "halcyon-meter.example", industry: "Developer tools", size: "11-50", hq: "Unknown", sources: [] });

  const signalIds: Record<string, number[]> = {};
  for (const s of SIGNALS) {
    const r = await tool("add_signal", {
      accountId: accountIds[s.account],
      kind: s.kind,
      summary: s.summary,
      date: s.date,
      sources: [src(ACCOUNTS.find((a) => a.key === s.account)!.domain, s.path, s.quote)],
    });
    (signalIds[s.account] ??= []).push(idOf(r, "signal"));
  }

  await note("Found 6 cited accounts. Looking up buyers on team pages and checking email patterns.");
  const personIds: Record<string, number> = {};
  const accountOf: Record<string, string> = {};
  for (const p of PEOPLE) {
    const domain = ACCOUNTS.find((a) => a.key === p.account)!.domain;
    const r = await tool("add_person", {
      name: p.name,
      title: p.title,
      accountId: accountIds[p.account],
      linkedinUrl: `https://social.example/in/${p.handle}-${p.account}`,
      email: p.email,
      emailStatus: p.emailStatus,
      sources: [
        src(domain, "team", `${p.name}, ${p.title}`),
        src(domain, "contact", p.emailStatus === "pattern" ? `Email pattern: first@${domain}` : `Contact: ${p.email}`),
      ],
    });
    personIds[p.handle] = idOf(r, "person");
    accountOf[p.handle] = p.account;
  }
  await tool("add_person", { name: "Unnamed Contact", title: "Billing Lead", accountDomain: "cobalt-metrics.example", email: "billing@cobalt-metrics.example", emailStatus: "unverified", sources: [] });

  await note("Scoring 8 people against the ICP: fit, persona and recent signals.");
  const leadIds: Record<string, number> = {};
  for (const [handle, l] of Object.entries(LEADS)) {
    const r = await tool("upsert_lead", { personId: personIds[handle], productId, ...l });
    leadIds[handle] = idOf(r, "lead");
  }

  await note("Drafting A/B openers for the top leads. Nothing sends without a rep's approval.");
  const messageIds: Record<string, number> = {};
  for (const [handle, variant, channel, subject, body] of DRAFTS) {
    const r = await tool("draft_message", {
      leadId: leadIds[handle],
      channel,
      step: 1,
      variant,
      ...(subject ? { subject } : {}),
      body,
      signalsUsed: (signalIds[accountOf[handle]] ?? []).slice(0, 1),
    });
    messageIds[`${handle}-${variant}`] = idOf(r, "message");
  }
  await note("7 drafts are waiting in the Outbox for review.");

  // ---- the rep ----
  if (expansions[0]) await http(`/api/icp/expansions/${encodeURIComponent(expansions[0].id)}?productId=${productId}`, "PATCH", { status: "accepted" });

  await http(`/api/messages/${messageIds["maya-A"]}`, "PATCH", { status: "approved", decidedBy: "rep" });
  await http(`/api/messages/${messageIds["jonah-A"]}`, "PATCH", { status: "approved", decidedBy: "rep" });
  await http(`/api/messages/${messageIds["jonah-B"]}`, "PATCH", { status: "rejected", decidedBy: "rep" });

  const move = (handle: string, ...stages: string[]) =>
    stages.reduce<Promise<unknown>>((p, stage) => p.then(() => http(`/api/leads/${leadIds[handle]}/stage`, "PATCH", { stage })), Promise.resolve());
  await move("maya", "contacted", "replied", "meeting_booked", "closed_won");
  await move("jonah", "contacted", "replied", "meeting_booked");
  await move("priya", "contacted", "replied");
  await move("selma", "contacted");
  await move("rafael", "contacted", "closed_lost");

  // ---- the agent reacts to the rep's decisions ----
  await note("Rep won Northwind Inference and booked Brightforge. Both are usage-pricing changes after a trigger event.");
  await tool("upsert_lead", {
    personId: personIds.ingrid,
    productId,
    fitScore: 71,
    tier: "B",
    rationale: "Re-scored up: metered EU storage matches the pattern of the two won/booked accounts.",
  });
  await note("Rep rejected the short Brightforge opener (B). Next drafts lead with the signal, like variant A.");

  console.log(
    `Loaded fictional demo data into ${BASE}: ${ACCOUNTS.length} accounts, ${PEOPLE.length} people, ${SIGNALS.length} signals, ` +
      `${Object.keys(leadIds).length} leads, ${DRAFTS.length} drafts (2 approved, 1 rejected), 2 quarantined records.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
