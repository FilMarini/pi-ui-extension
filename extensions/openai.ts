import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { applyOpenAIMode, type OpenAIMode } from "./usage-data/mode.ts";
import { EffortPanel } from "./usage-panel/effort.ts";
import { UsagePanel, type PanelState } from "./usage-panel/panel.ts";
import { isMultiproviderService, setActiveMultiproviderService } from "./usage-data/multiprovider.ts";
import { parseUsageSnapshot, requestCodexUsage } from "./usage-data/usage.ts";
import type { SidebarPanelDefinition } from "./sidebar/registry.ts";

export function readSettings(path = join(getAgentDir(), "pi-ui-extension", "openai-settings.json")): { enabled: boolean; refreshIntervalMs: number } {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return { enabled: value.enabled !== false, refreshIntervalMs: typeof value.refreshIntervalMs === "number" && Number.isFinite(value.refreshIntervalMs) && value.refreshIntervalMs >= 1000 ? value.refreshIntervalMs : 30_000 };
  } catch {
    const legacy = join(getAgentDir(), "pi-ui-better-openai", "settings.json");
    return path === join(getAgentDir(), "pi-ui-extension", "openai-settings.json")
      ? readSettings(legacy)
      : { enabled: true, refreshIntervalMs: 30_000 };
  }
}

export function installOpenAI(pi: ExtensionAPI, refreshSidebar: () => void): readonly SidebarPanelDefinition[] {
  let state: PanelState = { visible: false, staleAfterMs: 60_000 };
  const refresh = refreshSidebar;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: AbortController | undefined;
  let generation = 0;
  let currentContext: ExtensionContext | undefined;
  let mode: OpenAIMode | undefined;
  const settings = readSettings();
  const stop = () => { generation++; if (timer) clearTimeout(timer); timer = undefined; abort?.abort(); abort = undefined; };
  const update = (ctx: ExtensionContext, provider = ctx.model?.provider, modelId = ctx.model?.id) => {
    stop();
    const visible = settings.enabled && ctx.mode === "tui" && (provider === "openai" || provider === "openai-codex");
    state = { visible, staleAfterMs: settings.refreshIntervalMs * 2 };
    refresh();
    if (!visible) return;
    const current = generation;
    const poll = async () => {
      abort = new AbortController();
      try {
        const data = await requestCodexUsage(ctx, abort.signal);
        if (current !== generation) return;
        state = data ? { ...state, snapshot: parseUsageSnapshot(data, modelId), error: undefined } : { ...state, error: "Login to openai-codex" };
      } catch {
        if (current !== generation) return;
        state = { ...state, error: "Usage unavailable" };
      }
      refresh();
      if (current === generation) timer = setTimeout(() => { void poll(); }, settings.refreshIntervalMs);
    };
    void poll();
  };
  const panels: SidebarPanelDefinition[] = [];
    panels.push({ id: "openai-usage", visible: () => state.visible, create: ({ theme }) => ({ component: new UsagePanel(theme, () => state) }) });
    panels.push({
      id: "openai-effort", visible: () => state.visible,
      create: ({ theme, tui }) => {
        const panel = new EffortPanel(theme, tui, () => pi.getThinkingLevel(), () => {
          const ctx = currentContext;
          const model = ctx?.model;
          if (!ctx || !model || !state.visible) return;
          const levels = getSupportedThinkingLevels(model);
          void ctx.ui.select("Select effort level", levels).then((selection) => {
            if (currentContext !== ctx || !state.visible || ctx.model !== model || !selection || !levels.includes(selection as typeof levels[number])) return;
            pi.setThinkingLevel(selection as typeof levels[number]);
            refresh();
          });
        }, () => mode ?? "Default", () => {
          const ctx = currentContext;
          const model = ctx?.model;
          if (!ctx || !model || !state.visible) return;
          void ctx.ui.select("OpenAI mode (Fast may increase usage/cost)", ["Normal", "Fast"]).then((selection) => {
            if (currentContext !== ctx || !state.visible || ctx.model !== model || (selection !== "Normal" && selection !== "Fast")) return;
            mode = selection;
            refresh();
          });
        });
        return { component: panel, dispose: () => panel.dispose() };
      },
    });
  const unsubscribeMultiprovider = pi.events.on("pi-multiprovider:service", (value) => {
    if (isMultiproviderService(value)) setActiveMultiproviderService(value);
  });
  pi.on("session_start", (_event, ctx) => { currentContext = ctx; update(ctx); });
  pi.on("model_select", (event, ctx) => { currentContext = ctx; update(ctx, event.model.provider, event.model.id); });
  pi.on("thinking_level_select", () => refresh());
  pi.on("before_provider_request", (event, ctx) => applyOpenAIMode(event.payload, ctx.model?.provider, mode));
  pi.on("session_shutdown", () => { currentContext = undefined; stop(); setActiveMultiproviderService(undefined); unsubscribeMultiprovider(); });
  return panels;
}
