import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Message } from "@mariozechner/pi-ai";
import { parse, stringify } from "yaml";
import { isReadOnlyBash, normalizeAgentName, parseSpawnArgs } from "../core/utils.js";
import {
  formatDispatchTaskPreview,
  formatDispatchWidget,
  createDispatchMessage,
  renderDispatchCall,
  renderDispatchResult,
} from "../UI/renderers.js";
import { getStatusGlyph } from "../UI/status.js";
import { registerAgentExpandCommand, registerAgentExpandShortcut } from "../commands/agent-expand.js";
import {
  loadMergedSubagentConfig,
  updateProjectSubagentConfig,
  updateProjectSubagentEnabled,
} from "../subagents/config.js";
import { buildSubagentRulesBlock, upsertSubagentRules } from "../subagents/agents-md.js";
import { buildDelegatedTask, formatDispatchProgress, getFinalOutput, validateDispatchTask } from "../subagents/spawn.js";
import {
  isDispatchExpansionEnabled,
  parseDispatchExpansionAction,
  setDispatchExpansionEnabled,
} from "../subagents/dispatch-expansion.js";
import { buildAgentStatusSummary, formatPromptState } from "../subagents/status.js";
import { filterSubagentActiveTools } from "../subagents/runtime.js";
import { registerDispatchTool } from "../tools/dispatch.js";
import type { DispatchDetails } from "../types/subagents.js";

function ensureDefaultConfigFixture(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultConfigPath = path.resolve(currentDir, "..", "config.yaml");
  if (fs.existsSync(defaultConfigPath)) return;

  const sourceConfigPath = path.resolve(currentDir, "..", "..", "extensions", "config.yaml");
  if (fs.existsSync(sourceConfigPath)) {
    fs.copyFileSync(sourceConfigPath, defaultConfigPath);
  }
}

const plainTheme = {
  fg(_token: string, text: string) {
    return text;
  },
  bg(_token: string, text: string) {
    return text;
  },
};

const taggedTheme = {
  fg(token: string, text: string) {
    return `<${token}>${text}</${token}>`;
  },
  bg(token: string, text: string) {
    return `{${token}}${text}{/${token}}`;
  },
};

function createDispatchDetails(overrides: Partial<DispatchDetails> = {}): DispatchDetails {
  return {
    agent: "reviewer",
    title: "Reviewer",
    shortName: "RV",
    icon: "➽",
    task: "Review current codebase and provide feedback",
    status: "running",
    spinnerFrame: 0,
    output: "",
    streamlinedProgress: "Starting subagent...",
    warnings: [],
    exitCode: 0,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    transcript: [],
    ...overrides,
  };
}

test("normalizeAgentName accepts aliases", () => {
  assert.equal(normalizeAgentName("AG"), "agent");
  assert.equal(normalizeAgentName("ds"), "designer");
  assert.equal(normalizeAgentName("rv"), "reviewer");
});

test("parseSpawnArgs supports positional and keyword syntax", () => {
  assert.deepEqual(parseSpawnArgs("reviewer find dead code"), {
    agent: "reviewer",
    task: "find dead code",
  });

  assert.deepEqual(parseSpawnArgs("--agent reviewer --task find dead code"), {
    agent: "reviewer",
    task: "find dead code",
  });
});

test("dispatch validation only rejects empty tasks", () => {
  assert.equal(validateDispatchTask("designer", "revamp dashboard icon sizes"), null);
  assert.equal(validateDispatchTask("agent", "review this change and give feedback"), null);
  assert.equal(validateDispatchTask("reviewer", "implement the new dashboard shell"), null);
  assert.equal(validateDispatchTask("reviewer", "Final review of the git-guardrails changes"), null);
  assert.match(validateDispatchTask("reviewer", "   ") ?? "", /cannot be empty/i);
});

test("managed subagent rules emphasize implementation-first routing", () => {
  const rules = buildSubagentRulesBlock();

  assert.match(rules, /Route by task shape first: implementation work goes to `agent` or `designer`/);
  assert.match(rules, /dispatch `agent` or `designer` first, then dispatch `reviewer` as a separate pass/);
});

test("dispatch tool guidance emphasizes implementation-first routing", () => {
  let registeredTool: { promptSnippet?: string; promptGuidelines?: string[] } | undefined;

  registerDispatchTool({
    registerTool(tool: { promptSnippet?: string; promptGuidelines?: string[] }) {
      registeredTool = tool;
    },
  } as unknown as Parameters<typeof registerDispatchTool>[0]);

  const guidance = registeredTool?.promptGuidelines?.join("\n") ?? "";
  assert.match(registeredTool?.promptSnippet ?? "", /implementation or review task/i);
  assert.match(guidance, /Route by task shape: implementation work goes to agent or designer/);
  assert.match(guidance, /dispatch agent or designer first, then dispatch reviewer as a separate pass/);
});

