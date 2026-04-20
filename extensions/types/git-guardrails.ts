export interface GitGuardrailsConfig {
  extension: "git-guardrails";
  enabled: boolean;
}

export type GitGuardrailsCommandAction = "toggle" | "enable" | "disable" | "status";

export interface GitGuardrailsStatusMessageDetails {
  enabled: boolean;
  configPath: string;
  reloading: boolean;
}

export interface DangerousGitPattern {
  label: string;
  pattern: RegExp;
}
