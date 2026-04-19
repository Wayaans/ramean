import path from "node:path";
import type { CanonicalAgentName, DispatchUsage, ThinkingLevel } from "../types/subagents.js";

const AGENT_NAME_MAP: Record<string, CanonicalAgentName> = {
  agent: "agent",
  ag: "agent",
  designer: "designer",
  ds: "designer",
  reviewer: "reviewer",
  rv: "reviewer",
};

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function normalizeAgentName(value: string | undefined | null): CanonicalAgentName | null {
  if (!value) return null;
  return AGENT_NAME_MAP[value.trim().toLowerCase()] ?? null;
}

export function getThinkingLevels(): readonly ThinkingLevel[] {
  return THINKING_LEVELS;
}

export function parseCommandArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let index = 0; index < argsString.length; index += 1) {
    const char = argsString[index];
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === " " || char === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  return args;
}

export function formatTokens(count: number): string {
  if (count < 1_000) return String(count);
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatUsage(usage: DispatchUsage, model?: string): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens) parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  if (model) parts.push(model);
  return parts.join(" ");
}

export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function shortenPath(filePath: string): string {
  const home = process.env.HOME ?? "";
  return home && filePath.startsWith(home) ? `~${filePath.slice(home.length)}` : filePath;
}

export function summarizeText(text: string, maxLength = 140): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 3)}...`;
}

function includesAny(text: string, signals: readonly string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function matchesAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function looksLikeDesignerTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const positivePatterns = [
    /\b(ui|ux|frontend|front-end)\b/,
    /\b(component|page|layout|css|scss|tailwind|style|styling|design|visual|dashboard|icon|button|modal|form|sidebar|navbar|typography|color|animation|hover|responsive|accessibility)\b/,
    /\.(tsx|jsx|vue|svelte|css|scss|html)\b/,
    /\b(header|footer)\b.*\bspacing\b/,
    /\bspacing\b.*\b(header|footer|layout|page|button|form|sidebar|navbar)\b/,
    /\b(sidebar|navbar|layout|page|component)\b.*\b(mobile|desktop|breakpoint)\b/,
    /\b(mobile|desktop|breakpoint)\b.*\b(sidebar|navbar|layout|page|component)\b/,
  ];

  return matchesAnyPattern(normalized, positivePatterns);
}

export function looksLikeAuthoringTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const authoringPatterns = [
    /^\s*(please\s+|can you\s+)?(implement|build|create|code|edit|refactor|revamp|redesign|restyle|polish|ship|convert)\b/,
    /^\s*(please\s+|can you\s+)?write\b.*\b(code|component|page|ui|screen|view|file|function|test|css|style|styles)\b/,
    /^\s*(please\s+|can you\s+)?(add|remove|replace)\b.*\b(button|component|page|route|field|form|style|styles|css|tsx|jsx|file|test|function|ui|screen|view)\b/,
  ];

  return matchesAnyPattern(normalized, authoringPatterns);
}

export function looksLikeImplementationTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const implementationSignals = [
    "fix",
    "update",
    "change",
    "tweak",
  ];

  return looksLikeAuthoringTask(task) || includesAny(normalized, implementationSignals);
}

export function looksLikeReviewFeedbackTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const reviewPatterns = [
    /^\s*review\b/,
    /\breview\b\s+(this|the|current|my|our|changes|code|pr|pull request|implementation|ui)\b/,
    /\bgive\b.*\bfeedback\b/,
    /\bfeedback\b/,
    /\bcritique\b/,
    /\baudit\b/,
    /\bevaluate\b/,
    /\bassessment\b/,
    /\bassess\b/,
    /\bcompare\b/,
    /\bsuggest\b/,
    /\brecommend\b/,
    /\badvice\b/,
    /\bopinion\b/,
  ];

  return matchesAnyPattern(normalized, reviewPatterns);
}

export function looksLikeReviewTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const analysisPatterns = [
    /^\s*analy[sz]e\b/,
    /^\s*inspect\b/,
    /\banalysis\b/,
    /\bsummarize\b.*\bissues\b/,
  ];

  return looksLikeReviewFeedbackTask(task) || matchesAnyPattern(normalized, analysisPatterns);
}

export function looksLikeAdvisoryTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const advisoryPatterns = [
    /\bhow should\b/,
    /\bwhat should\b/,
    /\bhow do i\b/,
    /\bbest way\b/,
    /\bfeedback on how to\b/,
    /\badvice on how to\b/,
    /\bbrainstorm\b/,
    /\bplanning\b/,
    /^\s*plan\b/,
    /\bstrategy\b/,
  ];

  return matchesAnyPattern(normalized, advisoryPatterns);
}

export function looksLikeMixedReviewImplementationTask(task: string): boolean {
  const normalized = task.toLowerCase();
  const mixedPatterns = [
    /\b(review|analy[sz]e|inspect)\b.*\b(implement|build|create|design|code|edit|refactor|revamp|redesign|restyle|polish|ship|convert)\b/,
    /\b(and|then|also)\s+(implement|build|create|design|code|edit|refactor|revamp|redesign|restyle|polish|ship|convert)\b/,
    /\b(and|then|also)\s+write\b.*\b(code|component|page|ui|screen|view|file|function|test|css|style|styles)\b/,
  ];

  return matchesAnyPattern(normalized, mixedPatterns);
}

export function parseSpawnArgs(rawArgs: string): { agent: string | null; task: string } {
  const args = parseCommandArgs(rawArgs.trim());
  if (args.length === 0) return { agent: null, task: "" };

  let agent: string | null = null;
  let taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--agent") {
      agent = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--task") {
      taskParts = args.slice(index + 1);
      break;
    }
  }

  if (agent || taskParts.length > 0) {
    return { agent, task: taskParts.join(" ").trim() };
  }

  return {
    agent: args[0] ?? null,
    task: args.slice(1).join(" ").trim(),
  };
}

export function isReadOnlyBash(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;

  let quote: "'" | '"' | null = null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (quote === "'") {
      if (char === "'") quote = null;
      continue;
    }

    if (quote === '"') {
      if (char === '"') quote = null;
      if (char === "$" || char === "`" || char === "\\") return false;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/[\n\r|&;<>`$(){}\\]/.test(char)) {
      return false;
    }
  }

  if (quote !== null) return false;

  const args = parseCommandArgs(trimmed);
  if (args.length === 0) return false;

  const [commandName, ...rest] = args;
  const normalizedCommand = commandName.toLowerCase();
  const normalizedArgs = rest.map((arg) => arg.toLowerCase());

  const safeSingleCommands = new Set([
    "cat",
    "head",
    "tail",
    "less",
    "more",
    "grep",
    "rg",
    "ls",
    "pwd",
    "which",
    "type",
    "echo",
    "printf",
    "file",
    "stat",
    "wc",
    "uniq",
    "cut",
    "tree",
    "printenv",
  ]);

  if (safeSingleCommands.has(normalizedCommand)) {
    return true;
  }

  if (normalizedCommand === "git") {
    const subcommand = normalizedArgs[0];
    if (!subcommand) return false;
    if (!["status", "diff", "show", "log", "grep", "rev-parse"].includes(subcommand)) {
      return false;
    }
    return !normalizedArgs.slice(1).some((arg) => arg === "-c" || arg.startsWith("--config") || arg.startsWith("--exec-path") || arg.startsWith("--output"));
  }

  if (normalizedCommand === "npm") {
    return normalizedArgs[0] === "ls";
  }

  if (normalizedCommand === "pnpm") {
    return normalizedArgs[0] === "ls";
  }

  if (normalizedCommand === "yarn") {
    return normalizedArgs[0] === "why";
  }

  return false;
}

export function formatReadOnlyBashError(command: string): string {
  return `Reviewer bash must be read-only. Blocked command: ${summarizeText(command, 100)}`;
}

export function basename(filePath: string): string {
  return path.basename(filePath);
}
