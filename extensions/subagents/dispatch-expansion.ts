import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";

export type DispatchExpansionAction = "toggle" | "expand" | "collapse" | "status";

type UiCapableContext = Pick<ExtensionCommandContext, "hasUI" | "ui"> | Pick<ExtensionContext, "hasUI" | "ui">;

const ACTION_ALIASES: Record<string, DispatchExpansionAction> = {
  toggle: "toggle",
  expand: "expand",
  open: "expand",
  on: "expand",
  collapse: "collapse",
  close: "collapse",
  off: "collapse",
  status: "status",
};

let dispatchExpansionEnabled = false;

export function parseDispatchExpansionAction(args: string): DispatchExpansionAction | null {
  const normalized = args.trim().toLowerCase();
  if (!normalized) return "toggle";
  return ACTION_ALIASES[normalized] ?? null;
}

export function isDispatchExpansionEnabled(): boolean {
  return dispatchExpansionEnabled;
}

export function setDispatchExpansionEnabled(enabled: boolean): boolean {
  dispatchExpansionEnabled = enabled;
  return dispatchExpansionEnabled;
}

export function toggleDispatchExpansionEnabled(): boolean {
  dispatchExpansionEnabled = !dispatchExpansionEnabled;
  return dispatchExpansionEnabled;
}

export function applyDispatchExpansionAction(action: DispatchExpansionAction): boolean {
  if (action === "expand") return setDispatchExpansionEnabled(true);
  if (action === "collapse") return setDispatchExpansionEnabled(false);
  if (action === "status") return isDispatchExpansionEnabled();
  return toggleDispatchExpansionEnabled();
}

export function buildDispatchExpansionStatusLine(enabled: boolean): string {
  return enabled
    ? "Dispatch-only expansion is on. Subagent dispatch cards are expanded without changing other tool output."
    : "Dispatch-only expansion is off. Subagent dispatch cards follow the normal Ctrl+O tool expansion state.";
}

export function syncDispatchExpansionUI(ctx: UiCapableContext, enabled: boolean): void {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus("ramean-dispatch-expand", enabled ? "dispatch expanded" : undefined);
  // Re-apply the current tools-expanded state to force a chat redraw without changing
  // the user's normal Ctrl+O expansion preference for other tool cards.
  ctx.ui.setToolsExpanded(ctx.ui.getToolsExpanded());
}

export function notifyDispatchExpansionState(
  ctx: UiCapableContext,
  enabled: boolean,
  action: DispatchExpansionAction = "status",
): void {
  const message = action === "status"
    ? `${buildDispatchExpansionStatusLine(enabled)} This preference is session-local and resets on reload.`
    : `${buildDispatchExpansionStatusLine(enabled)} Use /agent:expand status to check the current state. This preference is session-local and resets on reload.`;

  if (ctx.hasUI) {
    ctx.ui.notify(message, "info");
    return;
  }

  console.log(message);
}
