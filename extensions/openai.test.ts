import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { installOpenAI, readSettings } from "./openai.ts";

test("OpenAI settings validate polling intervals", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-ui-openai-"));
  const path = join(dir, "settings.json");
  try {
    assert.deepEqual(readSettings(path), { enabled: true, refreshIntervalMs: 30000 });
    writeFileSync(path, JSON.stringify({ enabled: false, refreshIntervalMs: 1000 }));
    assert.deepEqual(readSettings(path), { enabled: false, refreshIntervalMs: 1000 });
    for (const interval of [0, -1, 999, "1000", null]) {
      writeFileSync(path, JSON.stringify({ refreshIntervalMs: interval }));
      assert.equal(readSettings(path).refreshIntervalMs, 30000);
    }
  } finally { rmSync(dir, { recursive: true }); }
});

test("built-in panels follow model visibility and abort pending credential resolution on shutdown", async () => {
  type Handler = (event: { model?: { provider: string; id: string } }, ctx: ExtensionContext) => unknown;
  const handlers = new Map<string, Handler>();
  let unsubscribed = false;
  const pi = {
    on: (name: string, handler: Handler) => handlers.set(name, handler),
    events: { on: () => () => { unsubscribed = true; } },
  } as unknown as ExtensionAPI;
  let refreshed = 0;
  const panels = installOpenAI(pi, () => refreshed++);
  assert.deepEqual(panels.map(p => p.id), ["openai-usage", "openai-effort"]);
  const ctx = {
    mode: "tui", model: { provider: "anthropic", id: "test" },
    // Never resolve: the test must not read local auth or contact a real endpoint.
    modelRegistry: { getApiKeyForProvider: () => new Promise(() => {}) },
  } as unknown as ExtensionContext;
  handlers.get("session_start")!({}, ctx);
  assert.ok(panels.every(p => !p.visible!()));
  handlers.get("model_select")!({ model: { provider: "openai-codex", id: "test" } }, ctx);
  assert.ok(panels.every(p => p.visible!()));
  handlers.get("model_select")!({ model: { provider: "anthropic", id: "test" } }, ctx);
  assert.ok(panels.every(p => !p.visible!()));
  handlers.get("session_shutdown")!({}, ctx);
  const before = refreshed;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refreshed, before);
  assert.ok(unsubscribed);
});
