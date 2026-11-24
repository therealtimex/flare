// Idempotent Flexprice bootstrap: the demo customer + one metered feature
// (SUM of properties.units) per Flare usage event. Safe to re-run.
// Needs FLEXPRICE_API_KEY in the environment; inject it, never write it to a file:
//   rtxexec --env FLEXPRICE_API_KEY=secret://<ref> -- npm run flexprice:setup
import { flexpriceConfig } from "../src/lib/metering";
import { USAGE_EVENTS, type UsageEventName } from "../src/lib/types";

const cfg = flexpriceConfig();
if (!cfg.apiKey) {
  console.error("FLEXPRICE_API_KEY is not set. Nothing to do (metering stays local).");
  process.exit(1);
}
const key = cfg.apiKey;

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

function fail(step: string, r: { status: number; json: unknown }): never {
  const msg = typeof r.json === "object" && r.json ? JSON.stringify(r.json).slice(0, 300) : String(r.json).slice(0, 300);
  console.error(`✗ ${step}: HTTP ${r.status} ${msg}`);
  process.exit(1);
}

const FEATURE_NAMES: Record<UsageEventName, string> = {
  lead_enriched: "Leads enriched",
  outreach_sent: "Outreach approved",
  graph_query: "Graph queries",
};

async function main() {
  console.log(`Flexprice ${cfg.apiUrl} · customer ${cfg.customerId}`);

  const c = await api("GET", `/customers/external/${encodeURIComponent(cfg.customerId)}`);
  if (c.status === 200) console.log(`✓ customer ${cfg.customerId} exists`);
  else if (c.status === 404) {
    const created = await api("POST", "/customers", { external_id: cfg.customerId, name: "Flare demo" });
    if (created.status >= 300) fail("create customer", created);
    console.log(`+ created customer ${cfg.customerId}`);
  } else fail("get customer", c);

  for (const event of USAGE_EVENTS) {
    const lookupKey = `flare_${event}`;
    const found = await api("POST", "/features/search", { lookup_keys: [lookupKey], limit: 10 });
    if (found.status >= 300) fail(`search feature ${lookupKey}`, found);
    const items = ((found.json as { items?: unknown[] })?.items ?? []) as { id?: string; lookup_key?: string }[];
    if (items.some((f) => f.lookup_key === lookupKey)) {
      console.log(`✓ feature ${lookupKey} exists`);
      continue;
    }
    const created = await api("POST", "/features", {
      name: FEATURE_NAMES[event],
      lookup_key: lookupKey,
      type: "metered",
      description: `Flare usage event "${event}" (sum of properties.units)`,
      unit_singular: "credit",
      unit_plural: "credits",
      meter: {
        name: FEATURE_NAMES[event],
        event_name: event,
        aggregation: { type: "SUM", field: "units" },
        reset_usage: "BILLING_PERIOD",
      },
    });
    if (created.status >= 300) fail(`create feature ${lookupKey}`, created);
    console.log(`+ created metered feature ${lookupKey} (event ${event}, SUM units)`);
  }
  console.log("Flexprice setup done.");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
