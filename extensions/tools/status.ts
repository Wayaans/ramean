import type { ExtensionAPI, ToolInfo } from "@mariozechner/pi-coding-agent";
import { CUSTOM_TOOL_NAMES, type ToolStatusRow, type ToolsStatusMessageDetails } from "../types/tools.js";
import { loadMergedToolConfig, resolveRuntimeToolConfig } from "./config.js";
import { mergePrioritizedActiveTools } from "./index.js";

export function buildToolsStatusDetails(pi: ExtensionAPI, cwd: string): ToolsStatusMessageDetails {
  const config = loadMergedToolConfig(cwd);
  const runtime = isSubagentRuntime() ? "subagent" : "main";
  const runtimeToolConfig = resolveRuntimeToolConfig(config, { isSubagentRuntime: runtime === "subagent" });
  const allTools = pi.getAllTools();
  const activeNames = mergePrioritizedActiveTools({
    availableTools: allTools.map((tool) => tool.name),
    activeTools: pi.getActiveTools(),
    toolConfig: runtimeToolConfig,
  });
  const activeNameSet = new Set(activeNames);
  const toolsByName = new Map(allTools.map((tool) => [tool.name, tool] as const));

  const activeTools = activeNames
    .map((name, index) => {
      const tool = toolsByName.get(name);
      if (!tool) return undefined;
      return mapToolStatusRow(tool, { active: true, priority: index + 1 });
    })
    .filter((tool): tool is ToolStatusRow => Boolean(tool));

  const inactiveTools = allTools
    .filter((tool) => !activeNameSet.has(tool.name))
    .sort((left, right) => {
      const sourceCompare = getToolSource(left).localeCompare(getToolSource(right));
      if (sourceCompare !== 0) return sourceCompare;
      return left.name.localeCompare(right.name);
    })
    .map((tool) => mapToolStatusRow(tool, { active: false }));

  return {
    enabled: config.enabled,
    runtime,
    activeTools,
    inactiveTools,
    disabledByConfig: CUSTOM_TOOL_NAMES.filter((name) => !runtimeToolConfig[name]),
  };
}

export function buildToolsStatusSummary(details: ToolsStatusMessageDetails): string {
  const lines = [
    "/tools:status",
    `- enabled: ${details.enabled}`,
    `- runtime: ${details.runtime}`,
    "",
    "Active tools (highest priority first):",
  ];

  if (details.activeTools.length === 0) {
    lines.push("- none");
  } else {
    for (const tool of details.activeTools) {
      const prefix = tool.priority ? `${tool.priority}.` : "-";
      lines.push(`- ${prefix} ${tool.name} [${tool.source}]`);
      lines.push(`  - summary: ${tool.description}`);
    }
  }

  lines.push("", "Available but inactive:");
  if (details.inactiveTools.length === 0) {
    lines.push("- none");
  } else {
    for (const tool of details.inactiveTools) {
      lines.push(`- ${tool.name} [${tool.source}]`);
      lines.push(`  - summary: ${tool.description}`);
    }
  }

  lines.push("", "Disabled by tools config:");
  if (details.disabledByConfig.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...details.disabledByConfig.map((name) => `- ${name}`));
  }

  return lines.join("\n");
}

function mapToolStatusRow(tool: ToolInfo, options: { active: boolean; priority?: number }): ToolStatusRow {
  return {
    name: tool.name,
    source: getToolSource(tool),
    description: summarizeToolDescription(tool.description),
    active: options.active,
    priority: options.priority,
  };
}

function getToolSource(tool: ToolInfo): ToolStatusRow["source"] {
  return tool.sourceInfo.source === "builtin" ? "builtin" : "extension";
}

function summarizeToolDescription(description: string | undefined): string {
  const text = description?.trim();
  if (!text) return "No description available.";

  const firstSentence = text.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? text;
  return firstSentence.length <= 120 ? firstSentence : `${firstSentence.slice(0, 117).trimEnd()}…`;
}

function isSubagentRuntime(): boolean {
  return process.env.RAMEAN_SUBAGENT === "1";
}