test("delegated task wrapper reinforces role-specific execution mode", () => {
  assert.match(buildDelegatedTask("agent", "fix the config merge logic"), /Default to implementation mode for non-UI coding tasks\./);
  assert.match(buildDelegatedTask("designer", "improve the mobile navigation"), /Default to implementation mode for UI\/UX and front-end tasks\./);
  assert.match(buildDelegatedTask("reviewer", "review the recent config changes"), /Stay in review, validation, and analysis mode\./);
  assert.match(buildDelegatedTask("designer", "improve the mobile navigation"), /Task:\nimprove the mobile navigation/);
});

test("delegated task wrapper preserves the raw task body", () => {
  const task = "\n  keep this indentation\n";
  assert.match(buildDelegatedTask("agent", task), /Task:\n\n  keep this indentation\n/);
});

test("reviewer bash guard allows only simple read-only commands", () => {
  assert.equal(isReadOnlyBash("git diff --stat"), true);
  assert.equal(isReadOnlyBash("sed -i 's/a/b/' file.ts"), false);
  assert.equal(isReadOnlyBash("env bash -c 'echo hi'"), false);
  assert.equal(isReadOnlyBash("sed -n 'w /tmp/pwned' file.ts"), false);
  assert.equal(isReadOnlyBash("git branch -D feature"), false);
  assert.equal(isReadOnlyBash("git remote add origin https://example.com/repo.git"), false);
  assert.equal(isReadOnlyBash("echo $(touch /tmp/pwned)"), false);
  assert.equal(isReadOnlyBash("git diff | sh"), false);
  assert.equal(isReadOnlyBash("awk 'BEGIN { system(\"touch /tmp/pwned\") }'"), false);
});

test("agent rules block inserts without disturbing existing AGENTS content and stays idempotent", () => {
  const original = ["# Project rules", "", "- Keep commits small."].join("\n");
  const inserted = upsertSubagentRules(original);

  assert.equal(inserted.action, "inserted");
  assert.match(inserted.content, /# Project rules/);
  assert.match(inserted.content, /## Ramean subagent hard rules/);
  assert.match(inserted.content, /There are 3 subagents available through the `dispatch` tool/);
  assert.ok(inserted.content.startsWith(original));

  const secondPass = upsertSubagentRules(inserted.content);
  assert.equal(secondPass.action, "unchanged");
  assert.equal(secondPass.content, inserted.content);
});

test("agent rules block supports top insertion and managed refresh", () => {
  const original = "\n# Project rules\n\n- Keep commits small.\n";
  const inserted = upsertSubagentRules(original, "top");

  assert.equal(inserted.action, "inserted");
  assert.match(inserted.content, /^<!-- ramean-subagents:start -->/);
  assert.ok(inserted.content.endsWith(original));

  const stale = inserted.content.replace("## Ramean subagent hard rules", "## Old heading");
  const refreshed = upsertSubagentRules(stale, "top");

  assert.equal(refreshed.action, "updated");
  assert.match(refreshed.content, /## Ramean subagent hard rules/);
  assert.doesNotMatch(refreshed.content, /## Old heading/);

  const duplicated = `${stale}\n\n${stale}`;
  const deduped = upsertSubagentRules(duplicated, "top");
  assert.equal(deduped.action, "updated");
  assert.equal(deduped.content.match(/<!-- ramean-subagents:start -->/g)?.length ?? 0, 1);
});

test("status glyphs include braille spinner frames for running", () => {
  assert.equal(getStatusGlyph("waiting"), "❖");
  assert.equal(getStatusGlyph("running", 0), "⚏");
  assert.equal(getStatusGlyph("running", 1), "⚍");
  assert.equal(getStatusGlyph("running", 2), "⚎");
  assert.equal(getStatusGlyph("running", 3), "⚌");
  assert.equal(getStatusGlyph("running", 4), "⚏");
  assert.equal(getStatusGlyph("success"), "✔");
  assert.equal(getStatusGlyph("failed"), "✖");
});

test("subagent config loads defaults and supports legacy object shape", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-config-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify({
      extension: "subagent",
      enabled: false,
      parallel: { max: 6 },
      agents: {
        agent: {
          provider: "openai",
          model: "gpt-4.1",
          thinking: "medium",
        },
      },
    }),
    "utf-8",
  );

  const config = loadMergedSubagentConfig(cwd);
  assert.equal(config.enabled, false);
  assert.equal("parallel" in config, false);
  assert.equal(config.agents.agent.provider, "openai");
  assert.equal(config.agents.agent.model, "gpt-4.1");
});

test("partial project overrides inherit omitted runtime fields", () => {
  ensureDefaultConfigFixture();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-partial-override-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify([
      {
        extension: "subagent",
        subagents: {
          reviewer: {
            model: "custom-review-model",
            thinking: "medium",
          },
        },
      },
    ]),
    "utf-8",
  );

  const config = loadMergedSubagentConfig(cwd);
  assert.equal(config.agents.reviewer.provider, "github-copilot");
  assert.equal(config.agents.reviewer.model, "custom-review-model");
  assert.equal(config.agents.reviewer.thinking, "medium");
});

test("project config writes docs format without parallel.max", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-write-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });

  const savedEnabled = updateProjectSubagentEnabled(cwd, false);
  const savedText = fs.readFileSync(savedEnabled.path, "utf-8");

  assert.ok(savedText.startsWith("- extension: subagent"));
  assert.doesNotMatch(savedText, /^  parallel:/m);
  assert.equal(savedEnabled.saved.enabled, false);

  const config = loadMergedSubagentConfig(cwd);
  assert.equal(config.enabled, false);
});

