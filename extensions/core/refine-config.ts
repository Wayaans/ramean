import { readYamlFile } from "../core/config-file.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";

export interface RefineMyPromptConfig {
  provider: string;
  model: string;
  thinking: string;
}

interface ExtractedRefineConfig {
  enabled?: boolean;
  provider?: string;
  model?: string;
  thinking?: string;
}

function defaultConfig(): RefineMyPromptConfig {
  return {
    provider: "github-copilot",
    model: "gpt-5.4-mini",
    thinking: "low",
  };
}

function extractConfigBlock(document: unknown): ExtractedRefineConfig {
  if (Array.isArray(document)) {
    const result: ExtractedRefineConfig = {};
    for (const item of document) {
      if (!isRecord(item) || item.extension !== "refine-my-prompt") continue;
      result.enabled = typeof item.enabled === "boolean" ? item.enabled : result.enabled;
      if (isRecord(item.model)) {
        result.provider = typeof item.model.provider === "string" ? item.model.provider : result.provider;
        result.model = typeof item.model.model === "string" ? item.model.model : result.model;
        result.thinking = typeof item.model.thinking === "string" ? item.model.thinking : result.thinking;
      }
    }
    return result;
  }

  if (!isRecord(document)) return {};

  if (document.extension === "refine-my-prompt") {
    return {
      enabled: typeof document.enabled === "boolean" ? document.enabled : undefined,
      provider: isRecord(document.model) && typeof document.model.provider === "string" ? document.model.provider : undefined,
      model: isRecord(document.model) && typeof document.model.model === "string" ? document.model.model : undefined,
      thinking: isRecord(document.model) && typeof document.model.thinking === "string" ? document.model.thinking : undefined,
    };
  }

  if (isRecord(document["refine-my-prompt"])) {
    return extractConfigBlock(document["refine-my-prompt"]);
  }

  return {};
}

function mergeConfigs(base: ExtractedRefineConfig, override: ExtractedRefineConfig): ExtractedRefineConfig {
  return {
    enabled: override.enabled ?? base.enabled,
    provider: override.provider ?? base.provider,
    model: override.model ?? base.model,
    thinking: override.thinking ?? base.thinking,
  };
}

export function loadMergedRefineMyPromptConfig(cwd: string): { enabled: boolean; config: RefineMyPromptConfig } {
  const defaults = extractConfigBlock(readYamlFile(getDefaultConfigPath()));
  const project = extractConfigBlock(readYamlFile(getProjectConfigPath(cwd)));
  const merged = mergeConfigs(defaults, project);

  return {
    enabled: merged.enabled !== false,
    config: {
      provider: merged.provider ?? defaultConfig().provider,
      model: merged.model ?? defaultConfig().model,
      thinking: merged.thinking ?? defaultConfig().thinking,
    },
  };
}

export function getRefineMyPromptConfig(cwd: string): RefineMyPromptConfig {
  return loadMergedRefineMyPromptConfig(cwd).config;
}

export function isRefineMyPromptEnabled(cwd: string): boolean {
  return loadMergedRefineMyPromptConfig(cwd).enabled;
}
