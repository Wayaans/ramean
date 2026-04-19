import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { formatReadOnlyBashError, isReadOnlyBash, normalizeAgentName } from "../core/utils.js";
import type { CanonicalAgentName } from "../types/subagents.js";

function getRoleFromEnv(): CanonicalAgentName | null {
  return normalizeAgentName(process.env.RAMEAN_SUBAGENT_ROLE ?? "agent");
}

function applyRoleToolRestrictions(pi: ExtensionAPI, role: CanonicalAgentName): void {
  const allTools = pi.getAllTools().map((tool) => tool.name);

  const filtered = allTools.filter((name) => {
    if (name === "manage" || name === "dispatch") return false;
    if (role === "reviewer" && (name === "edit" || name === "write")) return false;
    return true;
  });

  pi.setActiveTools(filtered);
}

export function registerSubagentRuntime(pi: ExtensionAPI): boolean {
  if (process.env.RAMEAN_SUBAGENT !== "1") {
    return false;
  }

  const role = getRoleFromEnv() ?? "agent";

  pi.on("session_start", async (_event, _ctx) => {
    applyRoleToolRestrictions(pi, role);
  });

  pi.on("before_agent_start", async (_event, _ctx) => {
    applyRoleToolRestrictions(pi, role);
  });

  pi.on("tool_call", async (event) => {
    if (event.toolName === "manage" || event.toolName === "dispatch") {
      return {
        block: true,
        reason: "Subagents cannot use manage or dispatch.",
      };
    }

    if (role !== "reviewer") return;

    if (event.toolName === "edit" || event.toolName === "write") {
      return {
        block: true,
        reason: "Reviewer is read-only and cannot modify files.",
      };
    }

    if (isToolCallEventType("bash", event) && !isReadOnlyBash(event.input.command)) {
      return {
        block: true,
        reason: formatReadOnlyBashError(event.input.command),
      };
    }
  });

  return true;
}
