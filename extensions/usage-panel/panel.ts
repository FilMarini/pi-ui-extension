import type { Theme } from "@earendil-works/pi-coding-agent";
import { panelBottom, panelContent, panelTop } from "../sidebar/panel.ts";
import { formatPercent, formatResetCountdown, type UsageSnapshot } from "../usage-data/usage.ts";

export type PanelState = { visible: boolean; snapshot?: UsageSnapshot; error?: string; staleAfterMs: number };

export class UsagePanel {
  constructor(private theme: Theme, private state: () => PanelState, private now = Date.now) {}
  invalidate(): void {}
  render(width: number): string[] {
    const state = this.state();
    if (!state.visible || width < 6) return [];
    const contentWidth = width - 4;
    const line = (text: string, color: "dim" | "success" | "warning" | "error" = "dim") =>
      panelContent(this.theme, text, color, contentWidth);
    const lines = [panelTop(this.theme, "USAGE", width)];
    const snapshot = state.snapshot;
    if (!snapshot) {
      lines.push(line(state.error ?? "Loading..."));
    } else {
      const window = (label: string, percent: number | null, reset: number | null) => {
        const color = percent === null ? "dim" : percent > 70 ? "success" : percent >= 30 ? "warning" : "error";
        const filled = percent === null ? 0 : Math.round(Math.max(0, Math.min(100, percent)) / 100 * contentWidth);
        lines.push(line(`${label} ${formatPercent(percent)}`, color));
        lines.push(line(`${"█".repeat(filled)}${"░".repeat(contentWidth - filled)}`, color));
        const seconds = reset === null ? null : Math.max(0, reset - (this.now() - snapshot.capturedAt) / 1000);
        lines.push(line(`  Reset: ${formatResetCountdown(seconds) ?? "--"}`));
      };
      window("5h", snapshot.fiveHourLeftPercent, snapshot.fiveHourResetInSeconds);
      lines.push(line(""));
      window("7d", snapshot.sevenDayLeftPercent, snapshot.sevenDayResetInSeconds);
      lines.push(line(`${snapshot.isLimited ? "Limited" : "Available"}${snapshot.bankedResets === null ? "" : ` · ${snapshot.bankedResets} banked`}`, snapshot.isLimited ? "error" : "success"));
      if (state.error || this.now() - snapshot.capturedAt > state.staleAfterMs) lines.push(line(state.error ? "Stale · refresh failed" : "Stale", "warning"));
    }
    lines.push(panelBottom(this.theme, width));
    return lines;
  }
}
