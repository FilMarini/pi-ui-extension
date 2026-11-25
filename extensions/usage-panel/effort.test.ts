import { test } from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI, TuiInputListener } from "@earendil-works/pi-tui";
import { EffortPanel } from "./effort.ts";

test("effort panel renders current value and opens selector on click", async () => {
  const listeners = new Set<TuiInputListener>();
  const tui = { inputListeners: listeners, addInputListener: (fn: TuiInputListener) => { listeners.add(fn); return () => listeners.delete(fn); }, hasOverlay: () => false } as unknown as TUI;
  const theme = { fg: (_color: string, text: string) => text } as Theme;
  let selected = 0;
  const panel = new EffortPanel(theme, tui, () => "high", () => selected++);
  const rect = { x: 10, y: 4, width: 20, height: 3 };
  Object.assign(tui, { currentLayout: { root: { component: panel, rect, clip: rect, children: [] } } });
  assert.match(panel.render(20).join("\n"), /Effort: high/);
  const input = [...listeners][0]!;
  input("\x1b[<0;12;6M"); input("\x1b[<0;12;6m");
  await Promise.resolve();
  assert.equal(selected, 1);
  panel.dispose();
  assert.equal(listeners.size, 0);
});
