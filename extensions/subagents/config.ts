import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import { listSubagentNames } from "./agents.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";
import type { AgentRuntimeConfig, CanonicalAgentName, SubagentConfig, ThinkingLevel } from "../types/subagents.js";

function emptyConfig(): SubagentConfig {
  return {
    extension: "subagent",
    agents: {
      agent: {},
      designer: {},
      reviewer: {},
    },
  };
}

function normalizeThinking(value: unknown): ThinkingLevel | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return ["off", "minimal", "low", "medium", "high", "xhigh"].includes(normalized)
    ? (normalized as ThinkingLevel)
    : undefined;
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

  return {
    provider: typeof value.provider === "string" ? value.provider : undefined,
    model: typeof value.model === "string" ? value.model : undefined,
    thinking: normalizeThinking(value.thinking),
  };
}

function extractDirectBlock(value: Record<string, unknown>): Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> {
  const block: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> = {};
  for (const name of listSubagentNames()) {
    block[name] = normalizeAgentRuntimeConfig(value[name]);
  }
  return block;
}

function extractAgentConfigBlock(document: unknown): Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> {
  if (Array.isArray(document)) {
    const result: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> = {};
    for (const item of document) {
      if (!isRecord(item)) continue;
      if (item.extension === "subagent") {
        Object.assign(result, extractDirectBlock(item));
        if (isRecord(item.agents)) {
          for (const name of listSubagentNames()) {
            result[name] = normalizeAgentRuntimeConfig(item.agents[name]);
          }
        }
      }
    }
    return result;
  }

  if (!isRecord(document)) return {};

  if (document.extension === "subagent") {
    const result = extractDirectBlock(document);
    if (isRecord(document.agents)) {
      for (const name of listSubagentNames()) {
        result[name] = normalizeAgentRuntimeConfig(document.agents[name]);
      }
    }
    return result;
  }

  if (isRecord(document.subagent)) {
    return extractAgentConfigBlock(document.subagent);
  }

  if (isRecord(document.agents)) {
    const result: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>> = {};
    for (const name of listSubagentNames()) {
      result[name] = normalizeAgentRuntimeConfig(document.agents[name]);
    }
    return result;
  }

  return extractDirectBlock(document);
}

function mergeConfigs(base: SubagentConfig, override: Partial<Record<CanonicalAgentName, AgentRuntimeConfig>>): SubagentConfig {
  const merged = emptyConfig();
  for (const name of listSubagentNames()) {
    merged.agents[name] = {
      ...base.agents[name],
      ...(override[name] ?? {}),
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

export function loadMergedSubagentConfig(cwd: string): SubagentConfig {
  const defaults = extractAgentConfigBlock(readYamlFile(getDefaultConfigPath()));
  const project = extractAgentConfigBlock(readYamlFile(getProjectConfigPath(cwd)));
  return mergeConfigs(mergeConfigs(emptyConfig(), defaults), project);
}

export function updateProjectSubagentConfig(
  cwd: string,
  agent: CanonicalAgentName,
  config: AgentRuntimeConfig,
): { path: string; saved: SubagentConfig } {
  const projectConfigPath = getProjectConfigPath(cwd);
  const existingDocument = readYamlFile(projectConfigPath);
  const merged = loadMergedSubagentConfig(cwd);
  merged.agents[agent] = {
    ...merged.agents[agent],
    ...config,
  };

  let nextDocument: unknown;
  if (Array.isArray(existingDocument)) {
    const entries = [...existingDocument];
    const index = entries.findIndex((entry) => isRecord(entry) && entry.extension === "subagent");
    const nextEntry = {
      extension: "subagent",
      agents: merged.agents,
    };
    if (index >= 0) entries[index] = nextEntry;
    else entries.push(nextEntry);
    nextDocument = entries;
  } else if (isRecord(existingDocument) && !(existingDocument.extension === "subagent") && !isRecord(existingDocument.agents)) {
    nextDocument = {
      ...existingDocument,
      subagent: {
        extension: "subagent",
        agents: merged.agents,
      },
    };
  } else {
    nextDocument = {
      extension: "subagent",
      agents: merged.agents,
    };
  }

  fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
  fs.writeFileSync(projectConfigPath, stringify(nextDocument), "utf-8");

  return { path: projectConfigPath, saved: merged };
}

export function getAgentConfig(cwd: string, agent: CanonicalAgentName): AgentRuntimeConfig {
  return loadMergedSubagentConfig(cwd).agents[agent];
}

