import type { RuntimeResolutionContext } from "./runtime-config.js";
import { getSubagent, listSubagentNames } from "./agents.js";
import { loadMergedSubagentConfig } from "./config.js";
import { loadPromptResolution } from "./prompts.js";
import { resolveEffectiveAgentRuntime } from "./runtime-config.js";
import type { AgentStatusMessageDetails, PromptResolution } from "../types/subagents.js";

export function formatPromptState(source: PromptResolution["source"]): string {
  switch (source) {
    case "project-append":
      return "append";
    case "project-replace":
      return "replace";
    case "fallback-default":
      return "invalid → default";
    case "default":
    default:
      return "default";
  }
}

export function buildAgentStatusDetails(context: RuntimeResolutionContext): AgentStatusMessageDetails {
  const config = loadMergedSubagentConfig(context.cwd);

  return {
    enabled: config.enabled,
    agents: listSubagentNames().map((name) => {
      const agent = getSubagent(name)!;
      const runtime = resolveEffectiveAgentRuntime(context, name);
      const prompt = loadPromptResolution(context.cwd, name);

      return {
        agent: name,
        title: agent.title,
        shortName: agent.shortName,
        provider: runtime.provider,
        model: runtime.model,
        thinking: runtime.thinking,
        promptState: formatPromptState(prompt.source),
        fallbackNote: runtime.fallbackNote,
      };
    }),
  };
}

export function buildAgentStatusSummary(details: AgentStatusMessageDetails): string {
  const lines = [
    "/agent:status",
    `- enabled: ${details.enabled}`,
    "",
    "Subagents:",
  ];

  for (const agent of details.agents) {
    const runtime = [agent.provider, agent.model, agent.thinking].filter(Boolean).join("/") || "pi defaults";
    lines.push(`- ${agent.title} (${agent.shortName})`);
    lines.push(`  - runtime: ${runtime}`);
    lines.push(`  - prompt: ${agent.promptState}`);
    if (agent.fallbackNote) {
      lines.push(`  - note: ${agent.fallbackNote}`);
    }
  }

  return lines.join("\n");
}
