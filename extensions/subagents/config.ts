import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import { listSubagentNames } from "./agents.js";
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

function readYamlFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

function buildExtensionEntry(merged: SubagentConfig): Record<string, unknown> {
  return {
    extension: "subagent",
    enabled: merged.enabled,
    subagents: merged.agents,
  };
}

function buildProjectDocument(existingDocument: unknown, merged: SubagentConfig): unknown {
  const extensionEntry = buildExtensionEntry(merged);

  if (Array.isArray(existingDocument)) {
    const entries = [...existingDocument];
    const index = entries.findIndex((entry) => isRecord(entry) && entry.extension === "subagent");
    if (index >= 0) entries[index] = extensionEntry;
    else entries.push(extensionEntry);
    return entries;
  }

  if (isRecord(existingDocument)) {
    if (
      existingDocument.extension === "subagent" ||
      isRecord(existingDocument.agents) ||
      isRecord(existingDocument.subagents) ||
      isRecord(existingDocument.parallel) ||
      typeof existingDocument.enabled === "boolean"
    ) {
      const { parallel: _parallel, extension: _extension, enabled: _enabled, agents: _agents, subagents: _subagents, ...rest } = existingDocument;
      const useSubagents = isRecord(existingDocument.subagents);
      return {
        ...rest,
        extension: "subagent",
        enabled: merged.enabled,
        ...(useSubagents
          ? { subagents: merged.agents }
          : { agents: merged.agents }),
      };
    }

    return {
      ...existingDocument,
      subagent: extensionEntry,
    };
  }

  return [extensionEntry];
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
  const defaults = extractConfigBlock(readYamlFile(getDefaultConfigPath()));
  const project = extractConfigBlock(readYamlFile(getProjectConfigPath(cwd)));
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
