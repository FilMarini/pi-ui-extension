import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI, TuiInputListener } from "@earendil-works/pi-tui";
import { panelBottom, panelContent, panelTop } from "../sidebar/panel.ts";

type Rect = { x: number; y: number; width: number; height: number };
type Box = { component: Component; rect: Rect; clip: Rect; children: readonly Box[] };
const contains = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
function find(box: Box, component: Component): Box | undefined {
  if (box.component === component) return box;
  for (const child of box.children) { const found = find(child, component); if (found) return found; }
  return undefined;
}

/** A single click opens Pi's normal, keyboard-accessible selection dialog. */
export class EffortPanel implements Component {
  private pressed: number | undefined;
  private disposed = false;
  private unsubscribe: () => void;
  constructor(private theme: Theme, private tui: TUI, private level: () => string, private select: () => void, private mode?: () => string, private selectMode?: () => void) {
    const listener: TuiInputListener = (data) => this.input(data);
    // Run before the enclosing sidebar scroll view, as the base panels do.
    const listeners = (tui as unknown as { inputListeners?: unknown }).inputListeners;
    this.unsubscribe = tui.addInputListener(listener);
    if (listeners instanceof Set && listeners.has(listener)) {
      const others = [...listeners].filter((item) => item !== listener);
      listeners.clear(); listeners.add(listener); for (const item of others) listeners.add(item);
    }
  }
  private hit(x: number, y: number): number | undefined {
    const root = (this.tui as TUI & { currentLayout?: { root: Box } }).currentLayout?.root;
    const box = root && find(root, this);
    if (!box || !contains(box.rect, x, y) || !contains(box.clip, x, y)) return undefined;
    const row = y - box.rect.y;
    return row === 1 || (row === 2 && this.mode && this.selectMode) ? row : undefined;
  }
  private input(data: string): { consume: true } | undefined {
    const overlays = this.tui as TUI & { isOverlayFocused?: () => boolean };
    if (overlays.isOverlayFocused?.() ?? this.tui.hasOverlay?.() ?? false) { this.pressed = undefined; return; }
    const m = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/.exec(data);
    if (!m) return;
    const button = Number(m[1]);
    if ((button & 64) || (button & 3) !== 0) return;
    const hit = this.hit(Number(m[2]) - 1, Number(m[3]) - 1);
    if (m[4] === "m") {
      if (this.pressed === undefined) return;
      const pressed = this.pressed;
      this.pressed = undefined;
      if (hit === pressed) queueMicrotask(() => { if (!this.disposed) { if (hit === 1) this.select(); else this.selectMode?.(); } });
      return { consume: true };
    }
    if (button & 32) { if (this.pressed !== hit) this.pressed = undefined; return; }
    if (hit === undefined) return;
    this.pressed = hit;
    return { consume: true };
  }
  render(width: number): string[] {
    if (width < 6) return [];
    return [panelTop(this.theme, "EFFORT", width), panelContent(this.theme, `Effort: ${this.level()}  ▾`, "accent", width - 4), ...(this.mode && this.selectMode ? [panelContent(this.theme, `Mode: ${this.mode()}  ▾`, "accent", width - 4)] : []), panelBottom(this.theme, width)];
  }
  invalidate(): void {}
  dispose(): void { this.disposed = true; this.unsubscribe(); }
}
