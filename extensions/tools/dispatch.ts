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
    promptSnippet: "Dispatch a single task to agent, designer, or reviewer.",
    promptGuidelines: [
      "Use dispatch when you want one focused subagent to handle one task.",
      "When multiple subagents are needed, issue multiple top-level dispatch calls in parallel instead of looking for an orchestration tool.",
      "Do not ask a subagent to dispatch other subagents.",
      "Use agent for general code work such as implementation, exploration, debugging, refactors, and other non-UI tasks.",
      "Use designer only to implement or modify UI/UX and front-end work. Do not use designer for critique, review, feedback, advisory-only guidance, or planning-only requests.",
      "Use reviewer only for read-only review, feedback, and analysis work.",
      "After a non-trivial implementation, run reviewer as a final pass before responding unless the change is very small.",
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
