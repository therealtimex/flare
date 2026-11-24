// Test fixture only (pipeline.test.ts); the app reads the real API.
// Mock data for UI development until core-dev's read endpoints land on main.
// Everything here is FICTIONAL: invented companies on reserved `.example` domains
// and invented people. No real personal data. Shapes follow src/lib/types.ts.
import type { Account, Activity, Icp, LeadView, Message, Person, Product, QuarantineCounts, Signal, Source } from "@/lib/types";
import type { CreditsView } from "@/lib/types";

const T0 = "2026-11-24T19:40:00.000Z";

export const mockProduct: Product = {
  id: 1,
  name: "Ledgerline",
  website: null,
  description:
    "Accounts-payable automation for mid-market finance teams: invoice capture, 3-way match and approval routing that plugs into NetSuite and QuickBooks.",
  pricing: "$1,200/mo platform + $0.40 per invoice processed",
  customers: ["Regional distributors", "Multi-location clinics", "50–500 employee SaaS companies"],
  createdAt: T0,
  updatedAt: T0,
};

export const mockIcp: Icp = {
  id: 1,
  productId: 1,
  industries: ["Wholesale distribution", "Healthcare services (multi-site)", "B2B SaaS"],
  sizeBands: ["51-200", "201-500"],
  personas: ["Controller", "VP Finance / CFO", "AP Manager"],
  triggers: ["New CFO or Controller hire", "Hiring AP clerks", "ERP migration to NetSuite", "Recent funding round"],
  confidence: { industries: 0.82, sizeBands: 0.76, personas: 0.88, triggers: 0.58 },
  expansions: [
    {
      id: "exp-1",
      segment: "Property management firms",
      rationale:
        "High invoice volume from many vendors per property and frequent approval chains mirror the distributor workflow.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Property_management", quote: "Property management is the operation, control, maintenance, and oversight of real estate" }],
      status: "suggested",
    },
    {
      id: "exp-2",
      segment: "Franchise operators (10+ locations)",
      rationale: "Per-location AP with centralized finance: same pain as multi-site clinics, budget sits with a small finance team.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Franchising" }],
      status: "suggested",
    },
    {
      id: "exp-3",
      segment: "Public sector agencies",
      rationale: "Large AP volume, but procurement cycles are long and the product lacks required compliance certifications.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Government_procurement" }],
      status: "suggested",
    },
  ],
  createdAt: T0,
  updatedAt: T0,
};

const acct = (id: number, name: string, domain: string, industry: string, size: string, hq: string): Account => ({
  id,
  name,
  domain,
  industry,
  size,
  hq,
  status: "active",
  createdAt: T0,
});
const person = (id: number, name: string, title: string, accountId: number, email: string | null, emailStatus: Person["emailStatus"], linkedin: boolean): Person => ({
  id,
  name,
  title,
  accountId,
  linkedinUrl: linkedin ? `https://linkedin.example/in/demo-${id}` : null,
  email,
  emailStatus,
  status: "active",
  createdAt: T0,
});
const sig = (id: number, accountId: number, kind: Signal["kind"], summary: string, date: string): Signal => ({
  id,
  accountId,
  kind,
  summary,
  date,
  status: "active",
  createdAt: T0,
});
let srcId = 0;
const src = (entityType: Source["entityType"], entityId: number, url: string, quote: string | null): Source => ({
  id: ++srcId,
  entityType,
  entityId,
  url,
  quote,
  retrievedAt: T0,
});

