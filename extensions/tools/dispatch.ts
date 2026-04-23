import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { executeDispatch } from "../subagents/spawn.js";
import { clearStandaloneDispatchWidget, updateStandaloneDispatchWidget } from "../subagents/standalone-widget.js";
import { renderDispatchCall, renderDispatchResult } from "../UI/renderers.js";
import type { DispatchDetails } from "../types/subagents.js";

const DispatchParams = Type.Object({
  agent: Type.String({ description: "Subagent name or alias: agent/ag, designer/ds, reviewer/rv" }),
  task: Type.String({ description: "Task to delegate to the subagent" }),
});

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
      "When multiple subagents are needed, issue multiple top-level dispatch calls in parallel instead of looking for an orchestration tool.",
      "Do not ask a subagent to dispatch other subagents.",
    ],
    parameters: DispatchParams,
    renderShell: "self",
    async execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<DispatchDetails>> {
      const widgetKey = `tool:${toolCallId}`;

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
