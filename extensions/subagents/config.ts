import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { listSubagentNames } from "./agents.js";
import { readYamlFile } from "../core/config-file.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";
import type {
  AgentRuntimeConfig,
  CanonicalAgentName,
  SubagentConfig,
  ThinkingLevel,
} from "../types/subagents.js";

interface ExtractedSubagentConfig {
  enabled?: boolean;
  agents: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>>;
}

function emptyConfig(): SubagentConfig {
  return {
    extension: "subagent",
    enabled: true,
    agents: {
      agent: {},
      designer: {},
      reviewer: {},
    },
  };
}

function emptyExtractedConfig(): ExtractedSubagentConfig {
  return {
    agents: {},
  };
}

function normalizeThinking(value: unknown): ThinkingLevel | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return ["off", "minimal", "low", "medium", "high", "xhigh"].includes(normalized)
    ? (normalized as ThinkingLevel)
    : undefined;
}

function normalizeEnabled(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeAgentRuntimeConfig(value: unknown): AgentRuntimeConfig {
  if (!value) return {};

  if (Array.isArray(value)) {
    const merged: Record<string, unknown> = {};
    for (const item of value) {
      if (!isRecord(item)) continue;
      Object.assign(merged, item);
    }
    return normalizeAgentRuntimeConfig(merged);
  }

  if (!isRecord(value)) return {};

  const normalized: AgentRuntimeConfig = {
    provider: typeof value.provider === "string" ? value.provider : undefined,
    model: typeof value.model === "string" ? value.model : undefined,
    thinking: normalizeThinking(value.thinking),
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as AgentRuntimeConfig;
}

function extractDirectAgents(value: Record<string, unknown>): Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> {
  const block: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> = {};
  for (const name of listSubagentNames()) {
    block[name] = normalizeAgentRuntimeConfig(value[name]);
  }
  return block;
}

function extractConfigBlock(document: unknown): ExtractedSubagentConfig {
  if (Array.isArray(document)) {
    const result = emptyExtractedConfig();
    for (const item of document) {
      if (!isRecord(item) || item.extension !== "subagent") continue;
      const nestedSource =
        isRecord(item.subagents)
          ? item.subagents
          : isRecord(item.agents)
            ? item.agents
            : item;

      const nested = extractConfigBlock(nestedSource);
      result.enabled = normalizeEnabled(item.enabled) ?? nested.enabled ?? result.enabled;
      result.agents = {
        ...result.agents,
        ...nested.agents,
      };
    }
    return result;
  }

  if (!isRecord(document)) return emptyExtractedConfig();

  if (document.extension === "subagent") {
    const nestedSource =
      isRecord(document.subagents)
        ? document.subagents
        : isRecord(document.agents)
          ? document.agents
          : document;

    return {
      enabled: normalizeEnabled(document.enabled),
      agents: extractDirectAgents(nestedSource),
    };
  }

  if (isRecord(document.subagent)) {
    return extractConfigBlock(document.subagent);
  }

  const nestedSource =
    isRecord(document.subagents)
      ? document.subagents
      : isRecord(document.agents)
        ? document.agents
        : document;

  return {
    enabled: normalizeEnabled(document.enabled),
    agents: extractDirectAgents(nestedSource),
  };
}

function mergeConfigs(base: SubagentConfig, override: ExtractedSubagentConfig): SubagentConfig {
  const merged = emptyConfig();
  merged.enabled = override.enabled ?? base.enabled;

  for (const name of listSubagentNames()) {
    merged.agents[name] = {
      ...base.agents[name],
      ...(override.agents[name] ?? {}),
    };
  }

  return merged;
}

function buildExtensionEntry(merged: SubagentConfig): Record<string, unknown> {
  return {
    extension: "subagent",
    enabled: merged.enabled,
    subagents: merged.agents,
  };
}

type KnownProjectExtension = "subagent" | "tools" | "handoff" | "notify" | "minimal-mode";

function normalizeKnownProjectExtension(value: unknown): KnownProjectExtension | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "subagent") return "subagent";
  if (normalized === "tools") return "tools";
  if (normalized === "handoff") return "handoff";
  if (normalized === "notify") return "notify";
  if (normalized === "minimal-mode" || normalized === "minimal_mode") return "minimal-mode";
  return null;
}

function normalizeSimpleExtensionEntry(name: Exclude<KnownProjectExtension, "subagent" | "tools">, value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "boolean") {
    return { extension: name, enabled: value };
  }
  if (!isRecord(value)) return undefined;
  const entry: Record<string, unknown> = { ...value, extension: name };
  return entry;
}

