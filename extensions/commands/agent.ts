import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getProjectConfigPath } from "../core/paths.js";
import { getThinkingLevels, normalizeAgentName } from "../core/utils.js";
import {
  getAgentConfig,
  isSubagentEnabled,
  updateProjectSubagentConfig,
  updateProjectSubagentEnabled,
} from "../subagents/config.js";
import { getSubagent, listSubagentNames } from "../subagents/agents.js";
import type { CanonicalAgentName } from "../types/subagents.js";

const HOME_SUBAGENT = "Subagent settings";
const HOME_EXTENSION = "Extension settings";
const BACK = "← Back";
const FINISH = "Finish";
type AgentCommandScope = "subagent" | "extension";
type NavigationResult = "home" | "finish";

function getAgentCompletions(prefix: string): AutocompleteItem[] | null {
  const completions = [
    ...listSubagentNames().flatMap((name) => {
      const agent = getSubagent(name)!;
      return [
        { value: agent.name, label: agent.name },
        { value: agent.shortName.toLowerCase(), label: agent.shortName },
      ];
    }),
    { value: "settings", label: "settings" },
    { value: "extension", label: "extension" },
    { value: "enabled", label: "enabled" },
  ];

  const filtered = completions.filter((item) => item.value.startsWith(prefix.toLowerCase()));
  return filtered.length > 0 ? filtered : null;
}

function stripCurrentLabel(value: string): string {
  return value.replace(/\s+\(current\)$/, "");
}

function isBackChoice(value: string | undefined | null): boolean {
  return value === BACK;
}

function isFinishChoice(value: string | undefined | null): boolean {
  return value === FINISH;
}

async function configureSubagentFlow(
  ctx: ExtensionCommandContext,
  selectedAgent: CanonicalAgentName,
  interactive: boolean,
): Promise<NavigationResult> {
  const availableModels = ctx.modelRegistry.getAvailable();
  if (availableModels.length === 0) {
    ctx.ui.notify("No available models found. Authenticate a provider first.", "error");
    return interactive ? "home" : "finish";
  }

  const current = getAgentConfig(ctx.cwd, selectedAgent);
  const providers = [...new Set(availableModels.map((model) => model.provider))].sort();
  let provider = current.provider;
  let step: "provider" | "model" = "provider";

  while (true) {
    if (step === "provider") {
      const providerChoice = await ctx.ui.select(
        `Provider for ${selectedAgent}`,
        [
          ...providers.map((candidate) => (candidate === current.provider ? `${candidate} (current)` : candidate)),
          ...(interactive ? [BACK, FINISH] : []),
        ],
      );

      if (!providerChoice) {
        return interactive ? "home" : "finish";
      }
      if (isBackChoice(providerChoice)) {
        return "home";
      }
      if (isFinishChoice(providerChoice)) {
        return "finish";
      }

      provider = stripCurrentLabel(providerChoice);
      step = "model";
      continue;
    }

    const modelsForProvider = availableModels.filter((model) => model.provider === provider);
    if (modelsForProvider.length === 0) {
      ctx.ui.notify(`No models available for provider ${provider}.`, "error");
      step = "provider";
      continue;
    }

    const modelChoice = await ctx.ui.select(
      `Model for ${selectedAgent}`,
      [
        ...modelsForProvider.map((model) => (model.id === current.model ? `${model.id} (current)` : model.id)),
        ...(interactive ? [BACK, FINISH] : []),
      ],
    );

    if (!modelChoice) {
      return interactive ? "home" : "finish";
    }
    if (isBackChoice(modelChoice)) {
      step = "provider";
      continue;
    }
    if (isFinishChoice(modelChoice)) {
      return "finish";
    }

    const model = stripCurrentLabel(modelChoice);
    const thinkingChoice = await ctx.ui.select(
      `Thinking for ${selectedAgent}`,
      [
        ...getThinkingLevels().map((level) => (level === current.thinking ? `${level} (current)` : level)),
        ...(interactive ? [BACK, FINISH] : []),
      ],
    );

    if (!thinkingChoice) {
      return interactive ? "home" : "finish";
    }
    if (isBackChoice(thinkingChoice)) {
      continue;
    }
    if (isFinishChoice(thinkingChoice)) {
      return "finish";
    }

    const thinking = stripCurrentLabel(thinkingChoice) as typeof current.thinking;
    updateProjectSubagentConfig(ctx.cwd, selectedAgent, { provider, model, thinking });
    ctx.ui.notify(
      `Saved ${selectedAgent} → ${provider}/${model} (${thinking}) in ${getProjectConfigPath(ctx.cwd)}`,
      "info",
    );
    return interactive ? "home" : "finish";
  }
}

