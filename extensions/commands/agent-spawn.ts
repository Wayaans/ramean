import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createDispatchMessage } from "../UI/renderers.js";
import type { DispatchDetails } from "../types/subagents.js";
import { parseSpawnArgs } from "../core/utils.js";
import { executeDispatch } from "../subagents/spawn.js";
import { clearStandaloneDispatchWidget, updateStandaloneDispatchWidget } from "../subagents/standalone-widget.js";
import { getSubagent, listSubagentNames } from "../subagents/agents.js";

function createPendingDispatchMessage(agentName: string, task: string): DispatchDetails {
  const agent = getSubagent(agentName) ?? getSubagent("agent")!;
  return {
    agent: agent.name,
    title: agent.title,
    shortName: agent.shortName,
    icon: agent.icon,
    task,
    status: "running",
    spinnerFrame: 0,
    output: "",
    streamlinedProgress: "Starting subagent...",
    warnings: [],
    exitCode: 0,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    transcript: [],
  };
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
    description: "Dispatch a task directly to a subagent without invoking the main agent",
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

      const widgetKey = `spawn:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      updateStandaloneDispatchWidget(ctx, widgetKey, createPendingDispatchMessage(requestedAgent, task));

      try {
        const details = await executeDispatch({
          cwd: ctx.cwd,
          requestedAgent,
          task,
          context: ctx,
          parentActiveTools: pi.getActiveTools(),
          onUpdate: (partial) => {
            updateStandaloneDispatchWidget(ctx, widgetKey, partial);
          },
        });

        pi.sendMessage(createDispatchMessage(details));
      } finally {
        clearStandaloneDispatchWidget(ctx, widgetKey);
      }
    },
  });
}
