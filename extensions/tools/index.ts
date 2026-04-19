import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  createGrepTool,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  withFileMutationQueue,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { registerQuestionTools } from "../UI/question-tools.js";
import { isMinimalToolDisplayEnabled } from "../others/minimal-mode.js";
import { CUSTOM_TOOL_NAMES, type CustomToolConfigState, type CustomToolName } from "../types/tools.js";
import { isCustomToolName, loadMergedToolConfig, resolveRuntimeToolConfig } from "./config.js";

const CUSTOM_TOOL_PRIORITY = [
  "grep",
  "glob",
  "list",
  "todo_write",
  "question",
  "questionnaire",
  "web_fetch",
  "find_docs",
] as const;

const FALLBACK_PRIORITY_TOOLS = ["read", "edit", "write", "bash"] as const;

const TOOL_GUIDANCE: Array<{ name: CustomToolName; text: string }> = [
  { name: "grep", text: "grep for content search across the codebase" },
  { name: "glob", text: "glob for file pattern discovery" },
  { name: "list", text: "list for directory browsing" },
  { name: "todo_write", text: "todo_write for short task tracking during multi-step work" },
  { name: "question", text: "question for one polished interactive clarification from the user" },
  { name: "questionnaire", text: "questionnaire for multi-step structured clarification with review" },
  { name: "web_fetch", text: "web_fetch for reading web pages through markdown.new" },
  { name: "find_docs", text: "find_docs for current framework and library docs via Context7" },
];

const SEARCH_IGNORE_DIRS = new Set([".git", "node_modules"]);
const DEFAULT_GLOB_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 200;
const DEFAULT_WEB_TIMEOUT_SECONDS = 30;
const DEFAULT_CTX7_TIMEOUT_MS = 60_000;

const TodoStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in_progress"),
  Type.Literal("completed"),
]);

const TodoItemSchema = Type.Object({
  content: Type.String({ description: "Task description" }),
  status: TodoStatusSchema,
});

type TodoStatus = "pending" | "in_progress" | "completed";
type StoredTodo = { content: string; status: TodoStatus };
type TodoWriteDetails = { todos: StoredTodo[]; action: "read" | "write" | "clear"; error?: string };

type GlobToolParams = { pattern: string; path?: string; limit?: number };
type ListToolParams = { path?: string; glob?: string; limit?: number };
type TodoWriteToolParams = { action: "read" | "write" | "clear"; todos?: StoredTodo[] };
type WebFetchToolParams = { url: string; timeoutSeconds?: number };
type FindDocsToolParams = { query: string; library?: string; libraryId?: string };

const GlobParams = Type.Object({
  pattern: Type.String({ description: "Glob pattern, e.g. **/*.ts or src/**/*.tsx" }),
  path: Type.Optional(Type.String({ description: "Directory to search in (default: current directory)" })),
  limit: Type.Optional(Type.Number({ description: `Maximum number of results (default: ${DEFAULT_GLOB_LIMIT})` })),
}) as any;

const ListParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory to list (default: current directory)" })),
  glob: Type.Optional(Type.String({ description: "Optional glob filter for directory entries, e.g. *.ts or *.md" })),
  limit: Type.Optional(Type.Number({ description: `Maximum number of results (default: ${DEFAULT_LIST_LIMIT})` })),
}) as any;

const TodoWriteParams = Type.Object({
  action: Type.Union([Type.Literal("read"), Type.Literal("write"), Type.Literal("clear")]),
  todos: Type.Optional(Type.Array(TodoItemSchema, { description: "Full todo list to persist when action=write" })),
}) as any;

const WebFetchParams = Type.Object({
  url: Type.String({
    description:
      "A URL to fetch. Raw URLs are fetched through https://markdown.new/<url>. You can also pass a full markdown.new URL directly.",
  }),
  timeoutSeconds: Type.Optional(Type.Number({ description: `Timeout in seconds (default: ${DEFAULT_WEB_TIMEOUT_SECONDS})` })),
}) as any;

const FindDocsParams = Type.Object({
  query: Type.String({ description: "Documentation question or search query" }),
  library: Type.Optional(Type.String({ description: "Library/framework/package name, e.g. react, nextjs, prisma" })),
  libraryId: Type.Optional(Type.String({ description: "Optional Context7 library ID like /facebook/react" })),
}) as any;

