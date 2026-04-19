import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, SessionBeforeCompactEvent } from "@mariozechner/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

const COMPACTION_PROVIDER = "github-copilot";
const COMPACTION_MODEL_ID = "gemini-3-flash-preview";
const COMPACTION_MAX_TOKENS = 8192;

export function registerToolsCompactionExtension(pi: ExtensionAPI): void {
  pi.on("session_before_compact", async (event, ctx) => summarizeCompaction(event, ctx));
}

export function buildToolsCompactionPrompt(
  conversationText: string,
  previousSummary?: string,
  customInstructions?: string,
): string {
  const sections = [
    "You are a session compaction assistant for Pi.",
    "Create a structured Markdown summary that preserves everything needed to continue the work after older history is discarded.",
    "Be concise, but do not omit important decisions, blockers, file paths, technical details, or pending work.",
    "Prefer these sections when relevant:",
    "- Goal",
    "- Constraints & Preferences",
    "- Progress",
    "- Key Decisions",
    "- Next Steps",
    "- Critical Context",
    "- <read-files>",
    "- <modified-files>",
  ];

  if (customInstructions?.trim()) {
    sections.push(`Additional user instructions:\n${customInstructions.trim()}`);
  }

  if (previousSummary?.trim()) {
    sections.push(`Previous session summary:\n${previousSummary.trim()}`);
  }

  sections.push("<conversation>", conversationText, "</conversation>");
  return sections.join("\n\n");
}

async function summarizeCompaction(event: SessionBeforeCompactEvent, ctx: ExtensionContext) {
  const { preparation, customInstructions, signal } = event;
  const { messagesToSummarize, turnPrefixMessages, previousSummary, firstKeptEntryId, tokensBefore } = preparation;
  const model = ctx.modelRegistry.find(COMPACTION_PROVIDER, COMPACTION_MODEL_ID);

  if (!model) {
    notify(ctx, `Custom compaction model ${COMPACTION_PROVIDER}/${COMPACTION_MODEL_ID} was not found. Using default compaction.`, "warning");
    return;
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    notify(ctx, `Custom compaction auth failed: ${auth.error}. Using default compaction.`, "warning");
    return;
  }

  const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
  const conversationText = serializeConversation(convertToLlm(allMessages));
  const prompt = buildToolsCompactionPrompt(conversationText, previousSummary, customInstructions);

  try {
    const response = await complete(
      model,
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: COMPACTION_MAX_TOKENS,
        signal,
      },
    );

    const summary = response.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!summary) {
      if (!signal.aborted) {
        notify(ctx, "Custom compaction returned an empty summary. Using default compaction.", "warning");
      }
      return;
    }

    return {
      compaction: {
        summary,
        firstKeptEntryId,
        tokensBefore,
      },
    };
  } catch (error) {
    if (signal.aborted) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    notify(ctx, `Custom compaction failed: ${message}. Using default compaction.`, "error");
    return;
  }
}

function notify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  }
}
