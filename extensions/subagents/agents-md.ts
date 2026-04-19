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
    "- Use `agent` for general code work such as implementation, exploration, debugging, refactors, and other non-UI tasks. Do not send UI/UX or front-end work to `agent`; use `designer` instead. Do not use `agent` when the task is primarily code review.",
    "- Use `designer` only to implement or modify UI/UX and front-end work. Do not use `designer` for critique, feedback, review, advisory-only guidance, planning-only requests, or non-UI logic. Use `reviewer` for feedback and `agent` for non-UI logic or general coding.",
    "- Use `reviewer` only for read-only review, feedback, and analysis. Do not use `reviewer` to write code, explore aimlessly, or scout for implementation work. After any non-trivial implementation, run `reviewer` as the final pass unless the change is very small.",
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
