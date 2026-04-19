import fs from "node:fs";
import path from "node:path";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import { getDefaultPromptPath, getProjectPromptPath } from "../core/paths.js";
import { normalizeAgentName, parseCommandArgs } from "../core/utils.js";
import { createPromptTemplate } from "../subagents/prompts.js";
import { getSubagent, listSubagentNames } from "../subagents/agents.js";
import type { CanonicalAgentName, PromptMode } from "../types/subagents.js";

function getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
  const items = listSubagentNames().flatMap((name) => {
    const agent = getSubagent(name)!;
    return [
      { value: agent.name, label: agent.name },
      { value: agent.shortName.toLowerCase(), label: agent.shortName },
    ];
  });

  const filtered = items.filter((item) => item.value.startsWith(prefix.toLowerCase()));
  return filtered.length > 0 ? filtered : null;
}

function resolveMode(value: string | undefined): PromptMode | null {
  if (value === "append" || value === "replace") return value;
  return null;
}

function buildInitialPrompt(agent: CanonicalAgentName, mode: PromptMode): string {
  if (mode === "replace") {
    const defaultPrompt = parseFrontmatter<Record<string, unknown>>(fs.readFileSync(getDefaultPromptPath(agent), "utf-8")).body;
    return createPromptTemplate(agent, mode, defaultPrompt);
  }
  return createPromptTemplate(agent, mode, "Hard rules:\n\n- ");
}

export function registerAgentPromptCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent:prompt", {
    description: "Create or edit a project-level subagent prompt override",
    getArgumentCompletions: getArgumentCompletions,
    handler: async (args, ctx) => {
      const parts = parseCommandArgs(args.trim());
      const selectedAgent =
        normalizeAgentName(parts[0]) ??
        normalizeAgentName(
          (await ctx.ui.select(
            "Prompt target",
            listSubagentNames().map((name) => {
              const agent = getSubagent(name)!;
              return `${agent.title} (${agent.shortName})`;
            }),
          ))?.split(" ")[0] ?? null,
        );

      if (!selectedAgent) {
        ctx.ui.notify("No subagent selected.", "warning");
        return;
      }

      const selectedMode =
        resolveMode(parts[1]) ??
        resolveMode(await ctx.ui.select("Prompt mode", ["append", "replace"]));

      if (!selectedMode) {
        ctx.ui.notify("No prompt mode selected.", "warning");
        return;
      }

      const promptFile = getProjectPromptPath(ctx.cwd, selectedAgent);
      const initialContent = fs.existsSync(promptFile)
        ? fs.readFileSync(promptFile, "utf-8")
        : buildInitialPrompt(selectedAgent, selectedMode);

      const edited = await ctx.ui.editor(`Edit ${selectedAgent} prompt`, initialContent);
      if (edited === undefined) {
        ctx.ui.notify("Prompt editing cancelled.", "warning");
        return;
      }

      fs.mkdirSync(path.dirname(promptFile), { recursive: true });
      fs.writeFileSync(promptFile, edited, "utf-8");
      ctx.ui.notify(`Saved ${selectedAgent} prompt override to ${promptFile}`, "info");
    },
  });
}
