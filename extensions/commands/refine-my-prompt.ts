import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { getRefineMyPromptConfig, isRefineMyPromptEnabled } from "../core/refine-config.js";
import { findProjectRoot } from "../core/paths.js";

function buildUserPrompt(rawPrompt: string): string {
  return [
    "You are a prompt refinement expert.",
    "Rewrite the following prompt so it is clearer, more specific,",
    "and optimized for LLM understanding.",
    "Preserve the original intent. Do not add instructions that change the goal.",
    "Output only the refined prompt text — no explanations, no markdown fences, no preamble.",
    "",
    "Prompt to refine:",
    rawPrompt,
  ].join("\n");
}

function extractAssistantText(messages: Array<{ role: string; content?: unknown }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const parts = msg.content
        .filter((p): p is { type: "text"; text: string } => typeof p === "object" && p !== null && (p as { type?: string }).type === "text")
        .map((p) => (p as { text: string }).text)
        .join("\n");
      if (parts.trim()) return parts.trim();
    }
  }
  return "";
}

async function refineWithLLM(
  rawPrompt: string,
  provider: string,
  modelName: string,
  thinking: string,
  cwd: string,
): Promise<string> {
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  const authStorage = AuthStorage.create(agentDir);
  const modelRegistry = ModelRegistry.create(authStorage, agentDir ? `${agentDir}/models.json` : undefined);

  const model = modelRegistry.find(provider, modelName);
  if (!model) {
    throw new Error(`Model "${modelName}" not found for provider "${provider}". Run \`/model\` in pi to see available models.`);
  }

  const projectRoot = findProjectRoot(cwd);

  const { session } = await createAgentSession({
    cwd: projectRoot,
    agentDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: thinking as "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
    tools: [],
    sessionManager: SessionManager.inMemory(),
  });

  await session.prompt(buildUserPrompt(rawPrompt), { streamingBehavior: "followUp" });

  const refined = extractAssistantText(session.messages);
  return refined || rawPrompt;
}

export function registerRefineMyPromptCommand(pi: ExtensionAPI, cwd: string): void {
  if (!isRefineMyPromptEnabled(cwd)) return;

  pi.registerCommand("refine-my-prompt", {
    description: "Refine your prompt using LLM to make it clearer and more effective",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command only works in interactive mode.", "error");
        return;
      }

      const rawPrompt = args?.trim();
      if (!rawPrompt) {
        ctx.ui.notify("Usage: /refine-my-prompt <your prompt here>", "info");
        return;
      }

      const config = getRefineMyPromptConfig(cwd);

      ctx.ui.notify(`Refining prompt using ${config.model}...`, "info");

      try {
        const refined = await refineWithLLM(rawPrompt, config.provider, config.model, config.thinking, cwd);
        ctx.ui.setEditorText(refined);
        ctx.ui.notify("Prompt refined and placed in editor. Edit and submit when ready.", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Refinement failed: ${message}`, "error");
      }
    },
  });
}