export function registerCustomToolsExtension(pi: ExtensionAPI): void {
  let todos: StoredTodo[] = [];
  const getRuntimeToolConfig = (cwd: string): CustomToolConfigState => {
    const config = loadMergedToolConfig(cwd);
    return resolveRuntimeToolConfig(config, { isSubagentRuntime: isSubagentRuntime() });
  };

  const rebuildTodos = (ctx: ExtensionContext): void => {
    todos = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const message = entry.message;
      if (message.role !== "toolResult" || message.toolName !== "todo_write") continue;
      const details = message.details as TodoWriteDetails | undefined;
      if (details?.todos) {
        todos = [...details.todos];
      }
    }
  };

  const applyToolPriorityForContext = (ctx: ExtensionContext): void => {
    const toolConfig = getRuntimeToolConfig(ctx.cwd);
    const merged = mergePrioritizedActiveTools({
      availableTools: pi.getAllTools().map((tool) => tool.name),
      activeTools: pi.getActiveTools(),
      toolConfig,
    });

    if (merged.length > 0) {
      pi.setActiveTools(merged);
    }
  };

  const grepTool = createGrepTool(process.cwd());
  pi.registerTool({
    name: "grep",
    label: "grep",
    description:
      "Search file contents using regular expressions and fast codebase search. Supports full regex syntax and optional file glob filtering.",
    parameters: grepTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createGrepTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    },
    renderResult(result, options) {
      if (isMinimalCollapsed(options.expanded)) {
        return new Text(formatMinimalCount(result, "matches"), 0, 0);
      }
      return renderTextResult(result);
    },
  });

  pi.registerTool({
    name: "glob",
    label: "glob",
    description:
      "Find files by glob pattern matching. Search for files using patterns like **/*.js or src/**/*.ts. Returns matching file paths sorted by modification time.",
    parameters: GlobParams,
    async execute(_toolCallId, params: any, signal, _onUpdate, ctx) {
      const input = params as GlobToolParams;
      const searchRoot = resolvePath(input.path ?? ".", ctx.cwd);
      const limit = clampLimit(input.limit, DEFAULT_GLOB_LIMIT);
      const matches = await findFilesByGlob(searchRoot, input.pattern, limit, signal);

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: "No files found matching pattern" }],
          details: { pattern: input.pattern, path: searchRoot, count: 0 },
        };
      }

      const body = matches.map((entry) => entry.relativePath).join("\n");
      return makeTextToolResult(body, {
        pattern: input.pattern,
        path: searchRoot,
        count: matches.length,
        sortedBy: "mtime_desc",
      });
    },
    renderResult(result, options) {
      if (isMinimalCollapsed(options.expanded)) {
        return new Text(formatMinimalCount(result, "files"), 0, 0);
      }
      return renderTextResult(result);
    },
  });

  pi.registerTool({
    name: "list",
    label: "list",
    description:
      "List files and directories in a given path. Accepts an optional glob pattern to filter directory entries.",
    parameters: ListParams,
    async execute(_toolCallId, params: any, _signal, _onUpdate, ctx) {
      const input = params as ListToolParams;
      const directoryPath = resolvePath(input.path ?? ".", ctx.cwd);
      const limit = clampLimit(input.limit, DEFAULT_LIST_LIMIT);
      const output = await listDirectory(directoryPath, input.glob, limit);
      return makeTextToolResult(output.text, {
        path: directoryPath,
        glob: input.glob,
        count: output.count,
      });
    },
    renderResult(result, options) {
      if (isMinimalCollapsed(options.expanded)) {
        return new Text(formatMinimalCount(result, "entries"), 0, 0);
      }
      return renderTextResult(result);
    },
  });

  pi.registerTool({
    name: "todo_write",
    label: "todo_write",
    description:
      "Manage todo lists during coding sessions. Create, replace, read, and clear task lists to track progress during complex operations.",
    parameters: TodoWriteParams,
    async execute(_toolCallId, params: any) {
      const input = params as TodoWriteToolParams;
      if (input.action === "read") {
        return {
          content: [{ type: "text", text: formatTodos(todos) }],
          details: { todos: [...todos], action: "read" } as TodoWriteDetails,
        };
      }

      if (input.action === "clear") {
        todos = [];
        return {
          content: [{ type: "text", text: formatTodos(todos) }],
          details: { todos: [], action: "clear" } as TodoWriteDetails,
        };
      }

      if (!input.todos) {
        return {
          content: [{ type: "text", text: "Error: todos are required when action=write" }],
          details: { todos: [...todos], action: "write", error: "todos required" } as TodoWriteDetails,
        };
      }

      todos = input.todos
        .map((todo) => ({ content: todo.content.trim(), status: todo.status }))
        .filter((todo) => todo.content.length > 0);

      return {
        content: [{ type: "text", text: formatTodos(todos) }],
        details: { todos: [...todos], action: "write" } as TodoWriteDetails,
      };
    },
    renderCall() {
      return new Text("", 0, 0);
    },
    renderResult(result) {
      const details = result.details as TodoWriteDetails | undefined;
      if (details?.error) {
        return new Text(`Error: ${details.error}`, 0, 0);
      }
      return renderTextResult(result);
    },
  });

  registerQuestionTools(pi);

  pi.registerTool({
    name: "web_fetch",
    label: "web_fetch",
    description:
      "Fetch and read web pages through markdown.new. Useful for documentation and online research, including markdown.new/<url> and markdown.new/<url>?format=json patterns.",
    parameters: WebFetchParams,
    async execute(_toolCallId, params: any, signal) {
      const input = params as WebFetchToolParams;
      const targetUrl = buildMarkdownProxyUrl(input.url);
      const timeoutMs = Math.max(1, Math.floor((input.timeoutSeconds ?? DEFAULT_WEB_TIMEOUT_SECONDS) * 1000));
      const response = await fetchWithTimeout(targetUrl, timeoutMs, signal);
      const text = await response.text();
      return makeTextToolResult(text || "", {
        url: input.url,
        fetchedUrl: response.url,
        status: response.status,
        contentType: response.headers.get("content-type") ?? undefined,
      });
    },
    renderResult(result, options) {
      if (isMinimalCollapsed(options.expanded)) {
        return new Text("", 0, 0);
      }
      return renderTextResult(result);
    },
  });

  pi.registerTool({
    name: "find_docs",
    label: "find_docs",
    description:
      "Find current documentation for a framework or library using Context7 (ctx7). Resolves the library ID first, then fetches relevant docs.",
    parameters: FindDocsParams,
    async execute(_toolCallId, params: any, signal) {
      const input = params as FindDocsToolParams;
      const libraryId = input.libraryId?.trim();
      let resolvedLibraryId = libraryId && libraryId.startsWith("/") ? libraryId : undefined;
      let libraryOutput = "";

      if (!resolvedLibraryId) {
        if (!input.library) {
          throw new Error("find_docs requires either library or libraryId");
        }
        libraryOutput = await runCtx7(pi, ["library", input.library, input.query], signal);
        resolvedLibraryId = extractContext7LibraryId(libraryOutput);
        if (!resolvedLibraryId) {
          return makeTextToolResult(libraryOutput || "No matching Context7 library found", {
            library: input.library,
            query: input.query,
            resolved: false,
          });
        }
      }

      const docsOutput = await runCtx7(pi, ["docs", resolvedLibraryId, input.query], signal);
      const text = libraryOutput
        ? `Resolved library: ${resolvedLibraryId}\n\n${docsOutput}`
        : `Library: ${resolvedLibraryId}\n\n${docsOutput}`;

      return makeTextToolResult(text, {
        library: input.library,
        libraryId: resolvedLibraryId,
        query: input.query,
      });
    },
    renderResult(result, options) {
      if (isMinimalCollapsed(options.expanded)) {
        return new Text("", 0, 0);
      }
      return renderTextResult(result);
    },
  });

  const restoreAndApply = (ctx: ExtensionContext): void => {
    rebuildTodos(ctx);
    applyToolPriorityForContext(ctx);
  };

  pi.on("session_start", async (_event, ctx) => restoreAndApply(ctx));

  pi.on("before_agent_start", async (_event, ctx) => {
    restoreAndApply(ctx);
    const toolConfig = getRuntimeToolConfig(ctx.cwd);

    const guidance = TOOL_GUIDANCE.filter((entry) => toolConfig[entry.name]).map((entry) => `- ${entry.text}`);
    if (guidance.length === 0) {
      return;
    }

    return {
      message: {
        customType: "ramean-tools-guidance",
        content: [
          "Prefer enabled dedicated top-level tools before using bash:",
          ...guidance,
          "Use bash only when an enabled dedicated tool cannot accomplish the task.",
        ].join("\n"),
        display: false,
      },
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (isSubagentRuntime() && (event.toolName === "question" || event.toolName === "questionnaire")) {
      return {
        block: true,
        reason: `${event.toolName} is only available to the main agent. Subagents cannot use interactive question tools.`,
      };
    }

    if (event.toolName !== "bash") return;
    const toolConfig = getRuntimeToolConfig(ctx.cwd);
    const command = String(event.input.command ?? "").trim();
    const replacementTool = suggestReplacementTool(command);
    if (!replacementTool || !toolConfig[replacementTool]) return;
    const availableTools = new Set(pi.getAllTools().map((tool) => tool.name));
    if (!availableTools.has(replacementTool)) return;
    return {
      block: true,
      reason: `Use the ${replacementTool} tool instead of bash for this task. Bash is the fallback when enabled dedicated tools are not sufficient.`,
    };
  });
}

