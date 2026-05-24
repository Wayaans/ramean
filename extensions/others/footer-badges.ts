import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  createFooterRenderState,
  createFooterSnapshot,
  installFooterBadges,
  resetFooterRenderState,
  updateFooterSnapshot,
} from "../UI/footer-badges.js";

export function registerFooterBadgesExtension(pi: ExtensionAPI): void {
  const state = createFooterRenderState();

  const getThinkingLevel = (): string | undefined => {
    try {
      return pi.getThinkingLevel();
    } catch (error) {
      if (isStaleExtensionError(error)) {
        return state.snapshot.thinkingLevel;
      }
      throw error;
    }
  };

  const refresh = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return;
    const thinkingLevel = ctx.model?.reasoning ? getThinkingLevel() : undefined;
    updateFooterSnapshot(state, createFooterSnapshot(ctx, thinkingLevel));
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    const thinkingLevel = ctx.model?.reasoning ? getThinkingLevel() : undefined;
    updateFooterSnapshot(state, createFooterSnapshot(ctx, thinkingLevel));
    installFooterBadges(ctx, state, getThinkingLevel);
  });

  pi.on("model_select", async (_event, ctx) => {
    refresh(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    refresh(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    refresh(ctx);
  });

  pi.on("session_compact", async (_event, ctx) => {
    refresh(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    refresh(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    resetFooterRenderState(state);
    if (!ctx.hasUI) return;
    ctx.ui.setFooter(undefined);
  });
}

function isStaleExtensionError(error: unknown): boolean {
  return error instanceof Error && /stale after session replacement or reload/i.test(error.message);
}
