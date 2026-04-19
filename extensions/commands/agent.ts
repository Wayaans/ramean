import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getProjectConfigPath } from "../core/paths.js";
import { getThinkingLevels, normalizeAgentName } from "../core/utils.js";
import { getAgentConfig, updateProjectSubagentConfig } from "../subagents/config.js";
import { getSubagent, listSubagentNames } from "../subagents/agents.js";

function getAgentCompletions(prefix: string): AutocompleteItem[] | null {
  const completions = listSubagentNames().flatMap((name) => {
    const agent = getSubagent(name)!;
    return [
      { value: agent.name, label: agent.name },
      { value: agent.shortName.toLowerCase(), label: agent.shortName },
    ];
  });

  const filtered = completions.filter((item) => item.value.startsWith(prefix.toLowerCase()));
  return filtered.length > 0 ? filtered : null;
}

export function registerAgentCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent", {
    description: "Manage project-level subagent model and thinking settings",
    getArgumentCompletions: getAgentCompletions,
    handler: async (args, ctx) => {
      const requested = normalizeAgentName(args.trim());
      const target = (() => {
        if (requested) return requested;
        return ctx.ui
          .select(
            "Select subagent",
            listSubagentNames().map((name) => {
              const agent = getSubagent(name)!;
              return `${agent.title} (${agent.shortName})`;
            }),
          )
          .then((choice) => normalizeAgentName(choice?.split(" ")[0] ?? null));
      })();

      const resolvedTarget = await target;


      if (!resolvedTarget) {
        ctx.ui.notify("No subagent selected.", "warning");
        return;
      }

      const availableModels = ctx.modelRegistry.getAvailable();
      if (availableModels.length === 0) {
        ctx.ui.notify("No available models found. Authenticate a provider first.", "error");
        return;
      }

      const current = getAgentConfig(ctx.cwd, resolvedTarget);
      const providers = [...new Set(availableModels.map((model) => model.provider))].sort();
      const providerChoice = await ctx.ui.select(
        `Provider for ${resolvedTarget}`,
        providers.map((provider) => (provider === current.provider ? `${provider} (current)` : provider)),
      );

      if (!providerChoice) {
        ctx.ui.notify("Provider selection cancelled.", "warning");
        return;
      }

      const provider = providerChoice.replace(/\s+\(current\)$/, "");
      const modelsForProvider = availableModels.filter((model) => model.provider === provider);
      const modelChoice = await ctx.ui.select(
        `Model for ${resolvedTarget}`,
        modelsForProvider.map((model) => (model.id === current.model ? `${model.id} (current)` : model.id)),
      );

      if (!modelChoice) {
        ctx.ui.notify("Model selection cancelled.", "warning");
        return;
      }

      const model = modelChoice.replace(/\s+\(current\)$/, "");
      const thinkingChoice = await ctx.ui.select(
        `Thinking for ${resolvedTarget}`,
        getThinkingLevels().map((level) => (level === current.thinking ? `${level} (current)` : level)),
      );

      if (!thinkingChoice) {
        ctx.ui.notify("Thinking selection cancelled.", "warning");
        return;
      }

      const thinking = thinkingChoice.replace(/\s+\(current\)$/, "") as typeof current.thinking;
      const saved = updateProjectSubagentConfig(ctx.cwd, resolvedTarget, { provider, model, thinking });
      const configPath = getProjectConfigPath(ctx.cwd);

      ctx.ui.notify(
        `Saved ${resolvedTarget} → ${provider}/${model} (${thinking}) in ${configPath}`,
        "info",
      );
    },
  });
}
