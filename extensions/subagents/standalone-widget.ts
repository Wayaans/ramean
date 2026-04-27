import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { formatDispatchWidget } from "../UI/renderers.js";
import { setDispatchWorkingIndicator } from "../UI/working-indicator.js";
import type { DispatchDetails } from "../types/subagents.js";

type UiContext = Pick<ExtensionContext, "ui"> | Pick<ExtensionCommandContext, "ui">;

const SPINNER_INTERVAL_MS = 500;

const activeStandaloneDispatches = new Map<string, DispatchDetails>();
let dispatchWidgetActive = false;
let lastRenderedDispatchWidget: string | undefined;
let spinnerInterval: ReturnType<typeof setInterval> | undefined;
let spinnerCtx: UiContext | undefined;

function startSpinnerTimer(ctx: UiContext): void {
  if (spinnerInterval !== undefined) return;
  spinnerCtx = ctx;
  spinnerInterval = setInterval(() => {
    if (!spinnerCtx) return;
    try {
      for (const details of activeStandaloneDispatches.values()) {
        if (details.status === "running") {
          details.spinnerFrame = (details.spinnerFrame + 1) % 4;
        }
      }
      renderStandaloneDispatchWidget(spinnerCtx);
    } catch {
      // Silently stop the timer if the UI context becomes invalid
      stopSpinnerTimer();
    }
  }, SPINNER_INTERVAL_MS);
}

function stopSpinnerTimer(): void {
  if (spinnerInterval !== undefined) {
    clearInterval(spinnerInterval);
    spinnerInterval = undefined;
    spinnerCtx = undefined;
  }
}

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
    stopSpinnerTimer();
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
  startSpinnerTimer(ctx);
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
  stopSpinnerTimer();
  renderStandaloneDispatchWidget(ctx);
}
