import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";

const MINIMAL_MODE_INTERVAL_MS = 140;
const DISPATCH_INTERVAL_MS = 100;

type UiContext = Pick<ExtensionContext, "ui"> | Pick<ExtensionCommandContext, "ui">;

type ThemeLike = {
  fg(token: string, text: string): string;
};

type IndicatorUi = {
  theme: ThemeLike;
  setWorkingIndicator?: (options?: { frames?: string[]; intervalMs?: number }) => void;
};

let minimalModeIndicatorEnabled = false;
let dispatchIndicatorActive = false;

function getMinimalModeIndicator(theme: ThemeLike) {
  return {
    frames: [
      theme.fg("dim", "·"),
      theme.fg("muted", "•"),
      theme.fg("accent", "●"),
      theme.fg("muted", "•"),
    ],
    intervalMs: MINIMAL_MODE_INTERVAL_MS,
  };
}

function getDispatchIndicator(theme: ThemeLike) {
  return {
    frames: [
      theme.fg("accent", "⚏"),
      theme.fg("accent", "⚍"),
      theme.fg("accent", "⚎"),
      theme.fg("accent", "⚌"),
    ],
    intervalMs: DISPATCH_INTERVAL_MS,
  };
}

function applyWorkingIndicator(ui: IndicatorUi): void {
  if (typeof ui.setWorkingIndicator !== "function") {
    return;
  }

  if (dispatchIndicatorActive) {
    ui.setWorkingIndicator(getDispatchIndicator(ui.theme));
    return;
  }

  if (minimalModeIndicatorEnabled) {
    ui.setWorkingIndicator(getMinimalModeIndicator(ui.theme));
    return;
  }

  ui.setWorkingIndicator();
}

function getIndicatorUi(ctx: UiContext): IndicatorUi {
  return ctx.ui as unknown as IndicatorUi;
}

export function setMinimalModeWorkingIndicator(ctx: UiContext, enabled: boolean): void {
  minimalModeIndicatorEnabled = enabled;
  applyWorkingIndicator(getIndicatorUi(ctx));
}

export function setDispatchWorkingIndicator(ctx: UiContext, active: boolean): void {
  dispatchIndicatorActive = active;
  applyWorkingIndicator(getIndicatorUi(ctx));
}

export function getWorkingIndicatorState(): { minimalMode: boolean; dispatch: boolean } {
  return {
    minimalMode: minimalModeIndicatorEnabled,
    dispatch: dispatchIndicatorActive,
  };
}
