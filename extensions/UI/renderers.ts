import { Box, Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { getSubagent } from "../subagents/agents.js";
import { buildAgentStatusSummary } from "../subagents/status.js";
import { formatDispatchProgress, formatDispatchSummary } from "../subagents/spawn.js";
import { summarizeText, titleCase } from "../core/utils.js";
import type {
  AgentStatusMessageDetails,
  DispatchDetails,
  DispatchStatus,
} from "../types/subagents.js";
import { renderStatusIcon } from "./status.js";

export const DISPATCH_MESSAGE_TYPE = "ramean-dispatch";
export const AGENT_STATUS_MESSAGE_TYPE = "ramean-agent-status";

type RenderableComponent = {
  render(width: number): string[];
  invalidate?: () => void;
};

class LeftAccentCard {
  constructor(
    private readonly child: RenderableComponent,
    private readonly accent: string,
  ) {}

  render(width: number): string[] {
    const contentWidth = Math.max(1, width - 1);
    return this.child.render(contentWidth).map((line) => `${this.accent}${line}`);
  }

  invalidate(): void {
    this.child.invalidate?.();
  }
}

function formatAgentLabel(agentName: string | undefined): string {
  if (!agentName) return "Agent";
  return getSubagent(agentName)?.title ?? titleCase(String(agentName));
}

function createTextStack(lines: string[]): Container {
  const container = new Container();
  for (const line of lines) {
    container.addChild(new Text(line, 0, 0));
  }
  return container;
}

function createEmptyContainer(): Container {
  return new Container();
}

function getToolAccentColor(status: DispatchStatus): "success" | "error" | undefined {
  if (status === "success") return "success";
  if (status === "failed") return "error";
  return undefined;
}

function wrapToolCard(content: Container | Text, theme: any, status: DispatchStatus) {
  const box = new Box(1, 1, (text) => theme.bg("toolPendingBg", text));
  box.addChild(content);

  const accentColor = getToolAccentColor(status);
  if (!accentColor) return box;
  return new LeftAccentCard(box, theme.fg(accentColor, "▏"));
}

function wrapCustomMessageCard(content: Container | Text, theme: any): Box {
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(content);
  return box;
}

export function formatDispatchTaskPreview(task: string): string {
  return summarizeText(task.replace(/\s+/g, " ").trim(), 140);
}

function createCollapsedDispatchLines(details: DispatchDetails, theme: any): string[] {
  const lines: string[] = [];
  lines.push(
    `${renderStatusIcon(theme, details.status, details.spinnerFrame)} ${theme.fg("toolTitle", details.title)} ${theme.fg("muted", "⟩")} ${theme.fg("text", formatDispatchTaskPreview(details.task))}`,
  );

  if (details.status === "running") {
    lines.push(theme.fg("dim", `└╍ ${formatDispatchProgress(details)}`));
  } else {
    lines.push(theme.fg("dim", `└╍ ${formatDispatchSummary(details)}`));
  }

  return lines;
}

function createExpandedDispatchComponent(details: DispatchDetails, theme: any) {
  const container = new Container();
  container.addChild(
    new Text(
      `${renderStatusIcon(theme, details.status, details.spinnerFrame)} ${theme.fg("toolTitle", details.title)} ${theme.fg("muted", "⟩")} ${formatDispatchTaskPreview(details.task)}`,
      0,
      0,
    ),
  );

  container.addChild(new Text(theme.fg("dim", `└╍ ${details.status === "running" ? formatDispatchProgress(details) : formatDispatchSummary(details)}`), 0, 0));
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

  return container;
}

function createStatusComponent(details: AgentStatusMessageDetails, theme: any) {
  const container = new Container();
  container.addChild(new Text(theme.fg("toolTitle", "/agent:status"), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg("accent", "❯ EXTENSION :"), 0, 0));
  container.addChild(new Text(`enabled: ${details.enabled}`, 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg("accent", "❯ SUBAGENTS :"), 0, 0));

  for (const agent of details.agents) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(`${theme.fg("toolTitle", agent.title)} ${theme.fg("dim", `(${agent.shortName})`)}`, 0, 0));
    const runtime = [agent.provider, agent.model, agent.thinking].filter(Boolean).join("/") || "pi defaults";
    container.addChild(new Text(`runtime: ${runtime}`, 0, 0));
    container.addChild(new Text(`prompt: ${agent.promptState}`, 0, 0));
    if (agent.fallbackNote) {
      container.addChild(new Text(theme.fg("warning", `note: ${agent.fallbackNote}`), 0, 0));
    }
  }

  return container;
}