export function mergePrioritizedActiveTools(options: {
  availableTools: readonly string[];
  activeTools: readonly string[];
  toolConfig: CustomToolConfigState;
}): string[] {
  const available = new Set(options.availableTools);
  const active = options.activeTools.filter((name) => available.has(name));

  const prioritizedCustomTools = CUSTOM_TOOL_PRIORITY.filter((name) => available.has(name) && options.toolConfig[name]);
  const prioritizedBuiltins = FALLBACK_PRIORITY_TOOLS.filter((name) => active.includes(name));
  const prioritized = [...prioritizedCustomTools, ...prioritizedBuiltins];
  const prioritizedSet = new Set<string>(prioritized);

  const remainingActive = active.filter((name) => {
    if (prioritizedSet.has(name)) return false;
    if (isCustomToolName(name) && !options.toolConfig[name]) return false;
    return true;
  });

  return [...prioritized, ...remainingActive];
}

function resolvePath(inputPath: string, cwd: string): string {
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.resolve(cwd, inputPath);
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), 5000));
}

async function makeTextToolResult(text: string, details: Record<string, unknown>) {
  const truncation = truncateHead(text, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  const resultDetails: Record<string, unknown> = { ...details };
  let resultText = truncation.content;

  if (truncation.truncated) {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ramean-tool-"));
    const tempFile = path.join(tempDir, "output.txt");
    await withFileMutationQueue(tempFile, async () => {
      await writeFile(tempFile, text, "utf8");
    });
    resultDetails.truncation = truncation;
    resultDetails.fullOutputPath = tempFile;
    resultText += `\n\n[Output truncated to ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full output saved to: ${tempFile}]`;
  }

  return {
    content: [{ type: "text" as const, text: resultText || "No output" }],
    details: resultDetails,
  };
}

async function findFilesByGlob(searchRoot: string, pattern: string, limit: number, signal?: AbortSignal) {
  const rootStats = await stat(searchRoot);
  if (!rootStats.isDirectory()) {
    throw new Error(`Path is not a directory: ${searchRoot}`);
  }

  const matcher = globToRegExp(toPosixPath(pattern));
  const results: Array<{ absolutePath: string; relativePath: string; mtimeMs: number }> = [];

  const visit = async (absoluteDir: string, relativeDir: string): Promise<void> => {
    if (signal?.aborted) throw new Error("Operation aborted");
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SEARCH_IGNORE_DIRS.has(entry.name)) continue;
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const posixPath = toPosixPath(relativePath);

      if (entry.isDirectory()) {
        await visit(absolutePath, posixPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!matcher.test(posixPath)) continue;

      const fileStats = await stat(absolutePath);
      results.push({ absolutePath, relativePath: posixPath, mtimeMs: fileStats.mtimeMs });
    }
  };

  await visit(searchRoot, "");
  results.sort((left, right) => right.mtimeMs - left.mtimeMs || left.relativePath.localeCompare(right.relativePath));
  return results.slice(0, limit);
}

