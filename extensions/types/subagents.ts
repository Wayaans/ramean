export type CanonicalAgentName = "agent" | "designer" | "reviewer";
export type AgentAlias = "ag" | "ds" | "rv";
export type AgentIdentifier = CanonicalAgentName | Uppercase<AgentAlias> | AgentAlias;
export type PromptMode = "append" | "replace";
export type DispatchStatus = "waiting" | "running" | "success" | "failed";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface AgentDefinition {
  name: CanonicalAgentName;
  title: string;
  shortName: Uppercase<AgentAlias>;
  icon: string;
  aliases: readonly string[];
  description: string;
}

export interface AgentRuntimeConfig {
  provider?: string;
  model?: string;
  thinking?: ThinkingLevel;
}

export interface ResolvedAgentRuntimeConfig {
  provider?: string;
  model?: string;
  modelArg?: string;
  thinking?: ThinkingLevel;
  fallbackNote?: string;
}

export interface SubagentConfig {
  extension: "subagent";
  enabled: boolean;
  agents: Record<CanonicalAgentName, AgentRuntimeConfig>;
}

export interface PromptResolution {
  agent: CanonicalAgentName;
  source: "default" | "project-append" | "project-replace" | "fallback-default";
  prompt: string;
  warnings: string[];
  projectFilePath: string;
}

export interface TranscriptToolCall {
  type: "toolCall";
  name: string;
  args: Record<string, unknown>;
}

export interface TranscriptText {
  type: "text";
  text: string;
}

export type TranscriptItem = TranscriptToolCall | TranscriptText;

export interface DispatchUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface DispatchDetails {
  agent: CanonicalAgentName;
  title: string;
  shortName: Uppercase<AgentAlias>;
  icon: string;
  task: string;
  status: DispatchStatus;
  spinnerFrame: number;
  output: string;
  warnings: string[];
  error?: string;
  exitCode: number;
  stopReason?: string;
  model?: string;
  usage: DispatchUsage;
  transcript: TranscriptItem[];
}

export interface AgentStatusRow {
  agent: CanonicalAgentName;
  title: string;
  shortName: Uppercase<AgentAlias>;
  provider?: string;
  model?: string;
  thinking?: ThinkingLevel;
  promptState: string;
  fallbackNote?: string;
}

export interface AgentStatusMessageDetails {
  enabled: boolean;
  agents: AgentStatusRow[];
}

export interface ProjectPromptFrontmatter {
  name?: string;
  mode?: string;
  [key: string]: unknown;
}
