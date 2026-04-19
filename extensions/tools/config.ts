import { readYamlFile } from "../core/config-file.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";
import {
  CUSTOM_TOOL_NAMES,
  type CustomToolConfigState,
  type CustomToolName,
  type ToolsExtensionConfig,
} from "../types/tools.js";

interface ExtractedToolConfig {
  enabled?: boolean;
  tools: Partial<Record<CustomToolName, boolean>>;
}

export function emptyToolConfig(): ToolsExtensionConfig {
  return {
    extension: "tools",
    enabled: true,
    tools: {
      grep: true,
      glob: true,
      list: true,
      todo_write: true,
      question: true,
      questionnaire: true,
      web_fetch: true,
      find_docs: true,
    },
  };
}

function emptyExtractedToolConfig(): ExtractedToolConfig {
  return { tools: {} };
}

export function isCustomToolName(value: string): value is CustomToolName {
  return (CUSTOM_TOOL_NAMES as readonly string[]).includes(value);
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function extractDirectTools(value: Record<string, unknown>): Partial<Record<CustomToolName, boolean>> {
  const tools: Partial<Record<CustomToolName, boolean>> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!isCustomToolName(key) || typeof fieldValue !== "boolean") continue;
    tools[key] = fieldValue;
  }
  return tools;
}

function extractToolConfig(document: unknown): ExtractedToolConfig {
  if (Array.isArray(document)) {
    const result = emptyExtractedToolConfig();
    for (const item of document) {
      if (!isRecord(item) || item.extension !== "tools") continue;
      const nested = extractToolConfig(item);
      result.enabled = nested.enabled ?? result.enabled;
      result.tools = {
        ...result.tools,
        ...nested.tools,
      };
    }
    return result;
  }

  if (!isRecord(document)) return emptyExtractedToolConfig();

  if (document.extension === "tools") {
    const toolSource = isRecord(document.tools) ? document.tools : document;
    return {
      enabled: normalizeBoolean(document.enabled),
      tools: extractDirectTools(toolSource),
    };
  }

  if (isRecord(document.tools)) {
    return {
      enabled: normalizeBoolean(document.enabled),
      tools: extractDirectTools(document.tools),
    };
  }

  const directTools = extractDirectTools(document);
  if (Object.keys(directTools).length > 0) {
    return {
      enabled: normalizeBoolean(document.enabled),
      tools: directTools,
    };
  }

  return emptyExtractedToolConfig();
}

function mergeToolConfig(
  base: ToolsExtensionConfig,
  override: ExtractedToolConfig,
): ToolsExtensionConfig {
  const merged: CustomToolConfigState = { ...base.tools };
  for (const name of CUSTOM_TOOL_NAMES) {
    const value = override.tools[name];
    if (typeof value === "boolean") {
      merged[name] = value;
    }
  }

  return {
    extension: "tools",
    enabled: override.enabled ?? base.enabled,
    tools: merged,
  };
}

export function loadMergedToolConfig(cwd: string): ToolsExtensionConfig {
  const defaults = extractToolConfig(readYamlFile(getDefaultConfigPath(), "ramean default config"));
  const project = extractToolConfig(readYamlFile(getProjectConfigPath(cwd), "ramean project config"));
  return mergeToolConfig(mergeToolConfig(emptyToolConfig(), defaults), project);
}

export function resolveRuntimeToolConfig(
  config: ToolsExtensionConfig,
  options: { isSubagentRuntime: boolean },
): CustomToolConfigState {
  const tools: CustomToolConfigState = { ...config.tools };

  if (!config.enabled) {
    for (const name of CUSTOM_TOOL_NAMES) {
      tools[name] = false;
    }
  }

  if (options.isSubagentRuntime) {
    tools.todo_write = false;
    tools.question = false;
    tools.questionnaire = false;
  }

  return tools;
}
