import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { registerMessageRenderers } from "./UI/renderers.js";
import { registerAgentCommand } from "./commands/agent.js";
import { registerAgentExpandCommand, registerAgentExpandShortcut } from "./commands/agent-expand.js";
import { registerAgentInsertCommand } from "./commands/agent-insert.js";
import { registerAgentPromptCommand } from "./commands/agent-prompt.js";
import { registerAgentSpawnCommand } from "./commands/agent-spawn.js";
import { registerAgentStatusCommand } from "./commands/agent-status.js";
import { registerFlairCommands } from "./commands/flair.js";
import { registerGuardrailsGitCommand } from "./commands/guardrails-git.js";
import { registerToolsCompactionCommand } from "./commands/tools-compaction.js";
import { registerToolsStatusCommand } from "./commands/tools-status.js";
import { loadMergedOptionalExtensionsState } from "./others/config.js";
import { registerGitGuardrailsExtension } from "./others/git-guardrails.js";
import { registerHandoffCommand } from "./others/handoff.js";
import { registerMinimalModeExtension } from "./others/minimal-mode.js";
import { registerNotifyExtension } from "./others/notify.js";
import { registerToolsCompactionExtension } from "./others/tools-compaction.js";
import { isSubagentEnabled } from "./subagents/config.js";
import { registerSubagentRuntime } from "./subagents/runtime.js";
import { resetStandaloneDispatchWidget } from "./subagents/standalone-widget.js";
import { registerDispatchTool } from "./tools/dispatch.js";
import { registerCustomToolsExtension } from "./tools/index.js";

export default function rameanExtensionPack(pi: ExtensionAPI, context?: ExtensionContext): void {
  const cwd = context?.cwd ?? process.cwd();
  const runningAsSubagent = registerSubagentRuntime(pi);
  registerCustomToolsExtension(pi);
  registerGitGuardrailsExtension(pi, cwd);

  if (runningAsSubagent) {
    return;
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    resetStandaloneDispatchWidget(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    resetStandaloneDispatchWidget(ctx);
  });

  registerMessageRenderers(pi);
  registerGuardrailsGitCommand(pi);
  registerToolsStatusCommand(pi);
  registerToolsCompactionCommand(pi);
  registerToolsCompactionExtension(pi);
  registerAgentCommand(pi);
  registerAgentExpandCommand(pi);
  registerAgentExpandShortcut(pi);
  registerAgentInsertCommand(pi);
  registerAgentStatusCommand(pi);
  registerAgentPromptCommand(pi);
  registerFlairCommands(pi);

  const optionalExtensions = loadMergedOptionalExtensionsState(cwd);
  if (optionalExtensions.minimalMode) {
    registerMinimalModeExtension(pi);
  }
  if (optionalExtensions.handoff) {
    registerHandoffCommand(pi);
  }
  if (optionalExtensions.notify) {
    registerNotifyExtension(pi);
  }
  if (!isSubagentEnabled(cwd)) {
    return;
  }

  registerDispatchTool(pi);
  registerAgentSpawnCommand(pi);
}
