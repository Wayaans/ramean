import type { AgentDefinition, CanonicalAgentName } from "../types/subagents.js";
import { normalizeAgentName } from "../core/utils.js";

export const SUBAGENTS: Record<CanonicalAgentName, AgentDefinition> = {
  agent: {
    name: "agent",
    title: "Agent",
    shortName: "AG",
    icon: "➽",
    aliases: ["agent", "ag"],
    description: "Non-UI implementation specialist for debugging, refactors, tests, tooling, and codebase analysis.",
  },
  designer: {
    name: "designer",
    title: "Designer",
    shortName: "DS",
    icon: "➽",
    aliases: ["designer", "ds"],
    description: "UI/UX and front-end implementation specialist for accessibility, responsiveness, and polish.",
  },
  reviewer: {
    name: "reviewer",
    title: "Reviewer",
    shortName: "RV",
    icon: "➽",
    aliases: ["reviewer", "rv"],
    description: "Read-only reviewer for critique, validation, and final-pass analysis.",
  },
};

export function getSubagent(name: string | CanonicalAgentName): AgentDefinition | null {
  const normalized = normalizeAgentName(name);
  return normalized ? SUBAGENTS[normalized] : null;
}

export function listSubagentNames(): CanonicalAgentName[] {
  return Object.keys(SUBAGENTS) as CanonicalAgentName[];
}

export function formatAgentChoices(): string[] {
  return listSubagentNames().map((name) => {
    const agent = SUBAGENTS[name];
    return `${agent.title} (${agent.shortName}) — ${agent.description}`;
  });
}

export function validAgentHint(): string {
  return listSubagentNames()
    .map((name) => {
      const agent = SUBAGENTS[name];
      return `${agent.name} (${agent.shortName})`;
    })
    .join(", ");
}
