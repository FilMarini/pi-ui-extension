export type OpenAIMode = "Normal" | "Fast";

/** Leave other providers and unselected tiers untouched. Server acceptance is not guaranteed. */
export function applyOpenAIMode(payload: unknown, provider: string | undefined, mode: OpenAIMode | undefined): unknown {
  if (!mode || (provider !== "openai" && provider !== "openai-codex") || !payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  return { ...payload, service_tier: mode === "Fast" ? "priority" : "default" };
}
