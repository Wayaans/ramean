import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const RAMEAN_COMMIT_SKILL_PATH = new URL("../../skills/ramean-commit/SKILL.md", import.meta.url);
const RAMEAN_COMMIT_SKILL_BODY = readFileSync(RAMEAN_COMMIT_SKILL_PATH, "utf-8")
  .replace(/^---[\s\S]*?---\s*/, "")
  .trim();

export function buildRameanCommitContent(args: string): string {
  const trimmed = args.trim();
  return trimmed ? `${RAMEAN_COMMIT_SKILL_BODY}\n\nUser: ${trimmed}` : RAMEAN_COMMIT_SKILL_BODY;
}

export function registerRameanCommitCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ramean:commit", {
    description: "Generate a terse Conventional Commit message via the ramean-commit skill",
    handler: async (args, ctx) => {
      const content = buildRameanCommitContent(args);

      if (ctx.isIdle()) {
        pi.sendMessage({ customType: "ramean-commit", content, display: false }, { triggerTurn: true });
        return;
      }

      pi.sendMessage({ customType: "ramean-commit", content, display: false }, { deliverAs: "followUp" });
    },
  });
}