test("project config updates preserve legacy object style when present", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-legacy-write-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  const configPath = path.join(cwd, ".pi", "ramean", "config.yaml");

  fs.writeFileSync(
    configPath,
    stringify({
      extension: "subagent",
      enabled: true,
      parallel: { max: 3 },
      agents: {
        agent: { provider: "openai", model: "gpt-4.1", thinking: "low" },
        designer: {},
        reviewer: {},
      },
    }),
    "utf-8",
  );

  updateProjectSubagentConfig(cwd, "reviewer", {
    provider: "github-copilot",
    model: "gpt-5.4-mini",
    thinking: "high",
  });

  const savedText = fs.readFileSync(configPath, "utf-8");
  assert.ok(savedText.startsWith("- extension: subagent"));
  assert.doesNotMatch(savedText, /^  parallel:/m);

  const config = loadMergedSubagentConfig(cwd);
  assert.equal(config.agents.reviewer.model, "gpt-5.4-mini");
});

test("project config updates normalize mixed legacy config and preserve other extension entries", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-mixed-write-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  const configPath = path.join(cwd, ".pi", "ramean", "config.yaml");

  fs.writeFileSync(
    configPath,
    stringify({
      extension: "subagent",
      enabled: true,
      agents: {
        agent: { provider: "openai", model: "gpt-4.1", thinking: "low" },
        designer: {},
        reviewer: {},
      },
      tools: {
        enabled: false,
        grep: false,
      },
      handoff: false,
      notify: { enabled: false },
      minimal_mode: false,
    }),
    "utf-8",
  );

  updateProjectSubagentEnabled(cwd, false);

  const saved = parse(fs.readFileSync(configPath, "utf-8"));
  assert.ok(Array.isArray(saved));
  const entries = saved.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);

  assert.equal(entries.some((entry) => entry.extension === "subagent" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "tools" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "handoff" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "notify" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "minimal-mode" && entry.enabled === false), true);
});

test("final output concatenates all text parts from the last assistant message only", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "Earlier" },
      ],
    } as Message,
    {
      role: "assistant",
      content: [
        { type: "text", text: "Hello" },
        { type: "toolCall", id: "1", name: "read", arguments: { path: "foo" } },
        { type: "text", text: " world" },
      ],
    } as Message,
  ];

  assert.equal(getFinalOutput(messages), "Hello world");
  assert.equal(
    getFinalOutput([
      ...messages,
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "2", name: "grep", arguments: { pattern: "x" } },
        ],
      } as unknown as Message,
    ]),
    "",
  );
});

test("subagent tool restrictions preserve explicit allowlists while removing forbidden tools", () => {
  assert.deepEqual(filterSubagentActiveTools(["read", "grep", "dispatch"], "agent"), ["read", "grep"]);
  assert.deepEqual(filterSubagentActiveTools(["read", "edit", "write", "bash"], "reviewer"), ["read", "bash"]);
  assert.deepEqual(filterSubagentActiveTools([], "reviewer"), []);
});

