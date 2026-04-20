import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getProjectConfigPath } from "../core/paths.js";
import {
  isGitGuardrailsEnabled,
  updateProjectGitGuardrailsEnabled,
} from "../others/git-guardrails-config.js";
import type { GitGuardrailsCommandAction } from "../types/git-guardrails.js";

const ACTION_ALIASES: Record<string, GitGuardrailsCommandAction> = {
  toggle: "toggle",
  enable: "enable",
  on: "enable",
  disable: "disable",
  off: "disable",
  status: "status",
};

const COMPLETIONS: AutocompleteItem[] = [
  { value: "toggle", label: "toggle" },
  { value: "enable", label: "enable" },
  { value: "disable", label: "disable" },
  { value: "status", label: "status" },
];

function getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
  const normalized = prefix.trim().toLowerCase();
  const filtered = COMPLETIONS.filter((item) => item.value.startsWith(normalized));
  return filtered.length > 0 ? filtered : null;
}

function parseAction(args: string): GitGuardrailsCommandAction | null {
  const normalized = args.trim().toLowerCase();
  if (!normalized) return "toggle";
  return ACTION_ALIASES[normalized] ?? null;
}

function notify(ctx: ExtensionCommandContext, message: string, level: "info" | "warning" | "error" = "info"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
    return;
  }

  if (level === "error") {
    console.error(message);
    return;
  }

  console.log(message);
}

export function registerGuardrailsGitCommand(pi: ExtensionAPI): void {
  pi.registerCommand("guardrails:git", {
    description: "Toggle git-guardrails git command blocking",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      const action = parseAction(args);
      if (!action) {
        notify(ctx, "Usage: /guardrails:git [toggle|enable|disable|status]", "error");
        return;
      }

      const currentEnabled = isGitGuardrailsEnabled(ctx.cwd);
      const configPath = getProjectConfigPath(ctx.cwd);

      if (action === "status") {
        notify(
          ctx,
          `git-guardrails is ${currentEnabled ? "enabled" : "disabled"}. Project overrides live in ${configPath}`,
        );
        return;
      }

      const nextEnabled = action === "toggle" ? !currentEnabled : action === "enable";
      const saved = updateProjectGitGuardrailsEnabled(ctx.cwd, nextEnabled);

      notify(
        ctx,
        `git-guardrails ${nextEnabled ? "enabled" : "disabled"} in ${saved.path}. Reloading extension runtime...`,
        nextEnabled ? "info" : "warning",
      );

      await ctx.reload();
      return;
    },
  });
}
