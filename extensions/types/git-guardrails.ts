export interface GitGuardrailsConfig {
  extension: "git-guardrails";
  enabled: boolean;
}

export type GitGuardrailsCommandAction = "toggle" | "enable" | "disable" | "status";

export interface DangerousGitPattern {
  label: string;
  pattern: RegExp;
}