test("dispatch widget aggregates standalone dispatches", () => {
  const reviewer = createDispatchDetails({ title: "Reviewer", status: "running", spinnerFrame: 0, streamlinedProgress: "read docs/subagents.md" });
  const designer = createDispatchDetails({ agent: "designer", title: "Designer", shortName: "DS", status: "success" });

  assert.equal(formatDispatchWidget(reviewer, plainTheme), "⟩ [⚏Reviewer]");
  assert.equal(formatDispatchWidget([reviewer, designer], plainTheme), "⟩ [⚏Reviewer ✔Designer]");
});

test("dispatch call renderer returns an empty shell to avoid duplicate headers", () => {
  const component = renderDispatchCall({ agent: "reviewer", task: "review repo" }, plainTheme);
  assert.equal(String(component.constructor?.name ?? ""), "Container");
});

test("completed dispatch cards use a left accent instead of a full success background", () => {
  const component = renderDispatchResult(
    {
      details: createDispatchDetails({
        status: "success",
        output: "Final answer",
      }),
    },
    { expanded: false, isPartial: false },
    taggedTheme,
  );

  const [firstLine] = component.render(100);
  assert.match(firstLine ?? "", /^<success>▏<\/success>\{toolPendingBg\}/);
  assert.doesNotMatch(firstLine ?? "", /toolSuccessBg/);
});

test("dispatch task preview truncates to one line", () => {
  assert.equal(
    formatDispatchTaskPreview("Inspect the current subagent implementation\nin this repository and trace how parallel top-level dispatches work now."),
    "Inspect the current subagent implementation in this repository and trace how parallel top-level dispatches work now.",
  );
});

test("running dispatch cards keep the normal tool background without a completion accent", () => {
  const component = renderDispatchResult(
    {
      details: createDispatchDetails({
        status: "running",
        streamlinedProgress: "grep {\"pattern\":\"dispatch\"}",
      }),
    },
    { expanded: false, isPartial: false },
    taggedTheme,
  );

  const [firstLine] = component.render(100);
  assert.match(firstLine ?? "", /^\{toolPendingBg\}/);
  assert.doesNotMatch(firstLine ?? "", /<success>▏<\/success>|<error>▏<\/error>/);
});

test("dispatch-only expansion can expand dispatch cards without changing global tool expansion", () => {
  setDispatchExpansionEnabled(false);
  const component = renderDispatchResult(
    {
      details: createDispatchDetails({
        status: "success",
        output: "Final answer",
      }),
    },
    { expanded: false, isPartial: false },
    plainTheme,
  ) as { render(width: number): string[]; setExpanded?: (expanded: boolean) => void };

  assert.doesNotMatch(component.render(100).join("\n"), /❯ TASK :/);

  setDispatchExpansionEnabled(true);
  assert.match(component.render(100).join("\n"), /❯ TASK :/);

  component.setExpanded?.(false);
  setDispatchExpansionEnabled(false);
  assert.doesNotMatch(component.render(100).join("\n"), /❯ TASK :/);
});

test("dispatch expansion action parser supports toggle expand collapse and status", () => {
  setDispatchExpansionEnabled(false);

  assert.equal(parseDispatchExpansionAction(""), "toggle");
  assert.equal(parseDispatchExpansionAction("expand"), "expand");
  assert.equal(parseDispatchExpansionAction("collapse"), "collapse");
  assert.equal(parseDispatchExpansionAction("status"), "status");
  assert.equal(parseDispatchExpansionAction("off"), "collapse");
  assert.equal(parseDispatchExpansionAction("wat"), null);
  assert.equal(isDispatchExpansionEnabled(), false);
});

test("agent:expand command toggles dispatch-only expansion, refreshes UI, and notifies the user", async () => {
  let registeredHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const notifications: Array<{ message: string; level?: string }> = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const repaints: boolean[] = [];

  registerAgentExpandCommand({
    registerCommand(name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      assert.equal(name, "agent:expand");
      registeredHandler = command.handler;
    },
  } as unknown as Parameters<typeof registerAgentExpandCommand>[0]);

  setDispatchExpansionEnabled(false);
  await registeredHandler?.("", {
    hasUI: true,
    ui: {
      notify(message: string, level?: string) {
        notifications.push({ message, level });
      },
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      getToolsExpanded() {
        return false;
      },
      setToolsExpanded(expanded: boolean) {
        repaints.push(expanded);
      },
    },
  });

  assert.equal(isDispatchExpansionEnabled(), true);
  assert.equal(notifications.length, 1);
  assert.match(notifications[0]?.message ?? "", /Dispatch-only expansion is on/);
  assert.equal(notifications[0]?.level, "info");
  assert.deepEqual(statuses, [{ key: "ramean-dispatch-expand", text: "dispatch expanded" }]);
  assert.deepEqual(repaints, [false]);
});

