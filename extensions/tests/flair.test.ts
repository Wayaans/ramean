import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import {
  buildFlairSkillContent,
  discoverFlairSkills,
  FLAIR_MESSAGE_TYPE,
  registerFlairCommands,
  type FlairSkill,
} from "../commands/flair.js";

test("discoverFlairSkills auto-detects ramean package skills from SKILL.md folders", () => {
  const skillsRoot = mkdtempSync(path.join(os.tmpdir(), "ramean-flair-"));

  try {
    mkdirSync(path.join(skillsRoot, "write-a-plan"), { recursive: true });
    writeFileSync(
      path.join(skillsRoot, "write-a-plan", "SKILL.md"),
      [
        "---",
        "name: write-a-plan",
        'description: "Write a plan before implementation."',
        "---",
        "",
        "Plan first.",
      ].join("\n"),
    );

    mkdirSync(path.join(skillsRoot, "nested", "ask-me"), { recursive: true });
    writeFileSync(
      path.join(skillsRoot, "nested", "ask-me", "SKILL.md"),
      [
        "---",
        "name: ask-me",
        "description: >",
        "  Ask clarifying questions before making changes.",
        "---",
        "",
        "Ask first.",
      ].join("\n"),
    );

    const skills = discoverFlairSkills(skillsRoot);

    assert.deepEqual(
      skills.map((skill) => ({ name: skill.name, description: skill.description, body: skill.body })),
      [
        {
          name: "ask-me",
          description: "Ask clarifying questions before making changes.",
          body: "Ask first.",
        },
        {
          name: "write-a-plan",
          description: "Write a plan before implementation.",
          body: "Plan first.",
        },
      ],
    );
  } finally {
    rmSync(skillsRoot, { recursive: true, force: true });
  }
});

test("buildFlairSkillContent appends command args like a skill invocation", () => {
  const content = buildFlairSkillContent("Write commit messages terse and exact.", "fix(api): trim payload");

  assert.match(content, /Write commit messages terse and exact\./);
  assert.match(content, /User: fix\(api\): trim payload/);
});

test("registerFlairCommands registers /flair:<skill-dir> aliases and sends a hidden prompt", async () => {
  const skills: FlairSkill[] = [
    {
      name: "ramean-commit",
      description: "Generate terse Conventional Commit messages.",
      body: "Write commit messages terse and exact.",
      skillFilePath: "/tmp/ramean-commit/SKILL.md",
    },
  ];

  const registered: Array<{
    name: string;
    handler: (args: string, ctx: any) => Promise<void>;
  }> = [];
  const sentMessages: Array<{
    message: { customType: string; content: string; display: boolean };
    options?: { triggerTurn?: boolean; deliverAs?: "followUp" };
  }> = [];

  registerFlairCommands({
    registerCommand(name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      registered.push({ name, handler: command.handler });
    },
    sendMessage(message: { customType: string; content: string; display: boolean }, options?: { triggerTurn?: boolean; deliverAs?: "followUp" }) {
      sentMessages.push({ message, options });
    },
  } as unknown as Parameters<typeof registerFlairCommands>[0], { skills });

  assert.deepEqual(registered.map((command) => command.name), ["flair:ramean-commit"]);

  await registered[0]!.handler("docs: update commands", {
    isIdle: () => true,
  });

  assert.deepEqual(sentMessages, [
    {
      message: {
        customType: FLAIR_MESSAGE_TYPE,
        content: buildFlairSkillContent(skills[0]!.body, "docs: update commands"),
        display: false,
      },
      options: { triggerTurn: true },
    },
  ]);
});

test("registerFlairCommands queues flair skill prompts as a follow-up while streaming", async () => {
  const skills: FlairSkill[] = [
    {
      name: "ramean-commit",
      description: "Generate terse Conventional Commit messages.",
      body: "Write commit messages terse and exact.",
      skillFilePath: "/tmp/ramean-commit/SKILL.md",
    },
  ];

  let registeredHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const sentMessages: Array<{
    message: { customType: string; content: string; display: boolean };
    options?: { triggerTurn?: boolean; deliverAs?: "followUp" };
  }> = [];

  registerFlairCommands({
    registerCommand(_name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      registeredHandler = command.handler;
    },
    sendMessage(message: { customType: string; content: string; display: boolean }, options?: { triggerTurn?: boolean; deliverAs?: "followUp" }) {
      sentMessages.push({ message, options });
    },
  } as unknown as Parameters<typeof registerFlairCommands>[0], { skills });

  assert.ok(registeredHandler);

  await registeredHandler!("refactor(core): deepen helpers", {
    isIdle: () => false,
  });

  assert.deepEqual(sentMessages, [
    {
      message: {
        customType: FLAIR_MESSAGE_TYPE,
        content: buildFlairSkillContent(skills[0]!.body, "refactor(core): deepen helpers"),
        display: false,
      },
      options: { deliverAs: "followUp" },
    },
  ]);
});