const accounts = [
  acct(1, "Northwind Supply Co.", "northwind-supply.example", "Wholesale distribution", "201-500", "Columbus, OH"),
  acct(2, "Harborview Clinics", "harborview-clinics.example", "Healthcare services", "51-200", "Tacoma, WA"),
  acct(3, "Brightpath Software", "brightpath.example", "B2B SaaS", "51-200", "Austin, TX"),
  acct(4, "Keystone Foodservice", "keystone-food.example", "Wholesale distribution", "201-500", "Harrisburg, PA"),
  acct(5, "Cobalt Dental Partners", "cobalt-dental.example", "Healthcare services", "201-500", "Denver, CO"),
  acct(6, "Tinsel Analytics", "tinsel.example", "B2B SaaS", "11-50", "Remote"),
];
const people = [
  person(1, "Dana Whitfield", "Controller", 1, "dana.whitfield@northwind-supply.example", "pattern", true),
  person(2, "Marcus Ibe", "VP Finance", 2, "mibe@harborview-clinics.example", "verified", true),
  person(3, "Priya Natarajan", "CFO", 3, null, "unverified", true),
  person(4, "Tom Reyes", "AP Manager", 4, "tom.reyes@keystone-food.example", "pattern", false),
  person(5, "Lena Ford", "Controller", 5, "lford@cobalt-dental.example", "pattern", true),
  person(6, "Sam Okafor", "Head of Finance", 6, null, "unverified", false),
];
const signals = [
  sig(1, 1, "exec_hire", "Hired a new Controller from a NetSuite shop", "2026-10-28"),
  sig(2, 1, "hiring", "3 open AP Specialist roles", "2026-11-12"),
  sig(3, 2, "expansion", "Opened 4 new clinic locations this year", "2026-09-30"),
  sig(4, 3, "funding", "Raised a $22M Series B", "2026-11-03"),
  sig(5, 4, "tech_change", "Migrating from Sage to NetSuite", "2026-10-15"),
  sig(6, 5, "hiring", "Hiring a Senior AP Accountant", "2026-11-18"),
];
const sources = [
  src("account", 1, "https://northwind-supply.example/about", "Northwind Supply distributes to 1,400 retailers across the Midwest."),
  src("person", 1, "https://northwind-supply.example/team", "Dana Whitfield, Controller"),
  src("person", 1, "https://northwind-supply.example/contact", "Email pattern first.last@northwind-supply.example"),
  src("signal", 1, "https://northwind-supply.example/news/new-controller", "We welcome Dana Whitfield as Controller."),
  src("signal", 2, "https://northwind-supply.example/careers", "AP Specialist (3 openings)"),
  src("account", 2, "https://harborview-clinics.example/locations", "Now serving 11 locations in Puget Sound."),
  src("person", 2, "https://harborview-clinics.example/leadership", "Marcus Ibe, VP Finance. Contact: mibe@harborview-clinics.example"),
  src("signal", 3, "https://harborview-clinics.example/news", "Four new clinics opened in 2026."),
  src("account", 3, "https://brightpath.example/about", "Brightpath builds scheduling software for field teams."),
  src("person", 3, "https://brightpath.example/team", "Priya Natarajan, CFO"),
  src("signal", 4, "https://brightpath.example/blog/series-b", "Brightpath raises $22M Series B."),
  src("account", 4, "https://keystone-food.example/", "Foodservice distribution across Pennsylvania."),
  src("person", 4, "https://keystone-food.example/team", "Tom Reyes, AP Manager"),
  src("signal", 5, "https://keystone-food.example/careers/netsuite-admin", "NetSuite Administrator to lead our migration from Sage."),
  src("account", 5, "https://cobalt-dental.example/about", "A partnership of 38 dental practices."),
  src("person", 5, "https://cobalt-dental.example/leadership", "Lena Ford, Controller"),
  src("signal", 6, "https://cobalt-dental.example/careers", "Senior AP Accountant"),
  src("account", 6, "https://tinsel.example/", "Tinsel: analytics for retail ops."),
  src("person", 6, "https://tinsel.example/about", "Sam Okafor leads finance."),
];

const leadRows: [id: number, personId: number, fit: number, tier: LeadView["tier"], stage: LeadView["stage"], owner: LeadView["ownerKind"], rationale: string][] = [
  [1, 1, 92, "A", "contacted", "agent", "Distributor at 201-500, new Controller and AP hiring: both top triggers."],
  [2, 2, 86, "A", "replied", "rep", "Multi-site clinic group expanding; VP Finance with a verified email."],
  [3, 3, 71, "B", "matched", "agent", "SaaS at 51-200 with fresh Series B; CFO persona, email unverified."],
  [4, 4, 78, "B", "matched", "agent", "ERP migration to NetSuite is a direct trigger; AP Manager is a secondary persona."],
  [5, 5, 81, "A", "meeting_booked", "rep", "Dental partnership with 38 locations hiring in AP."],
  [6, 6, 44, "C", "closed_lost", "agent", "Below size band; no trigger found."],
];

