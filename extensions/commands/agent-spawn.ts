import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createDispatchMessage } from "../UI/renderers.js";
import { parseSpawnArgs } from "../core/utils.js";
import { executeDispatch } from "../subagents/spawn.js";
import { getSubagent, listSubagentNames } from "../subagents/agents.js";

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

      ctx.ui.setStatus("ramean-spawn", `⚏ ${requestedAgent}`);
      ctx.ui.setWorkingMessage(`Dispatching ${requestedAgent}...`);

      try {
        const details = await executeDispatch({
          cwd: ctx.cwd,
          requestedAgent,
          task,
          context: ctx,
        });

        pi.sendMessage(createDispatchMessage(details));
      } finally {
        ctx.ui.setStatus("ramean-spawn", undefined);
        ctx.ui.setWorkingMessage();
      }
    },
  });
}
