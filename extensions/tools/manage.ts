import type { AgentToolResult, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { executeDispatch } from "../subagents/spawn.js";
import { renderManageCall, renderManageResult } from "../UI/renderers.js";
import type { ManageDetails } from "../types/subagents.js";

const ManageParams = Type.Object({
  mode: Type.Optional(StringEnum(["single"] as const, { default: "single", description: "Only single mode is supported in MVP." })),
  agent: Type.String({ description: "Subagent name or alias" }),
  task: Type.String({ description: "Task to delegate" }),
});

export function registerManageTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "manage",
    label: "Manage",
    description: "Manage subagent execution. MVP supports single mode only.",
    promptSnippet: "Manage subagent execution in single mode.",
    promptGuidelines: [
      "Use manage when you want orchestration semantics around a dispatch.",
      "MVP only supports single mode.",
    ],
    parameters: ManageParams,
    async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<ManageDetails>> {
      const dispatch = await executeDispatch({
        cwd: ctx.cwd,
        requestedAgent: params.agent,
        task: params.task,
        context: ctx,
        signal,
        onUpdate: (partial) => {
          const details: ManageDetails = {
            mode: "single",
            status: partial.status,
            dispatch: partial,
          };

          ctx.ui.setWidget("ramean-manage", [`⟩ MG:Single [${partial.status === "running" ? "⚏" : partial.status === "success" ? "✔" : "✖"}${partial.title}]`]);
          onUpdate?.({
            content: [{ type: "text", text: partial.output || "(running...)" }],
            details,
          });
        },
      });

      ctx.ui.setWidget("ramean-manage", undefined);

      const details: ManageDetails = {
        mode: "single",
        status: dispatch.status,
        dispatch,
      };

      return {
        content: [{ type: "text", text: dispatch.output || dispatch.error || "(no output)" }],
        details,
      };
    },
    renderCall(args, theme) {
      return renderManageCall(args, theme);
    },
    renderResult(result, options, theme) {
      return renderManageResult(result, options, theme);
    },
  });
}
