import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { formatDispatchWidget } from "../UI/renderers.js";
import { setDispatchWorkingIndicator } from "../UI/working-indicator.js";
import type { DispatchDetails } from "../types/subagents.js";

type UiContext = Pick<ExtensionContext, "ui"> | Pick<ExtensionCommandContext, "ui">;

const activeStandaloneDispatches = new Map<string, DispatchDetails>();

function renderStandaloneDispatchWidget(ctx: UiContext): void {
  if (activeStandaloneDispatches.size === 0) {
    ctx.ui.setWidget("ramean-dispatch", undefined);
    setDispatchWorkingIndicator(ctx, false);
    return;
  }

  setDispatchWorkingIndicator(ctx, true);
  ctx.ui.setWidget(
    "ramean-dispatch",
    [formatDispatchWidget([...activeStandaloneDispatches.values()], ctx.ui.theme)],
    { placement: "aboveEditor" },
  );
}

export function updateStandaloneDispatchWidget(ctx: UiContext, key: string, details: DispatchDetails): void {
  activeStandaloneDispatches.set(key, details);
  renderStandaloneDispatchWidget(ctx);
}

export function clearStandaloneDispatchWidget(ctx: UiContext, key: string): void {
  activeStandaloneDispatches.delete(key);
  renderStandaloneDispatchWidget(ctx);
}

export function resetStandaloneDispatchWidget(ctx: UiContext): void {
  activeStandaloneDispatches.clear();
  renderStandaloneDispatchWidget(ctx);
}
