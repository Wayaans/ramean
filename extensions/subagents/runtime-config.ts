import type { ThinkingLevel, CanonicalAgentName, ResolvedAgentRuntimeConfig } from "../types/subagents.js";
import { getAgentConfig } from "./config.js";

export interface RuntimeResolutionContext {
  cwd: string;
  modelRegistry: {
    getAvailable(): Array<{
      provider?: string;
      id?: string;
      active?: boolean;
      selected?: boolean;
      current?: boolean;
    }>;
    getCurrentModel?: () => { provider?: string; id?: string } | string | undefined;
    getCurrent?: () => { provider?: string; id?: string } | string | undefined;
    getSelectedModel?: () => { provider?: string; id?: string } | string | undefined;
    getSelected?: () => { provider?: string; id?: string } | string | undefined;
    currentModel?: { provider?: string; id?: string } | string;
    selectedModel?: { provider?: string; id?: string } | string;
    activeModel?: { provider?: string; id?: string } | string;
  };
}

function splitModelArg(modelArg: string | undefined): { provider?: string; model?: string } {
  if (!modelArg) return {};
  const [provider, ...rest] = modelArg.split("/");
  if (!provider || rest.length === 0) {
    return { model: modelArg };
  }
  return {
    provider,
    model: rest.join("/"),
  };
}

export function resolveActiveMainModel(context: RuntimeResolutionContext): string | undefined {
  const registry = context.modelRegistry;
  const candidates = [
    registry.getCurrentModel?.(),
    registry.getCurrent?.(),
    registry.getSelectedModel?.(),
    registry.getSelected?.(),
    registry.currentModel,
    registry.selectedModel,
    registry.activeModel,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate.provider === "string" && typeof candidate.id === "string") {
      return `${candidate.provider}/${candidate.id}`;
    }
  }

  const availableModels = registry.getAvailable?.() ?? [];
  const active =
    availableModels.find((model) => Boolean(model.active || model.selected || model.current)) ??
    availableModels[0];

  if (active?.provider && active.id) {
    return `${active.provider}/${active.id}`;
  }

  return undefined;
}

export function resolveEffectiveAgentRuntime(
  context: RuntimeResolutionContext,
  agent: CanonicalAgentName,
): ResolvedAgentRuntimeConfig {
  const config = getAgentConfig(context.cwd, agent);
  const availableModels = context.modelRegistry.getAvailable();

  if (config.provider && config.model) {
    const matched = availableModels.find((model) => model.provider === config.provider && model.id === config.model);
    if (matched) {
      return {
        provider: matched.provider,
        model: matched.id,
        modelArg: `${matched.provider}/${matched.id}`,
        thinking: config.thinking,
      };
    }

    const fallbackModel = resolveActiveMainModel(context);
    if (fallbackModel) {
      const split = splitModelArg(fallbackModel);
      return {
        ...split,
        modelArg: fallbackModel,
        thinking: "low",
        fallbackNote: `Configured model ${config.provider}/${config.model} is unavailable. Using the active main-agent model with low thinking.`,
      };
    }

    return {
      thinking: config.thinking,
      fallbackNote: `Configured model ${config.provider}/${config.model} is unavailable and no active main-agent model could be resolved. Using pi defaults.`,
    };
  }

  const fallbackModel = resolveActiveMainModel(context);
  if (fallbackModel) {
    const split = splitModelArg(fallbackModel);
    return {
      ...split,
      modelArg: fallbackModel,
      thinking: "low",
      fallbackNote: "No configured provider/model. Using the active main-agent model with low thinking.",
    };
  }

  return {
    thinking: config.thinking as ThinkingLevel | undefined,
    fallbackNote: "No configured provider/model and no active main-agent model could be resolved. Using pi defaults.",
  };
}
