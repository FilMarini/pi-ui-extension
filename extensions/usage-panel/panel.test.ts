import { test } from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { UsagePanel } from "./panel.ts";
import { parseUsageSnapshot } from "../usage-data/usage.ts";

const theme = { fg: (_color: string, text: string) => text } as Theme;
test("renders usage, countdown and staleness and hides for other providers", () => {
  const snapshot = parseUsageSnapshot({ rate_limit: { primary_window: { used_percent: 20, reset_after_seconds: 120 }, secondary_window: { used_percent: 80, reset_after_seconds: 90000 } }, rate_limit_reset_credits: { available_count: 2 } }, undefined, 1000);
  const state = { visible: true, snapshot, staleAfterMs: 10000 };
  const panel = new UsagePanel(theme, () => state, () => 2000);
  const text = panel.render(30).join("\n");
  assert.match(text, /80%/); assert.match(text, /20%/); assert.match(text, /1m/); assert.match(text, /2 banked/);
  for (const width of [18, 30, 50]) {
    const bars = panel.render(width).filter((line) => /[█░]/.test(line));
    assert.equal(bars.length, 2);
    for (const bar of bars) assert.equal((bar.match(/[█░]/g) ?? []).length, width - 4);
  }
  state.visible = false;
  assert.deepEqual(panel.render(30), []);
  state.visible = true;
  assert.match(new UsagePanel(theme, () => state, () => 12000).render(30).join("\n"), /Stale/);
});
