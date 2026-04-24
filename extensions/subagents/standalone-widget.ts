import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { formatDispatchWidget } from "../UI/renderers.js";
import { setDispatchWorkingIndicator } from "../UI/working-indicator.js";
import type { DispatchDetails } from "../types/subagents.js";

type UiContext = Pick<ExtensionContext, "ui"> | Pick<ExtensionCommandContext, "ui">;

const activeStandaloneDispatches = new Map<string, DispatchDetails>();
let dispatchWidgetActive = false;
let lastRenderedDispatchWidget: string | undefined;

function renderStandaloneDispatchWidget(ctx: UiContext): void {
  if (activeStandaloneDispatches.size === 0) {
    if (lastRenderedDispatchWidget !== undefined || dispatchWidgetActive) {
      ctx.ui.setWidget("ramean-dispatch", undefined);
    }
    if (dispatchWidgetActive) {
      setDispatchWorkingIndicator(ctx, false);
    }
    dispatchWidgetActive = false;
    lastRenderedDispatchWidget = undefined;
    return;
  }

  const widget = formatDispatchWidget([...activeStandaloneDispatches.values()], ctx.ui.theme);
  if (!dispatchWidgetActive) {
    setDispatchWorkingIndicator(ctx, true);
    dispatchWidgetActive = true;
  }
  if (widget === lastRenderedDispatchWidget) {
    return;
  }
  lastRenderedDispatchWidget = widget;
  ctx.ui.setWidget(
    "ramean-dispatch",
    [widget],
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
