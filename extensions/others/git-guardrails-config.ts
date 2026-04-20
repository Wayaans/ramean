import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { readYamlFile } from "../core/config-file.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";
import type { GitGuardrailsConfig } from "../types/git-guardrails.js";
import { CUSTOM_TOOL_NAMES } from "../types/tools.js";

type KnownProjectExtension = "subagent" | "tools" | "handoff" | "notify" | "minimal-mode" | "git-guardrails";

type SimpleExtensionName = Exclude<KnownProjectExtension, "subagent" | "tools">;

interface ExtractedGitGuardrailsConfig {
  enabled?: boolean;
}

const SUBAGENT_NAMES = ["agent", "designer", "reviewer"] as const;

export function emptyGitGuardrailsConfig(): GitGuardrailsConfig {
  return {
    extension: "git-guardrails",
    enabled: false,
  };
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeKnownProjectExtension(value: unknown): KnownProjectExtension | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "subagent") return "subagent";
  if (normalized === "tools") return "tools";
  if (normalized === "handoff") return "handoff";
  if (normalized === "notify") return "notify";
  if (normalized === "minimal-mode" || normalized === "minimal_mode") return "minimal-mode";
  if (normalized === "git-guardrails" || normalized === "git_guardrails" || normalized === "gitguardrails") {
    return "git-guardrails";
  }
  return null;
}

function normalizeSimpleExtensionEnabled(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (isRecord(value)) return normalizeBoolean(value.enabled);
  return undefined;
}

function extractGitGuardrailsConfig(document: unknown): ExtractedGitGuardrailsConfig {
  if (Array.isArray(document)) {
    const result: ExtractedGitGuardrailsConfig = {};

    for (const item of document) {
      if (!isRecord(item) || normalizeKnownProjectExtension(item.extension) !== "git-guardrails") continue;
      result.enabled = normalizeBoolean(item.enabled) ?? result.enabled;
    }

    return result;
  }

  if (!isRecord(document)) return {};

  if (normalizeKnownProjectExtension(document.extension) === "git-guardrails") {
    return { enabled: normalizeBoolean(document.enabled) };
  }

  return {
    enabled: normalizeSimpleExtensionEnabled(
      document["git-guardrails"] ?? document.git_guardrails ?? document.gitGuardrails,
    ),
  };
}

function mergeGitGuardrailsConfig(
  base: GitGuardrailsConfig,
  override: ExtractedGitGuardrailsConfig,
): GitGuardrailsConfig {
  return {
    extension: "git-guardrails",
    enabled: override.enabled ?? base.enabled,
  };
}

function buildExtensionEntry(config: GitGuardrailsConfig): Record<string, unknown> {
  return {
    extension: "git-guardrails",
    enabled: config.enabled,
  };
}

function extractDirectSubagents(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = SUBAGENT_NAMES.flatMap((name) => (value[name] === undefined ? [] : [[name, value[name]]] as const));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeSubagentExtensionEntry(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  const extension = normalizeKnownProjectExtension(value.extension);
  const nestedSource =
    isRecord(value.subagents)
      ? value.subagents
      : isRecord(value.agents)
        ? value.agents
        : extractDirectSubagents(value);

  if (!nestedSource && extension !== "subagent") return undefined;

  const entry: Record<string, unknown> = { extension: "subagent" };
  if (typeof value.enabled === "boolean") {
    entry.enabled = value.enabled;
  }
  if (nestedSource) {
    entry.subagents = nestedSource;
  }
  return entry;
}

function normalizeSimpleExtensionEntry(name: SimpleExtensionName, value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "boolean") {
    return { extension: name, enabled: value };
  }
  if (!isRecord(value)) return undefined;
  return { ...value, extension: name };
}