async function listDirectory(directoryPath: string, glob: string | undefined, limit: number) {
  const directoryStats = await stat(directoryPath);
  if (!directoryStats.isDirectory()) {
    throw new Error(`Path is not a directory: ${directoryPath}`);
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const matcher = glob ? globToRegExp(toPosixPath(glob)) : undefined;

  const filtered = entries
    .filter((entry) => !SEARCH_IGNORE_DIRS.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      display: entry.isDirectory() ? `${entry.name}/` : entry.name,
      isDirectory: entry.isDirectory(),
    }))
    .filter((entry) => !matcher || matcher.test(entry.name) || matcher.test(entry.display))
    .sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const sliced = filtered.slice(0, limit);
  return {
    text: sliced.length > 0 ? sliced.map((entry) => entry.display).join("\n") : "No entries found",
    count: sliced.length,
  };
}

export function formatTodos(todos: StoredTodo[]): string {
  if (todos.length === 0) return "No todos";
  return todos
    .map((todo, index) => {
      const marker = todo.status === "completed" ? "[x]" : todo.status === "in_progress" ? "[-]" : "[ ]";
      return `${marker} ${index + 1}. ${todo.content}`;
    })
    .join("\n");
}

function isMinimalCollapsed(expanded: boolean): boolean {
  return isMinimalToolDisplayEnabled() && !expanded;
}

