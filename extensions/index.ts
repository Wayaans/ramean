import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { registerMessageRenderers } from "./UI/renderers.js";
import { registerAgentCommand } from "./commands/agent.js";
import { registerAgentPromptCommand } from "./commands/agent-prompt.js";
import { registerAgentSpawnCommand } from "./commands/agent-spawn.js";
import { registerAgentStatusCommand } from "./commands/agent-status.js";
import { isSubagentEnabled } from "./subagents/config.js";
import { registerSubagentRuntime } from "./subagents/runtime.js";
import { registerDispatchTool } from "./tools/dispatch.js";

export default function rameanSubagents(pi: ExtensionAPI, context?: ExtensionContext): void {
  if (registerSubagentRuntime(pi)) {
    return;
  }

  registerMessageRenderers(pi);
  registerAgentCommand(pi);
  registerAgentStatusCommand(pi);
  registerAgentPromptCommand(pi);

  const cwd = context?.cwd ?? process.cwd();
  if (!isSubagentEnabled(cwd)) {
    return;
  }

  registerDispatchTool(pi);
  registerAgentSpawnCommand(pi);
}
