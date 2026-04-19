import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Message } from "@mariozechner/pi-ai";
import { stringify } from "yaml";
import {
  isReadOnlyBash,
  looksLikeDesignerTask,
  normalizeAgentName,
  parseSpawnArgs,
} from "../core/utils.js";
import { formatDispatchWidget, createDispatchMessage } from "../UI/renderers.js";
import { getStatusGlyph } from "../UI/status.js";
import {
  loadMergedSubagentConfig,
  updateProjectSubagentConfig,
  updateProjectSubagentEnabled,
} from "../subagents/config.js";
import { getFinalOutput } from "../subagents/spawn.js";
import { buildAgentStatusSummary, formatPromptState } from "../subagents/status.js";
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

test("designer task heuristic is intentionally UI focused", () => {
  assert.equal(looksLikeDesignerTask("revamp dashboard icon sizes"), true);
  assert.equal(looksLikeDesignerTask("optimize postgres query plan"), false);
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
  assert.match(savedText, /^extension: subagent/m);
  assert.match(savedText, /^agents:/m);
  assert.doesNotMatch(savedText, /^subagents:/m);

  const savedTextAfterUpdate = fs.readFileSync(configPath, "utf-8");
  assert.doesNotMatch(savedTextAfterUpdate, /^parallel:/m);

  const config = loadMergedSubagentConfig(cwd);
  assert.equal(config.agents.reviewer.model, "gpt-5.4-mini");
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

test("dispatch widget aggregates standalone dispatches", () => {
  const reviewer = createDispatchDetails({ title: "Reviewer", status: "running", spinnerFrame: 0 });
  const designer = createDispatchDetails({ agent: "designer", title: "Designer", shortName: "DS", status: "success" });

  assert.equal(formatDispatchWidget(reviewer, plainTheme), "⟩ [⚏Reviewer]");
  assert.equal(formatDispatchWidget([reviewer, designer], plainTheme), "⟩ [⚏Reviewer ✔Designer]");
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
