import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { DispatchDetails, ManageDetails } from "../types/subagents.js";
import { buildWarningSummary, formatDispatchSummary, formatTranscript } from "../subagents/spawn.js";
import { formatUsage } from "../core/utils.js";

export const DISPATCH_MESSAGE_TYPE = "ramean-dispatch";

function statusIcon(status: DispatchDetails["status"]): string {
  switch (status) {
    case "running":
      return "⚏";
    case "success":
      return "✔";
    case "failed":
      return "✖";
    case "waiting":
    default:
      return "❖";
  }
}

function createCollapsedDispatchText(details: DispatchDetails, theme: any): string {
  const lines: string[] = [];
  lines.push(
    `${theme.fg("toolTitle", `${statusIcon(details.status)} ${details.title}`)} ${theme.fg("muted", "⟩")} ${theme.fg("text", details.task)}`,
  );

  if (details.status === "running") {
    lines.push(theme.fg("dim", "└╍ Waiting streamline response..."));
  } else {
    lines.push(theme.fg("dim", `└╍ ${formatDispatchSummary(details)}`));
  }

  const transcript = formatTranscript(details).slice(-3);
  if (transcript.length > 0) {
    for (const item of transcript) {
      lines.push(theme.fg("muted", `   ${item}`));
    }
  }

  const usage = formatUsage(details.usage, details.model);
  if (usage) {
    lines.push(theme.fg("dim", usage));
  }

  return lines.join("\n");
}

function createExpandedDispatchComponent(details: DispatchDetails, theme: any) {
  const container = new Container();
  container.addChild(
    new Text(
      `${theme.fg("toolTitle", `${statusIcon(details.status)} ${details.title}`)} ${theme.fg("muted", "⟩")} ${details.task}`,
      0,
      0,
    ),
  );

  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg("accent", "❯ TASK :"), 0, 0));
  container.addChild(new Text(details.task, 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg("accent", "❯ OUTPUT :"), 0, 0));
  container.addChild(new Markdown(details.output || "(no output)", 0, 0, getMarkdownTheme()));

  if (details.warnings.length > 0 || details.error) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("warning", "❯ WARNING/ERROR :"), 0, 0));
    const text = [details.error, ...details.warnings].filter(Boolean).join("\n");
    container.addChild(new Text(text, 0, 0));
  }

  if (details.transcript.length > 0) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("accent", "❯ TRANSCRIPT :"), 0, 0));
    container.addChild(new Text(formatTranscript(details).join("\n"), 0, 0));
  }

  const usage = formatUsage(details.usage, details.model);
  if (usage) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", usage), 0, 0));
  }

  return container;
}

export function renderDispatchCall(args: { agent?: string; task?: string }, theme: any) {
  const agent = String(args.agent ?? "agent");
  const task = String(args.task ?? "");
  return new Text(`${theme.fg("toolTitle", "➽ ")} ${theme.fg("accent", agent)} ${theme.fg("muted", "⟩")} ${task}`, 0, 0);
}

export function renderDispatchResult(result: { details?: DispatchDetails }, options: { expanded: boolean; isPartial: boolean }, theme: any) {
  const details = result.details;
  if (!details) {
    return new Text(theme.fg("muted", options.isPartial ? "Waiting..." : "No dispatch details."), 0, 0);
  }

  if (!options.expanded) {
    return new Text(createCollapsedDispatchText(details, theme), 0, 0);
  }

  return createExpandedDispatchComponent(details, theme);
}

export function renderManageCall(args: { agent?: string }, theme: any) {
  const agent = String(args.agent ?? "agent");
  return new Text(`${theme.fg("toolTitle", "❏ Single")} [${theme.fg("accent", `➽ ${agent}`)}]`, 0, 0);
}

export function renderManageResult(result: { details?: ManageDetails }, options: { expanded: boolean }, theme: any) {
  const details = result.details;
  if (!details) {
    return new Text(theme.fg("muted", "No manage details."), 0, 0);
  }

  if (!options.expanded) {
    const usage = formatUsage(details.dispatch.usage, details.dispatch.model);
    const lines = [
      `${theme.fg("toolTitle", `❏ Single [➽ ${details.dispatch.title}]`)}`,
      theme.fg("dim", formatDispatchSummary(details.dispatch)),
    ];
    if (usage) lines.push(theme.fg("dim", usage));
    return new Text(lines.join("\n"), 0, 0);
  }

  return createExpandedDispatchComponent(details.dispatch, theme);
}

export function registerMessageRenderers(pi: ExtensionAPI): void {
  pi.registerMessageRenderer(DISPATCH_MESSAGE_TYPE, (message, options, theme) => {
    const details = message.details as DispatchDetails | undefined;
    if (!details) {
      return new Text(message.content || theme.fg("muted", "No dispatch output."), 0, 0);
    }
    return renderDispatchResult({ details }, { expanded: options.expanded, isPartial: false }, theme);
  });
}

export function createDispatchMessage(details: DispatchDetails) {
  return {
    customType: DISPATCH_MESSAGE_TYPE,
    content: buildWarningSummary(details) ?? details.error ?? details.output,
    display: true,
    details,
  } as const;
}
