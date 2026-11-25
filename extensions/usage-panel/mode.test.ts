import { test } from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI, TuiInputListener } from "@earendil-works/pi-tui";
import { EffortPanel } from "./effort.ts";
import { applyOpenAIMode } from "../usage-data/mode.ts";

test("mode maps to explicit OpenAI tiers without mutating payloads", () => {
  const payload = { model: "test", service_tier: "priority" };
  for (const provider of ["openai", "openai-codex"]) {
    assert.deepEqual(applyOpenAIMode(payload, provider, "Normal"), { ...payload, service_tier: "default" });
    assert.deepEqual(applyOpenAIMode(payload, provider, "Fast"), payload);
  }
  assert.equal(payload.service_tier, "priority");
  assert.equal(applyOpenAIMode(payload, "anthropic", "Fast"), undefined);
  assert.equal(applyOpenAIMode(payload, "openai", undefined), undefined);
  assert.equal(applyOpenAIMode(null, "openai", "Fast"), undefined);
});

test("mode row has its own selector and rejects cross-row clicks and overlays", async () => {
  const listeners = new Set<TuiInputListener>();
  let overlay = false;
  const tui = { inputListeners: listeners, addInputListener: (fn: TuiInputListener) => { listeners.add(fn); return () => listeners.delete(fn); }, hasOverlay: () => overlay } as unknown as TUI;
  const theme = { fg: (_color: string, text: string) => text } as Theme;
  let effort = 0;
  let mode = 0;
  const panel = new EffortPanel(theme, tui, () => "high", () => effort++, () => "Normal", () => mode++);
  const rect = { x: 10, y: 4, width: 24, height: 4 };
  Object.assign(tui, { currentLayout: { root: { component: panel, rect, clip: rect, children: [] } } });
  assert.match(panel.render(24).join("\n"), /Mode: Normal/);
  assert.equal(panel.render(24).length, 4);
  const input = [...listeners][0]!;
  input("\x1b[<0;12;7M"); input("\x1b[<0;12;7m");
  await Promise.resolve();
  assert.equal(mode, 1);
  assert.equal(effort, 0);
  input("\x1b[<0;12;6M"); input("\x1b[<0;12;7m");
  overlay = true;
  input("\x1b[<0;12;7M"); input("\x1b[<0;12;7m");
  await Promise.resolve();
  assert.equal(mode, 1);
  panel.dispose();
  assert.equal(listeners.size, 0);
});
