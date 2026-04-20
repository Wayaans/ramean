import type { GitGuardrailsStatusMessageDetails } from "../types/git-guardrails.js";

export function buildGitGuardrailsStatusSummary(details: GitGuardrailsStatusMessageDetails): string {
  const lines = [
    "/guardrails:git",
    `- state: ${details.enabled ? "enabled" : "disabled"}`,
    `- effect: ${details.enabled ? "dangerous git bash commands are blocked" : "git bash commands are allowed to run normally"}`,
    `- project override path: ${details.configPath}`,
    `- runtime: ${details.reloading ? "reloading now so the new state applies immediately" : "already using the current state"}`,
    "- hint: use /guardrails:git enable|disable|status",
  ];

  return lines.join("\n");
}
