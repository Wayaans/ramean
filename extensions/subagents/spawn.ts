import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Message, Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  withFileMutationQueue,
} from "@mariozechner/pi-coding-agent";
import { getSubagent, validAgentHint } from "./agents.js";
import { loadPromptResolution } from "./prompts.js";
import { resolveEffectiveAgentRuntime } from "./runtime-config.js";
import { filterSubagentActiveTools, registerRoleScopedSubagentRuntime } from "./runtime.js";
import {
  basename,
  formatUsage,
  normalizeAgentName,
  shortenPath,
  summarizeText,
} from "../core/utils.js";
import type {
  CanonicalAgentName,
  DispatchDetails,
  DispatchUsage,
  ThinkingLevel,
  TranscriptItem,
} from "../types/subagents.js";
import { RUNNING_STATUS_FRAMES } from "../UI/status.js";

export interface ExecuteDispatchOptions {
  cwd: string;
  requestedAgent: string;
  task: string;
  context: ExtensionContext;
  parentActiveTools?: readonly string[];
  signal?: AbortSignal;
  onUpdate?: (details: DispatchDetails) => void;
}

let sharedAuthStorage: AuthStorage | null = null;
let sharedModelRegistry: ModelRegistry | null = null;

function emptyUsage(): DispatchUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };
}

function getSharedServices(): { authStorage: AuthStorage; modelRegistry: ModelRegistry } {
  if (!sharedAuthStorage) {
    sharedAuthStorage = AuthStorage.create();
  }
  if (!sharedModelRegistry) {
    sharedModelRegistry = ModelRegistry.create(sharedAuthStorage);
  }
  return {
    authStorage: sharedAuthStorage,
    modelRegistry: sharedModelRegistry,
  };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

async function writePromptToTempFile(agent: CanonicalAgentName, prompt: string): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ramean-subagent-"));
  const filePath = path.join(dir, `${agent}.md`);
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  });
  return { dir, filePath };
}

