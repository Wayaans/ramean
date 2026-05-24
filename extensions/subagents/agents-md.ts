export type AgentsInsertPosition = "top" | "bottom";
export type AgentsInsertAction = "inserted" | "updated" | "unchanged";

export const RAMEAN_SUBAGENT_RULES_START = "<!-- ramean-subagents:start -->";
export const RAMEAN_SUBAGENT_RULES_END = "<!-- ramean-subagents:end -->";

export function buildSubagentRulesBlock(): string {
  return [
    RAMEAN_SUBAGENT_RULES_START,
    "## Ramean subagent hard rules",
    "",
    "- There are 3 subagents available through the `dispatch` tool: `agent`, `designer`, and `reviewer`. You can run them one at a time or in parallel with multiple top-level `dispatch` calls.",
    "- Route by task shape first: implementation work goes to `agent` or `designer`; review, audit, critique, and final-pass validation go to `reviewer`.",
    "- Use `agent` for implementation-shaped non-UI work such as debugging, refactors, tests, tooling, and codebase analysis. If the task is to change non-UI code, prefer `agent` over `reviewer`. Do not send UI/UX or front-end work to `agent`; use `designer` instead.",
    "- Use `designer` for implementation-shaped UI/UX and front-end work such as layout, components, styling, accessibility, responsive behavior, and polish. If the user wants the UI changed, built, fixed, or polished, prefer `designer` over `reviewer`. Do not use `designer` for critique-only, review-only, advisory-only, or planning-only work.",
    "- Use `reviewer` only for read-only review, critique, validation, and final-pass analysis. This includes UI/UX and front-end review when the task is primarily evaluative. Do not use `reviewer` to write code, scout for implementation, or act as the default subagent for mixed tasks.",
    "- If a task needs both implementation and review, dispatch `agent` or `designer` first, then dispatch `reviewer` as a separate pass.",
    "- When writing a dispatch task, make it a clean brief: include the goal, relevant context, important constraints, and the expected output or changed files when known.",
    "- Include concrete file paths, failing tests, commands, user-visible expectations, or risky areas when they matter.",
    RAMEAN_SUBAGENT_RULES_END,
  ].join("\n");
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function replaceManagedBlock(content: string, block: string): { content: string; replaced: boolean } {
  const pattern = new RegExp(
    `${escapeRegex(RAMEAN_SUBAGENT_RULES_START)}[\\s\\S]*?${escapeRegex(RAMEAN_SUBAGENT_RULES_END)}`,
    "g",
  );

  let seenMatch = false;
  let replaced = false;
  const nextContent = content.replace(pattern, () => {
    replaced = true;
    if (seenMatch) {
      return "";
    }
    seenMatch = true;
    return block;
  });

  return {
    content: nextContent,
    replaced,
  };
}

export function upsertSubagentRules(
  content: string,
  position: AgentsInsertPosition = "bottom",
): { content: string; action: AgentsInsertAction } {
  const block = buildSubagentRulesBlock();
  const { content: replacedContent, replaced } = replaceManagedBlock(content, block);

  if (replaced) {
    return {
      content: replacedContent === content ? content : replacedContent,
      action: replacedContent === content ? "unchanged" : "updated",
    };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { content: `${block}\n`, action: "inserted" };
  }

  if (position === "top") {
    const separator = content.startsWith("\n\n") ? "" : content.startsWith("\n") ? "\n" : "\n\n";
    return {
      content: `${block}${separator}${content}`,
      action: "inserted",
    };
  }

  const separator = content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  return {
    content: `${content}${separator}${block}\n`,
    action: "inserted",
  };
}
