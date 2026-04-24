import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { buildWarningSummary, executeDispatch, formatDispatchProgress } from "../subagents/spawn.js";
import { clearStandaloneDispatchWidget, updateStandaloneDispatchWidget } from "../subagents/standalone-widget.js";
import { renderDispatchCall, renderDispatchResult } from "../UI/renderers.js";
import type { DispatchDetails } from "../types/subagents.js";

const DispatchParams = Type.Object({
  agent: Type.String({ description: "Subagent name or alias: agent/ag, designer/ds, reviewer/rv" }),
  task: Type.String({ description: "Task to delegate to the subagent" }),
});

export const RUNNING_DISPATCH_MESSAGE_UPDATE_INTERVAL_MS = 250;

export function getDispatchMessageUpdateKey(details: DispatchDetails): string {
  if (details.status === "running") {
    return JSON.stringify({
      status: details.status,
      title: details.title,
      task: details.task,
      progress: formatDispatchProgress(details),
    });
  }

  return JSON.stringify({
    status: details.status,
    title: details.title,
    task: details.task,
    output: details.output,
    warningSummary: buildWarningSummary(details) ?? "",
  });
}

export function shouldForwardDispatchMessageUpdate(
  lastUpdateKey: string | undefined,
  lastUpdateAt: number,
  details: DispatchDetails,
  now = Date.now(),
): { key: string; forward: boolean } {
  const key = getDispatchMessageUpdateKey(details);
  if (key === lastUpdateKey) {
    return { key, forward: false };
  }

  if (
    details.status === "running"
    && lastUpdateAt > 0
    && now - lastUpdateAt < RUNNING_DISPATCH_MESSAGE_UPDATE_INTERVAL_MS
  ) {
    return { key, forward: false };
  }

  return { key, forward: true };
}

export function registerDispatchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "dispatch",
    label: "Dispatch",
    description: "Dispatch a single task to one subagent. Built-ins: agent, designer, reviewer.",
    promptSnippet: "Dispatch one implementation or review task to agent, designer, or reviewer.",
    promptGuidelines: [
      "Use dispatch when you want one focused subagent to handle one task.",
      "Route by task shape: implementation work goes to agent or designer; review, audit, critique, and final-pass validation go to reviewer.",
      "Use agent for implementation-shaped non-UI work such as debugging, refactors, tests, tooling, and codebase analysis.",
      "Use designer for implementation-shaped UI/UX and front-end work such as layout, components, styling, accessibility, responsive behavior, and polish.",
      "Use reviewer only for read-only review, critique, validation, and final-pass analysis, including UI/UX or front-end reviews when the task is primarily evaluative.",
      "If a task needs both implementation and review, dispatch agent or designer first, then dispatch reviewer as a separate pass.",
      "When using agent or designer for implementation work, ask them to implement the change, not just suggest approaches, unless the user explicitly wants brainstorming or options only.",
      "Write dispatch tasks as clean structured briefs: state the goal, relevant context, important constraints, and the expected output or changed files when known.",
      "Include concrete paths, failing tests, commands, user-visible expectations, or risky areas when they matter to the delegated work.",
      "Keep the task readable and well-organized because the expanded dispatch UI shows the delegated task text directly.",
      "When multiple subagents are needed, issue multiple top-level dispatch calls in parallel instead of looking for an orchestration tool.",
      "Do not ask a subagent to dispatch other subagents.",
    ],
    parameters: DispatchParams,
    renderShell: "self",
    async execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<DispatchDetails>> {
      const widgetKey = `tool:${toolCallId}`;
      let lastMessageUpdateKey: string | undefined;
      let lastMessageUpdateAt = 0;

      try {
        const details = await executeDispatch({
          cwd: ctx.cwd,
          requestedAgent: params.agent,
          task: params.task,
          context: ctx,
          parentActiveTools: pi.getActiveTools(),
          signal,
          onUpdate: (partial) => {
            updateStandaloneDispatchWidget(ctx, widgetKey, partial);

            const now = Date.now();
            const decision = shouldForwardDispatchMessageUpdate(lastMessageUpdateKey, lastMessageUpdateAt, partial, now);
            if (!decision.forward) {
              return;
            }

            lastMessageUpdateKey = decision.key;
            lastMessageUpdateAt = now;
            onUpdate?.({
              content: [{ type: "text", text: partial.output || "(running...)" }],
              details: partial,
            });
          },
        });

        return {
          content: [{ type: "text", text: details.output || details.error || "(no output)" }],
          details,
        };
      } finally {
        clearStandaloneDispatchWidget(ctx, widgetKey);
      }
    },
    renderCall(args, theme) {
      return renderDispatchCall(args, theme);
    },
    renderResult(result, options, theme) {
      return renderDispatchResult(result, options, theme);
    },
  });
}