export function getFinalOutput(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;

    return message.content
      .filter((part): part is Extract<Message["content"][number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  return "";
}

function getAssistantText(message: Message | undefined): string {
  if (!message || message.role !== "assistant") return "";
  return message.content
    .filter((part): part is Extract<Message["content"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function collectTranscript(messages: Message[]): TranscriptItem[] {
  const transcript: TranscriptItem[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type === "text") {
        transcript.push({ type: "text", text: part.text });
      }
      if (part.type === "toolCall") {
        transcript.push({ type: "toolCall", name: part.name, args: part.arguments });
      }
    }
  }

  return transcript;
}

function accumulateUsage(usage: DispatchUsage, message: Message): void {
  if (message.role !== "assistant") return;
  usage.turns += 1;
  if (!message.usage) return;
  usage.input += message.usage.input || 0;
  usage.output += message.usage.output || 0;
  usage.cacheRead += message.usage.cacheRead || 0;
  usage.cacheWrite += message.usage.cacheWrite || 0;
  usage.cost += message.usage.cost?.total || 0;
  usage.contextTokens = message.usage.totalTokens || usage.contextTokens;
}

function formatToolCall(name: string, args: Record<string, unknown>): string {
  if (name === "bash") {
    return `$ ${summarizeText(String(args.command ?? ""), 80)}`;
  }

  if (name === "read") {
    const filePath = shortenPath(String(args.path ?? ""));
    return `read ${filePath}`;
  }

  if (name === "write" || name === "edit") {
    const filePath = shortenPath(String(args.path ?? ""));
    return `${name} ${filePath}`;
  }

  if (name === "grep" || name === "find" || name === "ls") {
    return `${name} ${summarizeText(JSON.stringify(args), 80)}`;
  }

  return `${name} ${summarizeText(JSON.stringify(args), 80)}`;
}

function getLatestTranscriptSummary(details: DispatchDetails): string | undefined {
  const item = details.transcript[details.transcript.length - 1];
  if (!item) return undefined;
  if (item.type === "text") {
    const text = summarizeText(item.text, 120).trim();
    return text || undefined;
  }
  return formatToolCall(item.name, item.args);
}

function summarizeToolResult(message: Message | undefined): string | undefined {
  if (!message || message.role !== "toolResult") return undefined;
  const text = message.content
    .filter((part): part is Extract<Message["content"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text ? summarizeText(text, 120) : undefined;
}

export function formatDispatchProgress(details: DispatchDetails): string {
  return summarizeText(
    details.streamlinedProgress
      || getLatestTranscriptSummary(details)
      || details.output
      || `${details.title} is working...`,
    120,
  );
}

function createBaseDetails(agent: CanonicalAgentName, task: string): DispatchDetails {
  const subagent = getSubagent(agent)!;
  return {
    agent,
    title: subagent.title,
    shortName: subagent.shortName,
    icon: subagent.icon,
    task,
    status: "running",
    spinnerFrame: 0,
    output: "",
    streamlinedProgress: "Starting subagent...",
    warnings: [],
    exitCode: 0,
    usage: emptyUsage(),
    transcript: [],
  };
}

function buildDelegatedTaskRules(agent: CanonicalAgentName): string[] {
  const shared = [
    "Routing rule:",
    "- Implementation-shaped non-UI work belongs to Agent.",
    "- Implementation-shaped UI/UX and front-end work belongs to Designer.",
    "- Review-shaped, audit-shaped, critique-shaped, or final-pass validation work belongs to Reviewer.",
    "- If the overall workflow needs both implementation and review, do only your assigned role and stop.",
    "",
  ];

  if (agent === "agent") {
    return [
      ...shared,
      "Agent execution rule:",
      "- Default to implementation mode for non-UI coding tasks.",
      "- Handle debugging, refactors, tests, tooling, data flow, business logic, and codebase analysis.",
      "- If the task is to change non-UI code, provide concrete implementation output rather than only suggestions when the available context is sufficient.",
      "- Do not drift into UI implementation or review-only mode.",
    ];
  }

  if (agent === "designer") {
    return [
      ...shared,
      "Designer execution rule:",
      "- Default to implementation mode for UI/UX and front-end tasks.",
      "- Own layout, components, styling, accessibility, responsive behavior, visual feedback states, and polish.",
      "- If the real goal is to change UI or front-end behavior, provide concrete implementation output rather than only suggestions when the available context is sufficient.",
      "- Do not stay in consultant mode when implementation is reasonably possible.",
    ];
  }

  return [
    ...shared,
    "Reviewer execution rule:",
    "- Stay in review, validation, and analysis mode.",
    "- Focus on correctness, maintainability, security, performance, type safety, accessibility, and obvious regressions.",
    "- Do not implement changes or scout for implementation work.",
  ];
}

export function buildDelegatedTask(agent: CanonicalAgentName, task: string): string {
  return [
    `You are running as the ${getSubagent(agent)?.title ?? agent} subagent inside ramean.`,
    "",
    ...buildDelegatedTaskRules(agent),
    "",
    "Task:",
    task,
    "",
    "Return a concise, actionable result for the main agent and follow the output format from your system instructions.",
  ].join("\n");
}

export function validateDispatchTask(_agent: CanonicalAgentName, task: string): string | null {
  return task.trim() ? null : "Dispatch task cannot be empty.";
}

function resolveRequestedModel(
  context: ExtensionContext,
  agent: CanonicalAgentName,
  warnings: string[],
): { modelArg?: string; thinkingArg?: ThinkingLevel } {
  const resolved = resolveEffectiveAgentRuntime(context, agent);
  if (resolved.fallbackNote) {
    warnings.push(resolved.fallbackNote);
  }

  return {
    modelArg: resolved.modelArg,
    thinkingArg: resolved.thinking,
  };
}

function resolveModelForResidentRuntime(options: {
  context: ExtensionContext;
  agent: CanonicalAgentName;
  warnings: string[];
  modelRegistry: ModelRegistry;
}): { model?: Model<any>; thinkingLevel?: ThinkingLevel } {
  const resolved = resolveRequestedModel(options.context, options.agent, options.warnings);
  if (!resolved.modelArg) {
    return {
      thinkingLevel: resolved.thinkingArg,
    };
  }

  const [provider, ...rest] = resolved.modelArg.split("/");
  const modelId = rest.join("/");
  if (!provider || !modelId) {
    return {
      thinkingLevel: resolved.thinkingArg,
    };
  }

  const model = options.modelRegistry.find(provider, modelId);
  if (!model) {
    options.warnings.push(`Resolved model ${resolved.modelArg} was not found in the resident runtime registry. Using pi defaults.`);
    return {
      thinkingLevel: resolved.thinkingArg,
    };
  }

  return {
    model,
    thinkingLevel: resolved.thinkingArg,
  };
}

export function buildDispatchActiveTools(parentActiveTools: readonly string[] | undefined, role: CanonicalAgentName): string[] {
  const fallbackTools = ["read", "bash", "edit", "write"];
  const activeTools = parentActiveTools && parentActiveTools.length > 0 ? [...parentActiveTools] : fallbackTools;
  const filtered = filterSubagentActiveTools(activeTools, role);
  return [...new Set(filtered)];
}

export function selectDispatchExecutionPath(agent: CanonicalAgentName): "resident" | "legacy-child-launch" {
  return agent === "designer" ? "legacy-child-launch" : "resident";
}

function emitDispatchUpdate(
  details: DispatchDetails,
  messages: Message[],
  partialAssistantMessage: Message | undefined,
  liveToolProgress: string | undefined,
  onUpdate?: (details: DispatchDetails) => void,
): void {
  details.output = getFinalOutput(messages) || getAssistantText(partialAssistantMessage) || details.output;
  details.transcript = collectTranscript(messages);
  details.streamlinedProgress = summarizeText(
    liveToolProgress
      || getAssistantText(partialAssistantMessage)
      || getLatestTranscriptSummary(details)
      || details.output
      || "Starting subagent...",
    120,
  );
  onUpdate?.(details);
}

async function executeResidentDispatch(
  options: ExecuteDispatchOptions,
  agent: CanonicalAgentName,
  details: DispatchDetails,
  prompt: string,
): Promise<DispatchDetails> {
  const { authStorage, modelRegistry } = getSharedServices();
  const agentDir = getAgentDir();
  const resolvedModel = resolveModelForResidentRuntime({
    context: options.context,
    agent,
    warnings: details.warnings,
    modelRegistry,
  });
  const activeTools = buildDispatchActiveTools(options.parentActiveTools, agent);
  const appendPrompt = prompt.trim();

  const loader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir,
    extensionFactories: [
      (pi) => {
        registerRoleScopedSubagentRuntime(pi, agent);
      },
    ],
    appendSystemPromptOverride: (base) => {
      if (!appendPrompt) return base;
      return [...base, appendPrompt];
    },
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd: options.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(options.cwd),
    model: resolvedModel.model,
    thinkingLevel: resolvedModel.thinkingLevel,
  });
  session.setActiveToolsByName(activeTools);

  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  const messages: Message[] = [];
  let partialAssistantMessage: Message | undefined;
  let liveToolProgress: string | undefined;
  let aborted = false;

  const emitUpdate = () => {
    emitDispatchUpdate(details, messages, partialAssistantMessage, liveToolProgress, options.onUpdate);
  };

  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update") {
      const message = event.message as Message;
      if (message.role === "assistant") {
        partialAssistantMessage = message;
        emitUpdate();
      }
      return;
    }

    if (event.type === "tool_execution_start") {
      liveToolProgress = formatToolCall(String(event.toolName ?? "tool"), (event.args as Record<string, unknown> | undefined) ?? {});
      emitUpdate();
      return;
    }

    if (event.type === "tool_execution_update") {
      const toolName = String(event.toolName ?? "tool");
      const args = (event.args as Record<string, unknown> | undefined) ?? {};
      const partialResult = event.partialResult as { content?: Array<{ type?: string; text?: string }> } | undefined;
      const partialText = partialResult?.content
        ?.filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();
      liveToolProgress = partialText
        ? `${formatToolCall(toolName, args)} — ${summarizeText(partialText, 80)}`
        : formatToolCall(toolName, args);
      emitUpdate();
      return;
    }

    if (event.type === "tool_execution_end") {
      emitUpdate();
      return;
    }

    if (event.type === "message_end") {
      const message = event.message as Message;
      messages.push(message);
      if (message.role === "assistant") {
        partialAssistantMessage = undefined;
        accumulateUsage(details.usage, message);
        if (!details.model && message.model) {
          details.model = message.model;
        }
        if (message.stopReason) {
          details.stopReason = message.stopReason;
        }
        liveToolProgress = undefined;
      } else if (message.role === "toolResult") {
        liveToolProgress = summarizeToolResult(message) ?? liveToolProgress;
      }
      emitUpdate();
    }
  });

  const abortSession = () => {
    aborted = true;
    void session.abort();
  };

  try {
    emitUpdate();
    spinnerTimer = setInterval(() => {
      details.spinnerFrame = (details.spinnerFrame + 1) % RUNNING_STATUS_FRAMES.length;
      emitUpdate();
    }, 120);

    if (options.signal?.aborted) {
      abortSession();
    } else {
      options.signal?.addEventListener("abort", abortSession, { once: true });
    }

    await session.prompt(buildDelegatedTask(agent, options.task));
  } catch (error) {
    if (aborted || options.signal?.aborted) {
      details.stopReason = "aborted";
      details.error = "Subagent aborted.";
    } else {
      details.stopReason = "error";
      details.error = error instanceof Error ? error.message : String(error);
    }
  } finally {
    options.signal?.removeEventListener("abort", abortSession);
    unsubscribe();
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
    }
    session.dispose();
  }

  details.exitCode = details.error ? 1 : 0;
  details.output = getFinalOutput(messages) || details.output;
  details.transcript = collectTranscript(messages);
  details.streamlinedProgress = formatDispatchSummary(details);

  if (details.transcript.length === 0 && details.output === "" && details.error === undefined) {
    details.output = "No output returned from subagent.";
  }

  if (details.exitCode !== 0 || details.stopReason === "error" || details.stopReason === "aborted") {
    details.status = "failed";
    details.error = details.error ?? (details.output || `Subagent exited with code ${details.exitCode}.`);
  } else {
    details.status = "success";
  }

  options.onUpdate?.(details);
  return details;
}

