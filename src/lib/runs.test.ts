import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { activity } from "./db/schema";
import { createTestDb } from "./db/test-db";
import { dispatchRun, renderBrief, runConfig, type Exec } from "./runs";

let db: Db;
let cleanup: () => void;
beforeEach(() => ({ db, cleanup } = createTestDb()));
afterEach(() => cleanup());

const cfg = { ...runConfig({}), disabled: false };

describe("runs", () => {
  it("renders agent/BRIEF.md with product id, name and base URL", () => {
    const b = renderBrief({ productId: 7, productName: "Flexprice", baseUrl: "http://localhost:3020/" });
    expect(b).toContain('product #7 ("Flexprice")');
    expect(b).toContain("curl -s http://localhost:3020/api/agent-tools/skill");
    expect(b).not.toMatch(/\{\{/);
  });

  it("dispatches through realtimex-pp-cli with argv (no shell) and logs a rep activity", async () => {
    const calls: [string, string[]][] = [];
    const exec: Exec = async (cmd, args) => {
      calls.push([cmd, args]);
      return { stdout: '{"ok":true,"sessionId":"s1"}', stderr: "" };
    };
    const r = await dispatchRun(db, { baseUrl: "http://localhost:3020", exec, config: cfg });
    expect(r).toMatchObject({ dispatched: true, session: { sessionId: "s1" } });
    const [cmd, args] = calls[0];
    expect(cmd).toBe("realtimex-pp-cli");
    expect(args.slice(0, 2)).toEqual(["open-terminal-session", "--agent"]);
    expect(args[args.indexOf("--agent-name") + 1]).toBe("claude");
    expect(args[args.indexOf("--workspace-slug") + 1]).toBe("hackwithbay4");
    expect(args[args.indexOf("--thread-slug") + 1]).toBe("flare-agent");
    expect(args[args.indexOf("--first-turn-delivery") + 1]).toBe("launch-args");
    expect(args[args.indexOf("--message") + 1]).toBe(r.brief);
    expect(db.select().from(activity).all().at(-1)).toMatchObject({ actorKind: "rep", tool: "run_agent" });
  });

  it("falls back to the brief when the CLI is missing", async () => {
    const exec: Exec = async () => {
      throw Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
    };
    const r = await dispatchRun(db, { baseUrl: "http://x", exec, config: cfg });
    expect(r.dispatched).toBe(false);
    expect(r.reason).toMatch(/not found/);
    expect(r.brief).toContain("get_product");
  });

  it("honours FLARE_RUN_DISPATCH=off", async () => {
    const r = await dispatchRun(db, { baseUrl: "http://x", config: runConfig({ FLARE_RUN_DISPATCH: "off" }) });
    expect(r).toMatchObject({ dispatched: false, reason: expect.stringMatching(/disabled/) });
  });
});
