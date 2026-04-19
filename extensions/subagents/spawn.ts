import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Message } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { getSubagent, validAgentHint } from "./agents.js";
import { loadPromptResolution } from "./prompts.js";
import { resolveEffectiveAgentRuntime } from "./runtime-config.js";
import {
  basename,
  formatUsage,
  looksLikeDesignerTask,
  normalizeAgentName,
  shortenPath,
  summarizeText,
} from "../core/utils.js";
import type { CanonicalAgentName, DispatchDetails, DispatchUsage, TranscriptItem } from "../types/subagents.js";
import { RUNNING_STATUS_FRAMES } from "../UI/status.js";

export interface ExecuteDispatchOptions {
  cwd: string;
  requestedAgent: string;
  task: string;
  context: ExtensionContext;
  signal?: AbortSignal;
  onUpdate?: (details: DispatchDetails) => void;
}

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
    warnings: [],
    exitCode: 0,
    usage: emptyUsage(),
    transcript: [],
  };
}

function validateTask(agent: CanonicalAgentName, task: string): string | null {
  const looksLikeUiTask = looksLikeDesignerTask(task);

  if (agent === "agent" && looksLikeUiTask) {
    return "Agent cannot handle UI/UX or front-end tasks. Use designer instead.";
  }

  if (agent === "designer" && !looksLikeUiTask) {
    return "Designer can only handle UI/UX or front-end tasks.";
  }

  return null;
}

function resolveRequestedModel(
  context: ExtensionContext,
  agent: CanonicalAgentName,
  warnings: string[],
): { modelArg?: string; thinkingArg?: string } {
  const resolved = resolveEffectiveAgentRuntime(context, agent);
  if (resolved.fallbackNote) {
    warnings.push(resolved.fallbackNote);
  }

  return {
    modelArg: resolved.modelArg,
    thinkingArg: resolved.thinking,
  };
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

  const taskError = validateTask(agent, options.task);
  const promptResolution = loadPromptResolution(options.cwd, agent);
  const details = createBaseDetails(agent, options.task);
  details.warnings.push(...promptResolution.warnings);

  if (taskError) {
    details.status = "failed";
    details.error = taskError;
    details.output = taskError;
    return details;
  }

  const args: string[] = ["--mode", "json", "-p", "--no-session"];
  const resolvedModel = resolveRequestedModel(options.context, agent, details.warnings);
  if (resolvedModel.modelArg) args.push("--model", resolvedModel.modelArg);
  if (resolvedModel.thinkingArg) args.push("--thinking", resolvedModel.thinkingArg);

  let tempPromptDir: string | null = null;
  let tempPromptPath: string | null = null;
  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  const messages: Message[] = [];

  const emitUpdate = () => {
    details.output = getFinalOutput(messages) || details.output;
    details.transcript = collectTranscript(messages);
    options.onUpdate?.(details);
  };

  try {
    emitUpdate();
    spinnerTimer = setInterval(() => {
      details.spinnerFrame = (details.spinnerFrame + 1) % RUNNING_STATUS_FRAMES.length;
      emitUpdate();
    }, 120);

    if (promptResolution.prompt.trim()) {
      const temp = await writePromptToTempFile(agent, promptResolution.prompt);
      tempPromptDir = temp.dir;
      tempPromptPath = temp.filePath;
      args.push("--append-system-prompt", tempPromptPath);
    }

    args.push(options.task);

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

        if (event.type === "message_end" && event.message) {
          const message = event.message as Message;
          messages.push(message);
          accumulateUsage(details.usage, message);
          if (!details.model && message.role === "assistant" && message.model) {
            details.model = message.model;
          }
          if (message.role === "assistant" && message.stopReason) {
            details.stopReason = message.stopReason;
          }
          emitUpdate();
        }

        if (event.type === "tool_result_end" && event.message) {
          messages.push(event.message as Message);
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