function normalizeToolsExtensionEntry(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const { enabled, ...tools } = value;
  const entry: Record<string, unknown> = { extension: "tools", tools };
  if (typeof enabled === "boolean") {
    entry.enabled = enabled;
  }
  return entry;
}

function extractNonSubagentProjectEntries(existingDocument: unknown): unknown[] {
  if (Array.isArray(existingDocument)) {
    return existingDocument.filter((entry) => !(isRecord(entry) && normalizeKnownProjectExtension(entry.extension) === "subagent"));
  }

  if (!isRecord(existingDocument)) {
    return [];
  }

  const entries: unknown[] = [];
  const extension = normalizeKnownProjectExtension(existingDocument.extension);

  if (extension && extension !== "subagent") {
    entries.push({ ...existingDocument, extension });
  }

  if (extension !== "tools") {
    const toolsEntry = normalizeToolsExtensionEntry(existingDocument.tools);
    if (toolsEntry) {
      entries.push(toolsEntry);
    }
  }

  if (extension !== "handoff") {
    const handoffEntry = normalizeSimpleExtensionEntry("handoff", existingDocument.handoff);
    if (handoffEntry) {
      entries.push(handoffEntry);
    }
  }

  if (extension !== "notify") {
    const notifyEntry = normalizeSimpleExtensionEntry("notify", existingDocument.notify);
    if (notifyEntry) {
      entries.push(notifyEntry);
    }
  }

  if (extension !== "minimal-mode") {
    const minimalModeEntry = normalizeSimpleExtensionEntry(
      "minimal-mode",
      existingDocument["minimal-mode"] ?? existingDocument.minimal_mode ?? existingDocument.minimalMode,
    );
    if (minimalModeEntry) {
      entries.push(minimalModeEntry);
    }
  }

  const {
    extension: _extension,
    enabled: _enabled,
    parallel: _parallel,
    agents: _agents,
    subagents: _subagents,
    subagent: _subagent,
    tools: _tools,
    handoff: _handoff,
    notify: _notify,
    minimalMode: _minimalMode,
    minimal_mode: _minimalModeAlias,
    "minimal-mode": _minimalModeKebab,
    ...rest
  } = existingDocument;

  if (Object.keys(rest).length > 0) {
    entries.push(rest);
  }

  return entries;
}

function buildProjectDocument(existingDocument: unknown, merged: SubagentConfig): unknown {
  return [buildExtensionEntry(merged), ...extractNonSubagentProjectEntries(existingDocument)];
}

function writeProjectConfig(cwd: string, mutate: (config: SubagentConfig) => SubagentConfig): { path: string; saved: SubagentConfig } {
  const projectConfigPath = getProjectConfigPath(cwd);
  const existingDocument = readYamlFile(projectConfigPath);
  const current = loadMergedSubagentConfig(cwd);
  const saved = mutate(current);
  const nextDocument = buildProjectDocument(existingDocument, saved);

  fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
  fs.writeFileSync(projectConfigPath, stringify(nextDocument), "utf-8");

  return { path: projectConfigPath, saved };
}

export function loadMergedSubagentConfig(cwd: string): SubagentConfig {
  const defaults = extractConfigBlock(readYamlFile(getDefaultConfigPath(), "ramean default config"));
  const project = extractConfigBlock(readYamlFile(getProjectConfigPath(cwd), "ramean project config"));
  return mergeConfigs(mergeConfigs(emptyConfig(), defaults), project);
}

export function updateProjectSubagentConfig(
  cwd: string,
  agent: CanonicalAgentName,
  config: AgentRuntimeConfig,
): { path: string; saved: SubagentConfig } {
  return writeProjectConfig(cwd, (current) => ({
    ...current,
    agents: {
      ...current.agents,
      [agent]: {
        ...current.agents[agent],
        ...config,
      },
    },
  }));
}

export function updateProjectSubagentEnabled(
  cwd: string,
  enabled: boolean,
): { path: string; saved: SubagentConfig } {
  return writeProjectConfig(cwd, (current) => ({
    ...current,
    enabled,
  }));
}

export function getAgentConfig(cwd: string, agent: CanonicalAgentName): AgentRuntimeConfig {
  return loadMergedSubagentConfig(cwd).agents[agent];
}

export function isSubagentEnabled(cwd: string): boolean {
  return loadMergedSubagentConfig(cwd).enabled;
}