function extractDirectTools(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = CUSTOM_TOOL_NAMES.flatMap((name) =>
    typeof value[name] === "boolean" ? ([[name, value[name]]] as const) : [],
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeToolsExtensionEntry(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  const extension = normalizeKnownProjectExtension(value.extension);
  const toolSource = isRecord(value.tools) ? value.tools : value;
  const tools = extractDirectTools(toolSource);

  if (!tools && extension !== "tools") {
    return undefined;
  }

  const entry: Record<string, unknown> = { extension: "tools", tools: tools ?? {} };
  if (typeof value.enabled === "boolean") {
    entry.enabled = value.enabled;
  }
  return entry;
}

function extractNonGitGuardrailsProjectEntries(existingDocument: unknown): unknown[] {
  if (Array.isArray(existingDocument)) {
    return existingDocument.filter(
      (entry) => !(isRecord(entry) && normalizeKnownProjectExtension(entry.extension) === "git-guardrails"),
    );
  }

  if (!isRecord(existingDocument)) {
    return [];
  }

  const entries: unknown[] = [];
  const extension = normalizeKnownProjectExtension(existingDocument.extension);

  if (extension === "subagent") {
    const subagentEntry = normalizeSubagentExtensionEntry(existingDocument);
    if (subagentEntry) entries.push(subagentEntry);
  } else if (extension === "tools") {
    const toolsEntry = normalizeToolsExtensionEntry(existingDocument);
    if (toolsEntry) entries.push(toolsEntry);
  } else if (extension && extension !== "git-guardrails") {
    const simpleEntry = normalizeSimpleExtensionEntry(extension, existingDocument);
    if (simpleEntry) entries.push(simpleEntry);
  } else {
    const subagentEntry = normalizeSubagentExtensionEntry(existingDocument);
    if (subagentEntry) entries.push(subagentEntry);
  }

  if (extension !== "tools") {
    const toolsEntry = normalizeToolsExtensionEntry(existingDocument.tools ?? existingDocument);
    if (toolsEntry) entries.push(toolsEntry);
  }

  if (extension !== "handoff") {
    const handoffEntry = normalizeSimpleExtensionEntry("handoff", existingDocument.handoff);
    if (handoffEntry) entries.push(handoffEntry);
  }

  if (extension !== "notify") {
    const notifyEntry = normalizeSimpleExtensionEntry("notify", existingDocument.notify);
    if (notifyEntry) entries.push(notifyEntry);
  }

  if (extension !== "minimal-mode") {
    const minimalModeEntry = normalizeSimpleExtensionEntry(
      "minimal-mode",
      existingDocument["minimal-mode"] ?? existingDocument.minimal_mode ?? existingDocument.minimalMode,
    );
    if (minimalModeEntry) entries.push(minimalModeEntry);
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
    gitGuardrails: _gitGuardrailsCamel,
    git_guardrails: _gitGuardrailsSnake,
    "git-guardrails": _gitGuardrailsKebab,
    agent: _agent,
    designer: _designer,
    reviewer: _reviewer,
    grep: _grep,
    glob: _glob,
    list: _list,
    todo_write: _todoWrite,
    question: _question,
    questionnaire: _questionnaire,
    web_fetch: _webFetch,
    find_docs: _findDocs,
    ...rest
  } = existingDocument;

  if (Object.keys(rest).length > 0) {
    entries.push(rest);
  }

  return entries;
}

function buildProjectDocument(existingDocument: unknown, config: GitGuardrailsConfig): unknown {
  return [buildExtensionEntry(config), ...extractNonGitGuardrailsProjectEntries(existingDocument)];
}

function writeProjectConfig(
  cwd: string,
  mutate: (config: GitGuardrailsConfig) => GitGuardrailsConfig,
): { path: string; saved: GitGuardrailsConfig } {
  const projectConfigPath = getProjectConfigPath(cwd);
  const existingDocument = readYamlFile(projectConfigPath);
  const current = loadMergedGitGuardrailsConfig(cwd);
  const saved = mutate(current);
  const nextDocument = buildProjectDocument(existingDocument, saved);

  fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
  fs.writeFileSync(projectConfigPath, stringify(nextDocument), "utf-8");

  return { path: projectConfigPath, saved };
}

export function loadMergedGitGuardrailsConfig(cwd: string): GitGuardrailsConfig {
  const defaults = extractGitGuardrailsConfig(readYamlFile(getDefaultConfigPath(), "ramean default config"));
  const project = extractGitGuardrailsConfig(readYamlFile(getProjectConfigPath(cwd), "ramean project config"));
  return mergeGitGuardrailsConfig(mergeGitGuardrailsConfig(emptyGitGuardrailsConfig(), defaults), project);
}

export function updateProjectGitGuardrailsEnabled(
  cwd: string,
  enabled: boolean,
): { path: string; saved: GitGuardrailsConfig } {
  return writeProjectConfig(cwd, (current) => ({
    ...current,
    enabled,
  }));
}

export function isGitGuardrailsEnabled(cwd: string): boolean {
  return loadMergedGitGuardrailsConfig(cwd).enabled;
}