async function executeLegacyDispatch(
  options: ExecuteDispatchOptions,
  agent: CanonicalAgentName,
  details: DispatchDetails,
  prompt: string,
): Promise<DispatchDetails> {
  const args: string[] = ["--mode", "json", "-p", "--no-session"];
  const resolvedModel = resolveRequestedModel(options.context, agent, details.warnings);
  if (resolvedModel.modelArg) args.push("--model", resolvedModel.modelArg);
  if (resolvedModel.thinkingArg) args.push("--thinking", resolvedModel.thinkingArg);

  let tempPromptDir: string | null = null;
  let tempPromptPath: string | null = null;
  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  const messages: Message[] = [];
  let partialAssistantMessage: Message | undefined;
  let liveToolProgress: string | undefined;

  const emitUpdate = () => {
    emitDispatchUpdate(details, messages, partialAssistantMessage, liveToolProgress, options.onUpdate);
  };

  try {
    emitUpdate();
    spinnerTimer = setInterval(() => {
      details.spinnerFrame = (details.spinnerFrame + 1) % RUNNING_STATUS_FRAMES.length;
      emitUpdate();
    }, 120);

    if (prompt.trim()) {
      const temp = await writePromptToTempFile(agent, prompt);
      tempPromptDir = temp.dir;
      tempPromptPath = temp.filePath;
      args.push("--append-system-prompt", tempPromptPath);
    }

    args.push(buildDelegatedTask(agent, options.task));

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const child = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        shell: false,
        env: {
          ...process.env,
          RAMEAN_SUBAGENT: "1",
          RAMEAN_SUBAGENT_ROLE: agent,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdoutBuffer = "";
      let stderrBuffer = "";
      let aborted = false;

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line) as Record<string, unknown>;
        } catch {
          return;
        }

        if (event.type === "message_update" && event.message) {
          const message = event.message as Message;
          if (message.role === "assistant") {
            partialAssistantMessage = message;
            emitUpdate();
          }
          return;
        }

        if (event.type === "tool_execution_start") {
          liveToolProgress = formatToolCall(String(event.toolName ?? "tool"), (event.args as Record<string, unknown> | undefined) ?? {});
          emitUpdate();
          return;
        }

        if (event.type === "tool_execution_update") {
          const toolName = String(event.toolName ?? "tool");
          const toolArgs = (event.args as Record<string, unknown> | undefined) ?? {};
          const partialResult = event.partialResult as { content?: Array<{ type?: string; text?: string }> } | undefined;
          const partialText = partialResult?.content
            ?.filter((part) => part?.type === "text" && typeof part.text === "string")
            .map((part) => part.text)
            .join("\n")
            .trim();
          liveToolProgress = partialText
            ? `${formatToolCall(toolName, toolArgs)} — ${summarizeText(partialText, 80)}`
            : formatToolCall(toolName, toolArgs);
          emitUpdate();
          return;
        }

        if (event.type === "tool_execution_end") {
          emitUpdate();
          return;
        }

        if (event.type === "message_end" && event.message) {
          const message = event.message as Message;
          messages.push(message);
          partialAssistantMessage = undefined;
          accumulateUsage(details.usage, message);
          if (!details.model && message.role === "assistant" && message.model) {
            details.model = message.model;
          }
          if (message.role === "assistant" && message.stopReason) {
            details.stopReason = message.stopReason;
          }
          if (message.role === "assistant") {
            liveToolProgress = undefined;
          }
          emitUpdate();
          return;
        }

        if (event.type === "tool_result_end" && event.message) {
          const message = event.message as Message;
          messages.push(message);
          liveToolProgress = summarizeToolResult(message) ?? liveToolProgress;
          emitUpdate();
        }
      };

      child.stdout.on("data", (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      });

      child.stderr.on("data", (data) => {
        stderrBuffer += data.toString();
      });

      child.on("close", (code) => {
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);
        if (stderrBuffer.trim()) {
          details.warnings.push(`stderr: ${summarizeText(stderrBuffer, 160)}`);
        }
        if (aborted) {
          details.stopReason = "aborted";
          details.error = details.error ?? "Subagent aborted.";
        }
        resolve(code ?? 0);
      });

      child.on("error", (error) => {
        details.error = error.message;
        resolve(1);
      });

      const abortChild = () => {
        aborted = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 1000);
      };

      if (options.signal?.aborted) abortChild();
      else options.signal?.addEventListener("abort", abortChild, { once: true });
    });

    details.exitCode = exitCode;
    details.output = getFinalOutput(messages) || details.output;
    details.transcript = collectTranscript(messages);
    details.streamlinedProgress = formatDispatchSummary(details);

    if (details.transcript.length === 0 && details.output === "" && details.error === undefined) {
      details.output = "No output returned from subagent.";
    }

    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }

    if (exitCode !== 0 || details.stopReason === "error" || details.stopReason === "aborted") {
      details.status = "failed";
      details.error = details.error ?? (details.output || `Subagent exited with code ${exitCode}.`);
    } else {
      details.status = "success";
    }

    options.onUpdate?.(details);
    return details;
  } finally {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
    }

    if (tempPromptPath) {
      try {
        fs.unlinkSync(tempPromptPath);
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (tempPromptDir) {
      try {
        fs.rmdirSync(tempPromptDir);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}

export async function executeDispatch(options: ExecuteDispatchOptions): Promise<DispatchDetails> {
  const agent = normalizeAgentName(options.requestedAgent);
  if (!agent) {
    const details = createBaseDetails("agent", options.task);
    details.status = "failed";
    details.error = `Unknown subagent: ${options.requestedAgent}. Valid options: ${validAgentHint()}.`;
    details.output = details.error;
    return details;
  }

  const taskError = validateDispatchTask(agent, options.task);
  const promptResolution = loadPromptResolution(options.cwd, agent);
  const details = createBaseDetails(agent, options.task);
  details.warnings.push(...promptResolution.warnings);

  if (taskError) {
    details.status = "failed";
    details.error = taskError;
    details.output = taskError;
    return details;
  }

  if (selectDispatchExecutionPath(agent) === "resident") {
    return executeResidentDispatch(options, agent, details, promptResolution.prompt);
  }

  return executeLegacyDispatch(options, agent, details, promptResolution.prompt);
}

export function formatDispatchSummary(details: DispatchDetails): string {
  const summary = details.status === "failed" ? details.error ?? details.output : details.output;
  return summarizeText(summary || `${details.title} finished.`, 120);
}

export function formatTranscript(details: DispatchDetails): string[] {
  return details.transcript.map((item) => {
    if (item.type === "text") return summarizeText(item.text, 100);
    return formatToolCall(item.name, item.args);
  });
}

export function buildWarningSummary(details: DispatchDetails): string | undefined {
  return details.warnings.length > 0 ? details.warnings.join("\n") : undefined;
}

export function debugDispatch(details: DispatchDetails): string {
  return `${details.title} ${details.status} ${basename(details.task)} ${formatUsage(details.usage, details.model)}`;
}
