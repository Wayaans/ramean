import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { normalizeAgentName, parseSpawnArgs } from "../core/utils.js";
import { getSubagent, listSubagentNames, validAgentHint } from "../subagents/agents.js";
import type { CanonicalAgentName } from "../types/subagents.js";

export function buildAgentSpawnPrompt(agent: CanonicalAgentName, task: string): string {
  return [
    `[ramean /agent:spawn] Run sub-agent \`${agent}\` with the following task: ${JSON.stringify(task)}`,
    "Call the `dispatch` tool immediately with exactly that `agent` and `task`.",
    "Do not use any other tool first.",
    "Do not answer directly.",
  ].join("\n");
}

function getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
  const trimmed = prefix.trim().toLowerCase();
  if (trimmed.includes(" ")) return null;

  const items = listSubagentNames().flatMap((name) => {
    const agent = getSubagent(name)!;
    return [
      { value: agent.name, label: agent.name },
      { value: agent.shortName.toLowerCase(), label: agent.shortName },
    ];
  });

  const filtered = items.filter((item) => item.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}

export function registerAgentSpawnCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent:spawn", {
    description: "Queue a real dispatch tool call from an interactive subagent picker",
    getArgumentCompletions: getArgumentCompletions,
    handler: async (args, ctx) => {
      const parsed = parseSpawnArgs(args);
      let requestedAgent = parsed.agent;
      let task = parsed.task;

      if (!requestedAgent) {
        const choice = await ctx.ui.select(
          "Spawn which subagent?",
          listSubagentNames().map((name) => {
            const agent = getSubagent(name)!;
            return `${agent.title} (${agent.shortName})`;
          }),
        );
        requestedAgent = choice?.split(" ")[0]?.toLowerCase() ?? null;
      }

      if (!task) {
        task =
          (await ctx.ui.input("Subagent task", "Describe the delegated task"))?.trim() ?? "";
      }

      if (!requestedAgent || !task) {
        ctx.ui.notify("Usage: /agent:spawn <agent> <task>", "warning");
        return;
      }

      const agent = normalizeAgentName(requestedAgent);
      if (!agent) {
        ctx.ui.notify(`Unknown subagent: ${requestedAgent}. Valid options: ${validAgentHint()}.`, "warning");
        return;
      }

      const content = buildAgentSpawnPrompt(agent, task);
      if (ctx.isIdle()) {
        pi.sendUserMessage(content);
        return;
      }

      pi.sendUserMessage(content, { deliverAs: "followUp" });
      ctx.ui.notify("Queued /agent:spawn as a follow-up dispatch request.", "info");
    },
  });
}
