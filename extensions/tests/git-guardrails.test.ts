import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse, stringify } from "yaml";
import { createGitGuardrailsStatusMessage } from "../UI/renderers.js";
import {
  loadMergedGitGuardrailsConfig,
  updateProjectGitGuardrailsEnabled,
} from "../others/git-guardrails-config.js";
import { buildGitGuardrailsStatusSummary } from "../others/git-guardrails-status.js";
import { findDangerousGitPattern } from "../others/git-guardrails.js";

test("git-guardrails defaults to disabled", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-git-guardrails-default-"));
  const config = loadMergedGitGuardrailsConfig(cwd);

  assert.equal(config.extension, "git-guardrails");
  assert.equal(config.enabled, false);
});

test("git-guardrails merges project overrides from docs-style and legacy keys", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-git-guardrails-project-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  const configPath = path.join(cwd, ".pi", "ramean", "config.yaml");

  fs.writeFileSync(configPath, stringify([{ extension: "git-guardrails", enabled: true }]), "utf-8");
  assert.equal(loadMergedGitGuardrailsConfig(cwd).enabled, true);

  fs.writeFileSync(configPath, stringify({ gitGuardrails: { enabled: false } }), "utf-8");
  assert.equal(loadMergedGitGuardrailsConfig(cwd).enabled, false);
});

test("git-guardrails project writes preserve other extension entries", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-git-guardrails-write-"));
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

  const saved = updateProjectGitGuardrailsEnabled(cwd, true);
  assert.equal(saved.saved.enabled, true);

  const parsed = parse(fs.readFileSync(configPath, "utf-8"));
  assert.ok(Array.isArray(parsed));

  const entries = parsed.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
  assert.equal(entries.some((entry) => entry.extension === "git-guardrails" && entry.enabled === true), true);
  assert.equal(entries.some((entry) => entry.extension === "subagent" && entry.enabled === true), true);
  assert.equal(entries.some((entry) => entry.extension === "tools" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "handoff" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "notify" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === "minimal-mode" && entry.enabled === false), true);
});

test("git-guardrails project writes normalize legacy compact tool keys", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-git-guardrails-tools-legacy-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  const configPath = path.join(cwd, ".pi", "ramean", "config.yaml");

  fs.writeFileSync(
    configPath,
    stringify({
      grep: false,
      glob: true,
      handoff: false,
    }),
    "utf-8",
  );

  updateProjectGitGuardrailsEnabled(cwd, true);

  const parsed = parse(fs.readFileSync(configPath, "utf-8"));
  assert.ok(Array.isArray(parsed));

  const entries = parsed.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
  assert.equal(entries.some((entry) => entry.extension === "tools" && (entry.tools as Record<string, unknown>)?.grep === false), true);
  assert.equal(entries.some((entry) => entry.extension === "handoff" && entry.enabled === false), true);
  assert.equal(entries.some((entry) => entry.extension === undefined && "grep" in entry), false);
});

test("git-guardrails project writes preserve docs-style tools entries without nesting them", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-git-guardrails-tools-entry-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  const configPath = path.join(cwd, ".pi", "ramean", "config.yaml");

  fs.writeFileSync(
    configPath,
    stringify([
      {
        extension: "tools",
        enabled: false,
        tools: {
          grep: false,
          glob: true,
        },
      },
    ]),
    "utf-8",
  );

  updateProjectGitGuardrailsEnabled(cwd, true);

  const parsed = parse(fs.readFileSync(configPath, "utf-8"));
  assert.ok(Array.isArray(parsed));

  const toolsEntry = parsed.find(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && entry.extension === "tools",
  );

  assert.deepEqual(toolsEntry, {
    extension: "tools",
    enabled: false,
    tools: {
      grep: false,
      glob: true,
    },
  });
});

test("git-guardrails detects dangerous git commands and ignores safe ones", () => {
  assert.equal(findDangerousGitPattern("git push origin main")?.label, "git push");
  assert.equal(findDangerousGitPattern("git status && git reset --hard HEAD~1")?.label, "git reset --hard");
  assert.equal(findDangerousGitPattern("git clean -fdx")?.label, "git clean -f / -fd / --force");
  assert.equal(findDangerousGitPattern("git clean --force -d")?.label, "git clean -f / -fd / --force");
  assert.equal(findDangerousGitPattern("git branch -D feature")?.label, "git branch -D");
  assert.equal(findDangerousGitPattern("git checkout .")?.label, "git checkout .");
  assert.equal(findDangerousGitPattern("git restore .")?.label, "git restore .");
  assert.equal(findDangerousGitPattern("push --force origin main")?.label, "push --force");
  assert.equal(findDangerousGitPattern("reset --hard HEAD~1")?.label, "reset --hard");
  assert.equal(findDangerousGitPattern("sudo git push origin main")?.label, "git push");
  assert.equal(findDangerousGitPattern("sudo -u deploy git push origin main")?.label, "git push");
  assert.equal(findDangerousGitPattern("git -C repo push origin main")?.label, "git push");
  assert.equal(findDangerousGitPattern("git --git-dir=.git reset --hard HEAD~1")?.label, "git reset --hard");
  assert.equal(findDangerousGitPattern("env GIT_SSH_COMMAND=ssh command git push")?.label, "git push");
  assert.equal(findDangerousGitPattern("bash -lc \"git push origin main\"")?.label, "git push");
  assert.equal(findDangerousGitPattern("git status"), null);
  assert.equal(findDangerousGitPattern("printf 'git push'"), null);
});

test("git-guardrails status summary clearly shows enabled state and reload info", () => {
  const summary = buildGitGuardrailsStatusSummary({
    enabled: true,
    configPath: "/tmp/.pi/ramean/config.yaml",
    reloading: true,
  });

  assert.match(summary, /\/guardrails:git/);
  assert.match(summary, /state: enabled/);
  assert.match(summary, /dangerous git bash commands are blocked/);
  assert.match(summary, /project override path: \/tmp\/\.pi\/ramean\/config\.yaml/);
  assert.match(summary, /reloading now so the new state applies immediately/);
  assert.match(summary, /use \/guardrails:git enable\|disable\|status/);
});

test("git-guardrails status summary clearly shows disabled state", () => {
  const summary = buildGitGuardrailsStatusSummary({
    enabled: false,
    configPath: "/tmp/.pi/ramean/config.yaml",
    reloading: false,
  });

  assert.match(summary, /state: disabled/);
  assert.match(summary, /git bash commands are allowed to run normally/);
  assert.match(summary, /already using the current state/);
});

test("git-guardrails status message uses the persistent custom message payload", () => {
  const details = {
    enabled: true,
    configPath: "/tmp/.pi/ramean/config.yaml",
    reloading: true,
  } as const;

  const message = createGitGuardrailsStatusMessage(details);

  assert.equal(message.customType, "ramean-git-guardrails-status");
  assert.equal(message.display, true);
  assert.equal(message.details, details);
  assert.match(String(message.content), /state: enabled/);
});
