import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerMessageRenderers } from "./UI/renderers.js";
import { registerAgentCommand } from "./commands/agent.js";
import { registerAgentPromptCommand } from "./commands/agent-prompt.js";
import { registerAgentSpawnCommand } from "./commands/agent-spawn.js";
import { registerSubagentRuntime } from "./subagents/runtime.js";
import { registerDispatchTool } from "./tools/dispatch.js";
import { registerManageTool } from "./tools/manage.js";

export default function rameanSubagents(pi: ExtensionAPI): void {
  if (registerSubagentRuntime(pi)) {
    return;
  }

  registerMessageRenderers(pi);
  registerDispatchTool(pi);
  registerManageTool(pi);
  registerAgentCommand(pi);
  registerAgentPromptCommand(pi);
  registerAgentSpawnCommand(pi);
}
