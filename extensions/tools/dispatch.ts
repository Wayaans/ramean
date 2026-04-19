import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { executeDispatch } from "../subagents/spawn.js";
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
      "Do not ask a subagent to dispatch or manage other subagents.",
      "Use designer only for UI/UX or front-end work.",
      "Use reviewer for read-only review and analysis work.",
    ],
    parameters: DispatchParams,
    async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<DispatchDetails>> {
      const details = await executeDispatch({
        cwd: ctx.cwd,
        requestedAgent: params.agent,
        task: params.task,
        context: ctx,
        signal,
        onUpdate: (partial) => {
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
    },
    renderCall(args, theme) {
      return renderDispatchCall(args, theme);
    },
    renderResult(result, options, theme) {
      return renderDispatchResult(result, options, theme);
    },
  });
}
