import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgentName, parseSpawnArgs, looksLikeDesignerTask, isReadOnlyBash } from "../core/utils.js";

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

test("reviewer bash guard only allows read-only commands", () => {
  assert.equal(isReadOnlyBash("git diff --stat"), true);
  assert.equal(isReadOnlyBash("sed -i 's/a/b/' file.ts"), false);
});
