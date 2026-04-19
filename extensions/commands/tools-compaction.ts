import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function registerToolsCompactionCommand(pi: ExtensionAPI): void {
  pi.registerCommand("tools:compaction", {
    description: "Compact the current session with ramean custom Gemini Flash summarization",
    handler: async (args, ctx) => {
      const customInstructions = args.trim() || undefined;

      if (ctx.hasUI) {
        ctx.ui.notify("Starting ramean custom compaction...", "info");
      }

      await ctx.waitForIdle();
      ctx.compact({
        customInstructions,
        onComplete: () => {
          if (ctx.hasUI) {
            ctx.ui.notify("Ramean custom compaction completed.", "info");
          }
        },
        onError: (error) => {
          if (ctx.hasUI) {
            ctx.ui.notify(`Ramean custom compaction failed: ${error.message}`, "error");
          }
        },
      });
    },
  });
}