export function formatDispatchWidget(details: DispatchDetails | DispatchDetails[], theme: any): string {
  const dispatches = Array.isArray(details) ? details : [details];
  const labels = dispatches.map((dispatch) => `${renderStatusIcon(theme, dispatch.status, dispatch.spinnerFrame)}${theme.fg("text", dispatch.title)}`);
  return `${theme.fg("muted", "⟩")} [${labels.join(" ")}]`;
}

export function renderDispatchCall(_args: { agent?: string; task?: string }, _theme: any) {
  return createEmptyContainer();
}

export function renderDispatchResult(
  result: { details?: DispatchDetails },
  options: { expanded: boolean; isPartial: boolean },
  theme: any,
  context?: { args?: { agent?: string; task?: string } },
) {
  const details = result.details;
  if (!details) {
    if (options.isPartial) {
      const pending: DispatchDetails = {
        agent: "agent",
        title: formatAgentLabel(String(context?.args?.agent ?? "agent")),
        shortName: "AG",
        icon: "➽",
        task: String(context?.args?.task ?? ""),
        status: "running",
        spinnerFrame: 0,
        output: "",
        streamlinedProgress: "Starting subagent...",
        warnings: [],
        exitCode: 0,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0,
        },
        transcript: [],
      };
      return wrapToolCard(createTextStack(createCollapsedDispatchLines(pending, theme)), theme, "running");
    }
    return wrapToolCard(createTextStack([theme.fg("muted", "No dispatch details.")]), theme, "running");
  }

  if (!options.expanded) {
    return wrapToolCard(createTextStack(createCollapsedDispatchLines(details, theme)), theme, details.status);
  }

  return wrapToolCard(createExpandedDispatchComponent(details, theme), theme, details.status);
}

export function registerMessageRenderers(pi: ExtensionAPI): void {
  pi.registerMessageRenderer(DISPATCH_MESSAGE_TYPE, (message, options, theme) => {
    const details = message.details as DispatchDetails | undefined;
    if (!details) {
      const fallback = typeof message.content === "string" ? message.content : theme.fg("muted", "No dispatch output.");
      return wrapToolCard(createTextStack([fallback]), theme, "running");
    }

    return wrapToolCard(
      options.expanded
        ? createExpandedDispatchComponent(details, theme)
        : createTextStack(createCollapsedDispatchLines(details, theme)),
      theme,
      details.status,
    );
  });

  pi.registerMessageRenderer(AGENT_STATUS_MESSAGE_TYPE, (message, _options, theme) => {
    const details = message.details as AgentStatusMessageDetails | undefined;
    if (!details) {
      const fallback = typeof message.content === "string" ? message.content : theme.fg("muted", "No status available.");
      return wrapCustomMessageCard(createTextStack([fallback]), theme);
    }
    return wrapCustomMessageCard(createStatusComponent(details, theme), theme);
  });
}

export function createDispatchMessage(details: DispatchDetails) {
  return {
    customType: DISPATCH_MESSAGE_TYPE,
    content: details.error ?? details.output ?? "(no output)",
    display: true,
    details,
  } as const;
}

export function createStatusMessage(details: AgentStatusMessageDetails) {
  return {
    customType: AGENT_STATUS_MESSAGE_TYPE,
    content: buildAgentStatusSummary(details),
    display: true,
    details,
  } as const;
}