test("agent:expand status and collapse keep info-level feedback and clear status when disabled", async () => {
  let registeredHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const notifications: Array<{ message: string; level?: string }> = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const repaints: boolean[] = [];

  registerAgentExpandCommand({
    registerCommand(_name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      registeredHandler = command.handler;
    },
  } as unknown as Parameters<typeof registerAgentExpandCommand>[0]);

  setDispatchExpansionEnabled(true);
  await registeredHandler?.("status", {
    hasUI: true,
    ui: {
      notify(message: string, level?: string) {
        notifications.push({ message, level });
      },
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      getToolsExpanded() {
        return true;
      },
      setToolsExpanded(expanded: boolean) {
        repaints.push(expanded);
      },
    },
  });
  await registeredHandler?.("collapse", {
    hasUI: true,
    ui: {
      notify(message: string, level?: string) {
        notifications.push({ message, level });
      },
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      getToolsExpanded() {
        return true;
      },
      setToolsExpanded(expanded: boolean) {
        repaints.push(expanded);
      },
    },
  });

  assert.equal(notifications[0]?.level, "info");
  assert.match(notifications[0]?.message ?? "", /session-local and resets on reload/);
  assert.equal(notifications[1]?.level, "info");
  assert.match(notifications[1]?.message ?? "", /Dispatch-only expansion is off/);
  assert.equal(isDispatchExpansionEnabled(), false);
  assert.deepEqual(statuses, [
    { key: "ramean-dispatch-expand", text: "dispatch expanded" },
    { key: "ramean-dispatch-expand", text: undefined },
  ]);
  assert.deepEqual(repaints, [true, true]);
});

test("dispatch-only expansion shortcut registers Ctrl+Shift+O", async () => {
  let shortcut: string | undefined;
  let handler: ((ctx: any) => Promise<void>) | undefined;
  const notifications: string[] = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const repaints: boolean[] = [];

  registerAgentExpandShortcut({
    registerShortcut(key: string, options: { handler: (ctx: any) => Promise<void> }) {
      shortcut = key;
      handler = options.handler;
    },
  } as unknown as Parameters<typeof registerAgentExpandShortcut>[0]);

  setDispatchExpansionEnabled(false);
  await handler?.({
    hasUI: true,
    ui: {
      notify(message: string) {
        notifications.push(message);
      },
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      getToolsExpanded() {
        return false;
      },
      setToolsExpanded(expanded: boolean) {
        repaints.push(expanded);
      },
    },
  });

  assert.equal(shortcut, "ctrl+shift+o");
  assert.equal(isDispatchExpansionEnabled(), true);
  assert.match(notifications[0] ?? "", /Dispatch-only expansion is on/);
  assert.deepEqual(statuses, [{ key: "ramean-dispatch-expand", text: "dispatch expanded" }]);
  assert.deepEqual(repaints, [false]);
});

test("dispatch progress prefers live streamlined progress", () => {
  const details = createDispatchDetails({
    status: "running",
    streamlinedProgress: "grep {\"pattern\":\"dispatch\"}",
    output: "Partial answer",
  });

  assert.equal(formatDispatchProgress(details), "grep {\"pattern\":\"dispatch\"}");
});

test("dispatch transcript message content prefers the final result over warnings", () => {
  const message = createDispatchMessage(
    createDispatchDetails({
      status: "success",
      output: "Final answer",
      warnings: ["Configured model unavailable."],
    }),
  );

  assert.equal(message.content, "Final answer");
});

test("prompt state summary uses compact labels", () => {
  assert.equal(formatPromptState("default"), "default");
  assert.equal(formatPromptState("project-append"), "append");
  assert.equal(formatPromptState("project-replace"), "replace");
  assert.equal(formatPromptState("fallback-default"), "invalid → default");
});

test("agent status summary includes effective runtime and fallback notes", () => {
  const summary = buildAgentStatusSummary({
    enabled: true,
    agents: [
      {
        agent: "reviewer",
        title: "Reviewer",
        shortName: "RV",
        provider: "github-copilot",
        model: "gpt-5.4-mini",
        thinking: "high",
        promptState: "default",
        fallbackNote: "Configured model github-copilot/gpt-5.4-mini is unavailable. Using the active main-agent model with low thinking.",
      },
    ],
  });

  assert.match(summary, /enabled: true/);
  assert.doesNotMatch(summary, /parallel\.max/);
  assert.match(summary, /runtime: github-copilot\/gpt-5.4-mini\/high/);
  assert.match(summary, /prompt: default/);
  assert.match(summary, /Using the active main-agent model with low thinking\./);
});
