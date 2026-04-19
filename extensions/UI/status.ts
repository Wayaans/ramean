import type { DispatchStatus } from "../types/subagents.js";

export const RUNNING_STATUS_FRAMES = ["⚏", "⚍", "⚎", "⚌"] as const;

type ThemeLike = {
  fg(token: string, text: string): string;
};

export function getRunningStatusFrame(frame = 0): string {
  const normalized = Number.isFinite(frame) ? Math.abs(Math.trunc(frame)) : 0;
  return RUNNING_STATUS_FRAMES[normalized % RUNNING_STATUS_FRAMES.length] ?? RUNNING_STATUS_FRAMES[0];
}

export function getStatusGlyph(status: DispatchStatus, frame = 0): string {
  switch (status) {
    case "running":
      return getRunningStatusFrame(frame);
    case "success":
      return "✔";
    case "failed":
      return "✖";
    case "waiting":
    default:
      return "❖";
  }
}

export function getStatusColor(status: DispatchStatus): string {
  switch (status) {
    case "running":
      return "accent";
    case "success":
      return "success";
    case "failed":
      return "error";
    case "waiting":
    default:
      return "muted";
  }
}

export function renderStatusIcon(theme: ThemeLike, status: DispatchStatus, frame = 0): string {
  return theme.fg(getStatusColor(status), getStatusGlyph(status, frame));
}

export function renderStatusLabel(theme: ThemeLike, status: DispatchStatus, label: string, frame = 0): string {
  return `${renderStatusIcon(theme, status, frame)} ${theme.fg("text", label)}`;
}
