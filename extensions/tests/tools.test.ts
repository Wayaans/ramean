import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { buildToolsCompactionPrompt } from "../others/tools-compaction.js";
import { loadMergedToolConfig, resolveRuntimeToolConfig } from "../tools/config.js";
import { formatTodos, mergePrioritizedActiveTools, suggestReplacementTool } from "../tools/index.js";
import { buildToolsStatusDetails, buildToolsStatusSummary } from "../tools/status.js";

test("tool config loads defaults and merges project overrides", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-config-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify([
      {
        extension: "tools",
        enabled: true,
        tools: {
          questionnaire: false,
          web_fetch: false,
        },
      },
    ]),
    "utf-8",
  );

  const config = loadMergedToolConfig(cwd);
  assert.equal(config.extension, "tools");
  assert.equal(config.enabled, true);
  assert.equal(config.tools.grep, true);
  assert.equal(config.tools.questionnaire, false);
  assert.equal(config.tools.web_fetch, false);
  assert.equal(config.tools.find_docs, true);
});

test("subagent-only project config does not accidentally disable the tools extension", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-subagent-only-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify({
      extension: "subagent",
      enabled: false,
      subagents: {
        agent: {},
        designer: {},
        reviewer: {},
      },
    }),
    "utf-8",
  );

  const config = loadMergedToolConfig(cwd);
  assert.equal(config.enabled, true);
  assert.equal(config.tools.grep, true);
  assert.equal(config.tools.find_docs, true);
});

test("runtime tool config disables interactive question tools in subagents", () => {
  const config = loadMergedToolConfig(fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-runtime-")));
  const runtimeConfig = resolveRuntimeToolConfig(config, { isSubagentRuntime: true });

  assert.equal(runtimeConfig.grep, true);
  assert.equal(runtimeConfig.question, false);
  assert.equal(runtimeConfig.questionnaire, false);
});

test("priority merge keeps custom tools ahead of read edit write bash without reintroducing blocked built-ins", () => {
  const merged = mergePrioritizedActiveTools({
    availableTools: [
      "read",
      "edit",
      "write",
      "bash",
      "dispatch",
      "grep",
      "glob",
      "list",
      "todo_write",
      "question",
      "questionnaire",
      "web_fetch",
      "find_docs",
    ],
    activeTools: ["read", "bash", "dispatch"],
    toolConfig: {
      grep: true,
      glob: true,
      list: true,
      todo_write: true,
      question: false,
      questionnaire: false,
      web_fetch: true,
      find_docs: true,
    },
  });

  assert.deepEqual(merged.slice(0, 8), [
    "grep",
    "glob",
    "list",
    "todo_write",
    "web_fetch",
    "find_docs",
    "read",
    "bash",
  ]);
  assert.equal(merged.includes("edit"), false);
  assert.equal(merged.includes("write"), false);
  assert.equal(merged.includes("dispatch"), true);
});

test("bash replacement suggestions map common shell commands to dedicated tools", () => {
  assert.equal(suggestReplacementTool("rg dispatch extensions"), "grep");
  assert.equal(suggestReplacementTool("find . -name '*.ts'"), "glob");
  assert.equal(suggestReplacementTool("tree extensions"), "list");
  assert.equal(suggestReplacementTool("curl https://example.com"), "web_fetch");
  assert.equal(suggestReplacementTool("ctx7 docs /react useMemo"), "find_docs");
  assert.equal(suggestReplacementTool("git status"), undefined);
});

test("todo formatting returns checklist text without a todo_write prefix", () => {
  assert.equal(formatTodos([]), "No todos");
  assert.equal(
    formatTodos([
      { content: "Inspect docs", status: "pending" },
      { content: "Wire commands", status: "in_progress" },
      { content: "Run tests", status: "completed" },
    ]),
    ["[ ] 1. Inspect docs", "[-] 2. Wire commands", "[x] 3. Run tests"].join("\n"),
  );
});

test("tools status details report active priority order and inactive tools", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-status-"));
  const pi = {
    getAllTools() {
      return [
        {
          name: "read",
          description: "Read files",
          sourceInfo: { source: "builtin" },
        },
        {
          name: "bash",
          description: "Run shell commands",
          sourceInfo: { source: "builtin" },
        },
        {
          name: "grep",
          description: "Search file contents using regular expressions and fast codebase search.",
          sourceInfo: { source: "extension" },
        },
        {
          name: "glob",
          description: "Find files by glob pattern matching.",
          sourceInfo: { source: "extension" },
        },
      ];
    },
    getActiveTools() {
      return ["read", "bash"];
    },
  } as any;

  const details = buildToolsStatusDetails(pi, cwd);
  assert.deepEqual(
    details.activeTools.map((tool) => tool.name),
    ["grep", "glob", "read", "bash"],
  );
  assert.equal(details.activeTools[0]?.priority, 1);
  assert.equal(details.inactiveTools.length, 0);
  assert.equal(details.runtime, "main");
});

test("tools status summary includes ordered active tools and disabled config section", () => {
  const summary = buildToolsStatusSummary({
    enabled: true,
    runtime: "main",
    activeTools: [
      { name: "grep", source: "extension", description: "Search code.", active: true, priority: 1 },
      { name: "read", source: "builtin", description: "Read files.", active: true, priority: 2 },
    ],
    inactiveTools: [{ name: "dispatch", source: "extension", description: "Dispatch one subagent.", active: false }],
    disabledByConfig: ["questionnaire"],
  });

  assert.match(summary, /\/tools:status/);
  assert.match(summary, /- 1\. grep \[extension\]/);
  assert.match(summary, /- 2\. read \[builtin\]/);
  assert.match(summary, /- dispatch \[extension\]/);
  assert.match(summary, /- questionnaire/);
});

test("custom compaction prompt includes previous summary and custom instructions", () => {
  const prompt = buildToolsCompactionPrompt("[User]: hi", "Earlier summary", "Focus on blockers");

  assert.match(prompt, /Focus on blockers/);
  assert.match(prompt, /Earlier summary/);
  assert.match(prompt, /<conversation>\n\n\[User\]: hi\n\n<\/conversation>/);
});
