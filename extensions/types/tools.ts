export const CUSTOM_TOOL_NAMES = [
  "grep",
  "glob",
  "list",
  "todo_write",
  "question",
  "questionnaire",
  "web_fetch",
  "find_docs",
] as const;

export type CustomToolName = (typeof CUSTOM_TOOL_NAMES)[number];
export type CustomToolConfigState = Record<CustomToolName, boolean>;
export type ToolSourceKind = "builtin" | "extension";

export interface ToolsExtensionConfig {
  extension: "tools";
  enabled: boolean;
  tools: CustomToolConfigState;
}

export interface ToolStatusRow {
  name: string;
  source: ToolSourceKind;
  description: string;
  active: boolean;
  priority?: number;
}

export interface ToolsStatusMessageDetails {
  enabled: boolean;
  runtime: "main" | "subagent";
  activeTools: ToolStatusRow[];
  inactiveTools: ToolStatusRow[];
  disabledByConfig: CustomToolName[];
}
