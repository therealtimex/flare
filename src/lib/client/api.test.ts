import { afterEach, describe, expect, it, vi } from "vitest";
import { decideExpansion, decideMessage, getProduct, listLeads, moveStage, runGtmAgent, saveProduct, subscribe, topUpCredits } from "./api";

type Call = { url: string; method: string; body: unknown };
function stub(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const c = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(c);
      return respond(c);
    }),
  );
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("reads", () => {
  it("getProduct returns null on 404", async () => {
    stub(() => Response.json({ error: "No product yet" }, { status: 404 }));
    expect(await getProduct()).toBeNull();
  });
  it("listLeads returns the LeadsResponse and throws server errors", async () => {
    stub(() => Response.json({ leads: [], quarantine: { accounts: 1, people: 0, signals: 0 }, quarantineCount: 1 }));
    expect((await listLeads()).quarantineCount).toBe(1);
    stub(() => Response.json({ error: "boom" }, { status: 500 }));
    await expect(listLeads()).rejects.toThrow("boom");
  });
});

describe("writes hit the right routes and invalidate", () => {
  it("saveProduct PUTs an existing product and POSTs a new one", async () => {
    const calls = stub(() => Response.json({ id: 1 }));
    const input = { name: "X", description: "d", pricing: null, customers: ["a"] };
    await saveProduct(1, input);
    await saveProduct(null, input);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["PUT /api/products/1", "POST /api/products"]);
    expect(calls[0].body).toEqual(input);
  });

  it("decideExpansion PATCHes with productId and the patch", async () => {
    const calls = stub(() => Response.json({}));
    const seen = vi.fn();
    const off = subscribe(seen);
    await decideExpansion(7, "exp-1", "accepted", { segment: "S" });
    off();
    expect(calls[0]).toEqual({ url: "/api/icp/expansions/exp-1?productId=7", method: "PATCH", body: { status: "accepted", segment: "S" } });
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("decideMessage sends status + edits as rep; 402 surfaces as an error and still invalidates", async () => {
    const calls = stub(() => Response.json({}));
    await decideMessage(3, "approved", { subject: "s", body: "b" });
    expect(calls[0]).toEqual({ url: "/api/messages/3", method: "PATCH", body: { subject: "s", body: "b", status: "approved", decidedBy: "rep" } });
    stub(() => Response.json({ error: "Out of credits" }, { status: 402 }));
    const seen = vi.fn();
    const off = subscribe(seen);
    await expect(decideMessage(3, "approved")).rejects.toThrow("Out of credits");
    off();
    expect(seen).toHaveBeenCalled();
  });

  it("moveStage and topUpCredits", async () => {
    const calls = stub(() => Response.json({}));
    await moveStage(4, "replied");
    await topUpCredits(100);
    expect(calls).toEqual([
      { url: "/api/leads/4/stage", method: "PATCH", body: { stage: "replied" } },
      { url: "/api/credits/topup", method: "POST", body: { amount: 100 } },
    ]);
  });
});

describe("runGtmAgent", () => {
  const base = "http://localhost:3020";
  it("maps dispatched and fallback responses", async () => {
    stub(() => Response.json({ mode: "dispatched", dispatched: true, brief: "B", command: "c" }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: true, mode: "dispatched", brief: "B" });
    stub(() => Response.json({ mode: "fallback", dispatched: false, brief: "B2", reason: "no cli", command: "c" }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: true, mode: "fallback", brief: "B2", reason: "no cli" });
  });
  it("402 is an error; network failure falls back to a local brief", async () => {
    stub(() => Response.json({ error: "Out of credits" }, { status: 402 }));
    expect(await runGtmAgent(1, base)).toEqual({ ok: false, error: "Out of credits" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network"))));
    const r = await runGtmAgent(1, base);
    expect(r.ok && r.mode === "fallback" && r.brief.includes("product 1")).toBe(true);
  });
});