export const mockLeads: LeadView[] = leadRows.map(([id, personId, fitScore, tier, stage, ownerKind, rationale]) => {
  const p = people.find((x) => x.id === personId)!;
  const a = accounts.find((x) => x.id === p.accountId) ?? null;
  const s = signals.filter((x) => x.accountId === a?.id);
  const srcs = sources.filter(
    (x) =>
      (x.entityType === "person" && x.entityId === p.id) ||
      (x.entityType === "account" && x.entityId === a?.id) ||
      (x.entityType === "signal" && s.some((y) => y.id === x.entityId)),
  );
  return { id, personId, productId: 1, fitScore, tier, rationale, stage, ownerKind, createdAt: T0, updatedAt: T0, person: p, account: a, signals: s, sources: srcs };
});

export const mockQuarantine: QuarantineCounts = { accounts: 2, people: 3, signals: 1 };

const msg = (id: number, leadId: number, channel: Message["channel"], step: Message["step"], variant: Message["variant"], subject: string | null, body: string, signalsUsed: number[], status: Message["status"] = "draft"): Message => ({
  id,
  leadId,
  channel,
  step,
  variant,
  subject,
  body,
  signalsUsed,
  status,
  decidedBy: status === "draft" ? null : "rep",
  decidedAt: status === "draft" ? null : T0,
  createdAt: T0,
  updatedAt: T0,
});

export const mockMessages: Message[] = [
  msg(1, 1, "email", 1, "A", "Congrats on the new Controller seat, Dana",
    "Hi Dana,\n\nSaw you joined Northwind as Controller, and that the team is hiring three AP specialists. Teams in that spot usually feel invoice volume before headcount catches up.\n\nLedgerline does capture, 3-way match and approval routing inside NetSuite, so new hires review exceptions instead of keying invoices.\n\nWorth a 20-minute look next week?\n\n– Ledgerline", [1, 2]),
  msg(2, 1, "email", 1, "B", "3 AP openings at Northwind",
    "Hi Dana,\n\nThree open AP roles is a lot of invoices. Before you fill them, would it help to see how distributors your size cut manual entry by ~70%?\n\n– Ledgerline", [2]),
  msg(3, 3, "linkedin", 1, "A", null,
    "Hi Priya, congrats on Brightpath's Series B. As finance scales after a raise, AP is usually the first process to creak. Happy to share what we see at 50–200 person SaaS teams.", [4]),
  msg(4, 4, "email", 1, "A", "Sage → NetSuite, and your AP queue",
    "Hi Tom,\n\nNoticed Keystone is moving from Sage to NetSuite. A migration is the cheapest moment to fix invoice routing. Ledgerline plugs into NetSuite on day one.\n\nOpen to a short call?\n\n– Ledgerline", [5]),
  msg(5, 2, "email", 2, "A", "Re: AP across 11 clinics",
    "Hi Marcus,\n\nFollowing up with the per-location approval flow we discussed. It maps to your 4 new clinics without adding finance headcount.\n\n– Ledgerline", [3], "approved"),
];

export const mockActivity: Activity[] = [
  { id: 1, actorKind: "agent", tool: "get_product", summary: "Read product brief for Ledgerline", entityType: "product", entityId: 1, leadId: null, data: null, createdAt: "2026-11-24T19:40:02.000Z" },
  { id: 2, actorKind: "agent", tool: "save_icp", summary: "Saved ICP: 3 industries, 3 personas, 3 expansion segments", entityType: "icp", entityId: 1, leadId: null, data: null, createdAt: "2026-11-24T19:40:31.000Z" },
  { id: 3, actorKind: "agent", tool: "upsert_lead", summary: "Scored Dana Whitfield (Northwind Supply) 92 · tier A", entityType: "lead", entityId: 1, leadId: 1, data: null, createdAt: "2026-11-24T19:42:10.000Z" },
  { id: 4, actorKind: "agent", tool: "move_stage", summary: "Northwind Supply: Matched → Contacted", entityType: "lead", entityId: 1, leadId: 1, data: { from: "matched", to: "contacted" }, createdAt: "2026-11-24T19:43:00.000Z" },
  { id: 5, actorKind: "rep", tool: "move_stage", summary: "Cobalt Dental: Replied → Meeting Booked", entityType: "lead", entityId: 5, leadId: 5, data: { from: "replied", to: "meeting_booked" }, createdAt: "2026-11-24T19:44:00.000Z" },
];

export const mockCredits: CreditsView = { balance: 420, allotment: 500, flexprice: "not_configured" };
