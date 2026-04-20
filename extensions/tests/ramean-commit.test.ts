import test from "node:test";
import assert from "node:assert/strict";
import { buildRameanCommitContent, registerRameanCommitCommand } from "../commands/ramean-commit.js";

test("ramean commit content includes the skill instructions and args", () => {
  const content = buildRameanCommitContent("fix(api): trim payload");

  assert.match(content, /Write commit messages terse and exact\./);
  assert.match(content, /Conventional Commits format\./);
  assert.match(content, /User: fix\(api\): trim payload/);
});

test("ramean commit command registers the right alias and sends a hidden prompt", async () => {
  let registeredName: string | undefined;
  let registeredHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const sentMessages: Array<{
    message: { customType: string; content: string; display: boolean };
    options?: { triggerTurn?: boolean; deliverAs?: "followUp" };
  }> = [];

  registerRameanCommitCommand({
    registerCommand(name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      registeredName = name;
      registeredHandler = command.handler;
    },
    sendMessage(message: { customType: string; content: string; display: boolean }, options?: { triggerTurn?: boolean; deliverAs?: "followUp" }) {
      sentMessages.push({ message, options });
    },
  } as unknown as Parameters<typeof registerRameanCommitCommand>[0]);

  assert.equal(registeredName, "ramean:commit");
  assert.ok(registeredHandler);

  await registeredHandler!("docs: update commands", {
    isIdle: () => true,
  });

  assert.deepEqual(sentMessages, [
    {
      message: {
        customType: "ramean-commit",
        content: buildRameanCommitContent("docs: update commands"),
        display: false,
      },
      options: { triggerTurn: true },
    },
  ]);
});

test("ramean commit command queues as a follow-up while streaming", async () => {
  let registeredHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const sentMessages: Array<{
    message: { customType: string; content: string; display: boolean };
    options?: { triggerTurn?: boolean; deliverAs?: "followUp" };
  }> = [];

  registerRameanCommitCommand({
    registerCommand(_name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      registeredHandler = command.handler;
    },
    sendMessage(message: { customType: string; content: string; display: boolean }, options?: { triggerTurn?: boolean; deliverAs?: "followUp" }) {
      sentMessages.push({ message, options });
    },
  } as unknown as Parameters<typeof registerRameanCommitCommand>[0]);

  assert.ok(registeredHandler);

  await registeredHandler!("refactor(core): deepen helpers", {
    isIdle: () => false,
  });

  assert.deepEqual(sentMessages, [
    {
      message: {
        customType: "ramean-commit",
        content: buildRameanCommitContent("refactor(core): deepen helpers"),
        display: false,
      },
      options: { deliverAs: "followUp" },
    },
  ]);
});
