import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { registerMessageRenderers } from "./UI/renderers.js";
import { registerAgentCommand } from "./commands/agent.js";
import { registerAgentPromptCommand } from "./commands/agent-prompt.js";
import { registerAgentSpawnCommand } from "./commands/agent-spawn.js";
import { registerAgentStatusCommand } from "./commands/agent-status.js";
import { registerToolsCompactionCommand } from "./commands/tools-compaction.js";
import { registerToolsStatusCommand } from "./commands/tools-status.js";
import { registerToolsCompactionExtension } from "./others/tools-compaction.js";
import { isSubagentEnabled } from "./subagents/config.js";
import { registerSubagentRuntime } from "./subagents/runtime.js";
import { registerDispatchTool } from "./tools/dispatch.js";
import { registerCustomToolsExtension } from "./tools/index.js";

export default function rameanExtensionPack(pi: ExtensionAPI, context?: ExtensionContext): void {
  const runningAsSubagent = registerSubagentRuntime(pi);
  registerCustomToolsExtension(pi);

  if (runningAsSubagent) {
    return;
  }

  registerMessageRenderers(pi);
  registerToolsStatusCommand(pi);
  registerToolsCompactionCommand(pi);
  registerToolsCompactionExtension(pi);
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
