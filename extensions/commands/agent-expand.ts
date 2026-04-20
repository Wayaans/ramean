import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  applyDispatchExpansionAction,
  notifyDispatchExpansionState,
  parseDispatchExpansionAction,
  syncDispatchExpansionUI,
} from "../subagents/dispatch-expansion.js";

const COMPLETIONS: AutocompleteItem[] = [
  { value: "toggle", label: "toggle" },
  { value: "expand", label: "expand" },
  { value: "collapse", label: "collapse" },
  { value: "status", label: "status" },
];

function getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
  const normalized = prefix.trim().toLowerCase();
  const filtered = COMPLETIONS.filter((item) => item.value.startsWith(normalized));
  return filtered.length > 0 ? filtered : null;
}

export function registerAgentExpandCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent:expand", {
    description: "Toggle dispatch-only expansion for subagent dispatch cards",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      const action = parseDispatchExpansionAction(args);
      if (!action) {
        if (ctx.hasUI) {
          ctx.ui.notify("Usage: /agent:expand [toggle|expand|collapse|status]", "error");
        } else {
          console.error("Usage: /agent:expand [toggle|expand|collapse|status]");
        }
        return;
      }

      const enabled = applyDispatchExpansionAction(action);
      syncDispatchExpansionUI(ctx, enabled);
      notifyDispatchExpansionState(ctx, enabled, action);
    },
  });
}

export function registerAgentExpandShortcut(pi: ExtensionAPI): void {
  pi.registerShortcut("ctrl+shift+o", {
    description: "Toggle dispatch-only expansion",
    handler: async (ctx) => {
      const enabled = applyDispatchExpansionAction("toggle");
      syncDispatchExpansionUI(ctx, enabled);
      notifyDispatchExpansionState(ctx, enabled, "toggle");
    },
  });
}
