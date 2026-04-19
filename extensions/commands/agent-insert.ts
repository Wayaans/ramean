import fs from "node:fs";
import path from "node:path";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findProjectRoot } from "../core/paths.js";
import type { AgentsInsertPosition } from "../subagents/agents-md.js";
import { upsertSubagentRules } from "../subagents/agents-md.js";

function getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
  const items = [
    { value: "top", label: "top" },
    { value: "bottom", label: "bottom" },
  ];

  const trimmed = prefix.trim().toLowerCase();
  const filtered = items.filter((item) => item.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}

function resolveInsertPosition(value: string): AgentsInsertPosition | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "top" || normalized === "bottom") return normalized;
  return null;
}

export function registerAgentInsertCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent:insert", {
    description: "Insert or refresh a managed subagent hard-rule block in the project AGENTS.md",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      const requestedPosition = resolveInsertPosition(args);
      if (args.trim() && !requestedPosition) {
        ctx.ui.notify("Usage: /agent:insert [top|bottom]", "warning");
        return;
      }

      const position = requestedPosition ?? "bottom";
      const projectRoot = findProjectRoot(ctx.cwd);
      const agentsFile = path.join(projectRoot, "AGENTS.md");

      if (!fs.existsSync(agentsFile)) {
        ctx.ui.notify(`No AGENTS.md found at ${agentsFile}. Create it first, then rerun /agent:insert.`, "warning");
        return;
      }

      const original = fs.readFileSync(agentsFile, "utf-8");
      const result = upsertSubagentRules(original, position);

      if (result.action === "unchanged") {
        ctx.ui.notify(`Subagent hard rules already present in ${agentsFile}`, "info");
        return;
      }

      fs.writeFileSync(agentsFile, result.content, "utf-8");
      const verb = result.action === "updated" ? "Updated" : "Inserted";
      ctx.ui.notify(`${verb} subagent hard rules in ${agentsFile}`, "info");
    },
  });
}