async function configureEnabledFlow(ctx: ExtensionCommandContext, interactive: boolean): Promise<NavigationResult> {
  const currentEnabled = isSubagentEnabled(ctx.cwd);
  const enabledChoice = await ctx.ui.select(
    "Subagent extension",
    [
      currentEnabled ? "Enable (current)" : "Enable",
      !currentEnabled ? "Disable (current)" : "Disable",
      ...(interactive ? [BACK, FINISH] : []),
    ],
  );

  if (!enabledChoice) {
    return interactive ? "home" : "finish";
  }
  if (isBackChoice(enabledChoice)) {
    return "home";
  }
  if (isFinishChoice(enabledChoice)) {
    return "finish";
  }

  const enabled = stripCurrentLabel(enabledChoice).toLowerCase().startsWith("enable");
  updateProjectSubagentEnabled(ctx.cwd, enabled);
  ctx.ui.notify(
    `Saved extension settings → enabled=${enabled ? "true" : "false"} in ${getProjectConfigPath(ctx.cwd)}`,
    "info",
  );
  return interactive ? "home" : "finish";
}

async function runInteractiveAgentSettings(
  ctx: ExtensionCommandContext,
  initial:
    | { scope: "home" }
    | { scope: "subagent"; agent?: CanonicalAgentName }
    | { scope: "extension" },
): Promise<void> {
  let nextScope: typeof initial = initial;

  while (true) {
    if (nextScope.scope === "home") {
      const scopeChoice = await ctx.ui.select("Configure what?", [HOME_SUBAGENT, HOME_EXTENSION, FINISH]);
      if (!scopeChoice || isFinishChoice(scopeChoice)) {
        return;
      }

      nextScope = scopeChoice === HOME_SUBAGENT ? { scope: "subagent" } : { scope: "extension" };
      continue;
    }

    if (nextScope.scope === "subagent") {
      let selectedAgent = nextScope.agent;

      if (!selectedAgent) {
        const selectedAgentLabel = await ctx.ui.select(
          "Select subagent",
          [
            ...listSubagentNames().map((name) => {
              const agent = getSubagent(name)!;
              return `${agent.title} (${agent.shortName})`;
            }),
            BACK,
            FINISH,
          ],
        );

        if (!selectedAgentLabel || isBackChoice(selectedAgentLabel)) {
          nextScope = { scope: "home" };
          continue;
        }
        if (isFinishChoice(selectedAgentLabel)) {
          return;
        }

        selectedAgent = normalizeAgentName(selectedAgentLabel.split(" ")[0] ?? null) ?? undefined;
      }

      if (!selectedAgent) {
        nextScope = { scope: "home" };
        continue;
      }

      const result = await configureSubagentFlow(ctx, selectedAgent, true);
      if (result === "finish") {
        return;
      }

      nextScope = { scope: "home" };
      continue;
    }

    const result = await configureEnabledFlow(ctx, true);

    if (result === "finish") {
      return;
    }

    nextScope = { scope: "home" };
  }
}

export function registerAgentCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent", {
    description: "Manage project-level subagent model, thinking, and extension settings",
    getArgumentCompletions: getAgentCompletions,
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const requestedAgent = normalizeAgentName(parts[0]);
      const scope = parts[0]?.trim().toLowerCase();
      const extensionScopes = new Set(["settings", "extension", "extensions", "global", "config", "enabled"]);

      const selectedScope: AgentCommandScope | undefined = requestedAgent
        ? "subagent"
        : scope && extensionScopes.has(scope)
          ? "extension"
          : undefined;

      if (!selectedScope) {
        await runInteractiveAgentSettings(ctx, { scope: "home" });
        return;
      }

      if (selectedScope === "subagent" && requestedAgent) {
        await runInteractiveAgentSettings(ctx, { scope: "subagent", agent: requestedAgent });
        return;
      }

      await runInteractiveAgentSettings(ctx, { scope: "extension" });
    },
  });
}
