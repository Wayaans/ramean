import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { buildToolsCompactionPrompt } from "../others/tools-compaction.js";
import { loadMergedToolConfig, resolveRuntimeToolConfig } from "../tools/config.js";
import {
  buildToolGuidanceLines,
  formatFindDocsSummary,
  formatFindDocsTarget,
  formatTodos,
  formatWebFetchSummary,
  formatWebFetchTarget,
  mergePrioritizedActiveTools,
  suggestReplacementTool,
} from "../tools/index.js";
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

test("runtime tool config disables mutating and interactive custom tools in subagents", () => {
  const config = loadMergedToolConfig(fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-runtime-")));
  const runtimeConfig = resolveRuntimeToolConfig(config, { isSubagentRuntime: true });

  assert.equal(runtimeConfig.grep, true);
  assert.equal(runtimeConfig.todo_write, false);
  assert.equal(runtimeConfig.question, false);
  assert.equal(runtimeConfig.questionnaire, false);
});

test("priority merge reorders active tools without re-enabling omitted tools", () => {
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
    activeTools: ["read", "bash", "dispatch", "find_docs", "grep"],
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

  assert.deepEqual(merged, ["grep", "find_docs", "read", "bash", "dispatch"]);
  assert.equal(merged.includes("glob"), false);
  assert.equal(merged.includes("todo_write"), false);
});


test("priority merge preserves explicit no-tools selection", () => {
  const merged = mergePrioritizedActiveTools({
    availableTools: ["read", "bash", "grep", "find_docs"],
    activeTools: [],
    toolConfig: {
      grep: true,
      glob: true,
      list: true,
      todo_write: true,
      question: true,
      questionnaire: true,
      web_fetch: true,
      find_docs: true,
    },
  });

  assert.deepEqual(merged, []);
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
      return ["read", "bash", "grep"];
    },
  } as any;

  const details = buildToolsStatusDetails(pi, cwd);
  assert.deepEqual(
    details.activeTools.map((tool) => tool.name),
    ["grep", "read", "bash"],
  );
  assert.equal(details.activeTools[0]?.priority, 1);
  assert.deepEqual(details.inactiveTools.map((tool) => tool.name), ["glob"]);
  assert.equal(details.runtime, "main");
});

test("tool guidance only includes enabled selected dedicated tools", () => {
  assert.deepEqual(
    buildToolGuidanceLines(
      { selectedTools: ["read", "grep", "bash", "find_docs"] },
      {
        grep: true,
        glob: true,
        list: true,
        todo_write: true,
        question: true,
        questionnaire: true,
        web_fetch: false,
        find_docs: true,
      },
    ),
    [
      "- grep for content search across the codebase",
      "- find_docs for current framework and library docs via Context7",
    ],
  );
});


test("web fetch and docs summaries stay compact in the tool UI", () => {
  assert.equal(formatWebFetchTarget({ url: "https://example.com/docs/api/reference?tab=auth" }), "example.com/docs/api/reference?tab=auth");
  assert.match(
    formatWebFetchSummary({
      url: "https://example.com/docs/api/reference?tab=auth",
      status: 200,
      contentType: "text/markdown; charset=utf-8",
    }),
    /example\.com\/docs\/api\/reference\?tab=auth • status 200 • text\/markdown; charset=utf-8/,
  );

  assert.equal(formatFindDocsTarget({ library: "react", query: "useMemo dependencies" }), "react • useMemo dependencies");
  assert.equal(
    formatFindDocsSummary({ libraryId: "/facebook/react", query: "useMemo dependencies" }),
    "/facebook/react • useMemo dependencies",
  );
  assert.equal(
    formatFindDocsSummary({ library: "unknown-lib", query: "hooks", resolved: false }),
    "unknown-lib • no Context7 match",
  );
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

test("config parse failures are surfaced with a warning and fall back to defaults", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-tools-bad-yaml-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(path.join(cwd, ".pi", "ramean", "config.yaml"), "tools: [\n", "utf-8");

  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  try {
    const config = loadMergedToolConfig(cwd);
    assert.equal(config.enabled, true);
    assert.equal(config.tools.grep, true);
  } finally {
    console.error = originalError;
  }

  assert.equal(errors.length > 0, true);
  assert.match(errors[0] ?? "", /failed to parse ramean project config/i);
});