function renderTextResult(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((content) => content.type === "text");
  return new Text(text?.type === "text" ? (text.text ?? "") : "", 0, 0);
}

function formatMinimalCount(result: { content: Array<{ type: string; text?: string }> }, noun: string): string {
  const text = result.content.find((content) => content.type === "text");
  const value = text?.type === "text" ? (text.text ?? "") : "";
  const count = value.trim() ? value.split("\n").filter(Boolean).length : 0;
  return count > 0 ? `→ ${count} ${noun}` : "";
}

function buildMarkdownProxyUrl(input: string): string {
  const trimmed = input.trim();
  const normalizedMarkdownNew = trimmed.replace(/^(https?:\/\/markdown\.new\/)[\\\s]*/i, "$1");
  if (normalizedMarkdownNew.startsWith("https://markdown.new/") || normalizedMarkdownNew.startsWith("http://markdown.new/")) {
    return normalizedMarkdownNew;
  }
  const normalizedRawUrl = trimmed.replace(/^[\\\s]+/, "");
  if (!/^https?:\/\//.test(normalizedRawUrl)) {
    throw new Error(`Invalid URL: ${input}`);
  }
  return `https://markdown.new/${normalizedRawUrl}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number, upstreamSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  upstreamSignal?.addEventListener("abort", abortHandler, { once: true });
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortHandler);
  }
}

async function runCtx7(pi: ExtensionAPI, args: string[], signal?: AbortSignal): Promise<string> {
  try {
    const direct = await pi.exec("ctx7", args, { signal, timeout: DEFAULT_CTX7_TIMEOUT_MS });
    if (direct.code === 0 && direct.stdout.trim()) {
      return direct.stdout.trim();
    }
  } catch {
    // Fall through to npx ctx7@latest
  }
  const fallback = await pi.exec("npx", ["-y", "ctx7@latest", ...args], {
    signal,
    timeout: DEFAULT_CTX7_TIMEOUT_MS * 2,
  });
  const output = [fallback.stdout, fallback.stderr].filter(Boolean).join("\n").trim();
  if (fallback.code !== 0) {
    if (/quota|monthly quota reached|quota exceeded/i.test(output)) {
      throw new Error(`Context7 quota exhausted. Run ctx7 login for higher limits.\n\n${output}`);
    }
    throw new Error(output || "ctx7 command failed");
  }
  return output;
}

function extractContext7LibraryId(output: string): string | undefined {
  const match = output.match(/\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?/);
  return match?.[0];
}

export function suggestReplacementTool(command: string): CustomToolName | undefined {
  const normalized = command.trim();
  if (/^(rg|ripgrep|grep)\b/.test(normalized)) return "grep";
  if (/^(fd|find)\b/.test(normalized)) return "glob";
  if (/^(ls|dir|exa|eza|tree)\b/.test(normalized)) return "list";
  if (/^(curl|wget)\b/.test(normalized)) return "web_fetch";
  if (/^(ctx7|bunx\s+ctx7|bunx\s+ctx7@latest|npx\s+ctx7|npx\s+ctx7@latest)\b/.test(normalized)) return "find_docs";
  return undefined;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    const next = pattern[index + 1];
    if (char === "*") {
      if (next === "*") {
        const afterNext = pattern[index + 2];
        if (afterNext === "/") {
          source += "(?:.*\\/)?";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    if (char === "/") {
      source += "\\/";
      continue;
    }
    source += escapeRegExp(char);
  }
  source += "$";
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function isSubagentRuntime(): boolean {
  return process.env.RAMEAN_SUBAGENT === "1";
}
