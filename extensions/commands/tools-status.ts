import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createToolsStatusMessage } from "../UI/renderers.js";
import { buildToolsStatusDetails } from "../tools/status.js";

export function registerToolsStatusCommand(pi: ExtensionAPI): void {
  pi.registerCommand("tools:status", {
    description: "Show available built-in and extension tools in current priority order",
    handler: async (_args, ctx) => {
      const details = buildToolsStatusDetails(pi, ctx.cwd);
      pi.sendMessage(createToolsStatusMessage(details));
    },
  });
}
