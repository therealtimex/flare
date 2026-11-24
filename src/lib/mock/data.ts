// Mock data for UI development before core-dev's read endpoints land.
// Only public, non-personal content. Replace via src/lib/client/* when APIs exist.
import type { Activity, Credits, Icp, Product } from "./types";

export const mockProduct: Product = {
  id: "prod_demo",
  name: "Ledgerline",
  description:
    "Accounts-payable automation for mid-market finance teams: invoice capture, 3-way match and approval routing that plugs into NetSuite and QuickBooks.",
  pricing: "$1,200/mo platform + $0.40 per invoice processed",
  customers: "Regional distributors, multi-location clinics, 50–500 employee SaaS companies",
};

export const mockIcp: Icp = {
  id: "icp_demo",
  productId: "prod_demo",
  industries: [
    { value: "Wholesale distribution", confidence: 0.86 },
    { value: "Healthcare services (multi-site)", confidence: 0.72 },
    { value: "B2B SaaS", confidence: 0.64 },
    { value: "Construction", confidence: 0.38 },
  ],
  sizeBands: [
    { value: "51–200 employees", confidence: 0.81 },
    { value: "201–500 employees", confidence: 0.74 },
    { value: "501–1,000 employees", confidence: 0.41 },
  ],
  personas: [
    { value: "Controller", confidence: 0.88 },
    { value: "VP Finance / CFO", confidence: 0.77 },
    { value: "AP Manager", confidence: 0.69 },
  ],
  triggers: [
    { value: "New CFO or Controller hire", confidence: 0.83 },
    { value: "Hiring AP clerks (volume pain)", confidence: 0.71 },
    { value: "ERP migration to NetSuite", confidence: 0.66 },
    { value: "Recent funding round", confidence: 0.52 },
  ],
  expansions: [
    {
      id: "exp_1",
      segment: "Property management firms",
      rationale:
        "High invoice volume from many vendors per property and frequent approval chains mirror the distributor workflow.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Property_management", quote: "Property management is the operation, control, maintenance, and oversight of real estate" }],
      status: "suggested",
    },
    {
      id: "exp_2",
      segment: "Franchise operators (10+ locations)",
      rationale: "Per-location AP with centralized finance: same pain as multi-site clinics, budget sits with a small finance team.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Franchising" }],
      status: "suggested",
    },
    {
      id: "exp_3",
      segment: "Public sector agencies",
      rationale: "Large AP volume, but procurement cycles are long and the product lacks required compliance certifications.",
      sources: [{ url: "https://en.wikipedia.org/wiki/Government_procurement" }],
      status: "suggested",
    },
  ],
  updatedAt: "2026-11-24T19:40:00.000Z",
};

export const mockActivity: Activity[] = [
  { id: "a1", actorKind: "agent", tool: "get_product", summary: "Read product brief for Ledgerline", createdAt: "2026-11-24T19:40:02.000Z" },
  { id: "a2", actorKind: "agent", tool: "save_icp", summary: "Saved ICP: 4 industries, 3 personas, 3 expansion segments", createdAt: "2026-11-24T19:40:31.000Z" },
  { id: "a3", actorKind: "rep", tool: "product.save", summary: "Edited pricing on the product brief", createdAt: "2026-11-24T19:41:10.000Z" },
];

export const mockCredits: Credits = { balance: 420, allotment: 500, flexprice: "not_configured" };
