import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createStatusMessage } from "../UI/renderers.js";
import { buildAgentStatusDetails } from "../subagents/status.js";

export function registerAgentStatusCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent:status", {
    description: "Show current subagent runtime status, prompt state, and extension settings",
    handler: async (_args, ctx) => {
      const details = buildAgentStatusDetails(ctx);
      pi.sendMessage(createStatusMessage(details));
    },
  });
}
