import assert from "node:assert/strict";
import test from "node:test";
import { registerQuestionTools } from "../UI/question-tools.js";

// Minimal pass-through theme — no ANSI codes, so we can assert on plain text.
const theme = {
  fg: (_token: string, text: string) => text,
  bg: (_token: string, text: string) => text,
  bold: (text: string) => text,
};

function captureTools() {
  const tools: any[] = [];
  registerQuestionTools({
    registerTool(def: any) {
      tools.push(def);
    },
  } as any);
  return tools;
}

/**
 * Collapse wrapped lines so that labels that span a line boundary are still
 * matched by a simple `.includes()` check. Each rendered line is right-padded
 * with spaces; stripping them before joining with a single space restores the
 * original flow of text.
 */
function collapseLines(lines: string[]): string {
  return lines.map((l) => l.trimEnd()).join(" ").replace(/\s+/g, " ");
}

test("question renderCall wraps long option summary without truncating with ellipsis", () => {
  const tools = captureTools();
  const tool = tools.find((t) => t.name === "question");
  assert.ok(tool, "question tool must be registered");

  const args = {
    question: "Which approach should we use for the authentication system?",
    options: [
      { label: "JWT tokens with automatic refresh on every request" },
      { label: "Session-based auth stored server-side in Redis" },
      { label: "OAuth 2.0 with PKCE flow and short-lived tokens" },
      { label: "API key rotation with scoped permissions per service" },
      { label: "Mutual TLS certificate authentication for all endpoints" },
    ],
  };

  const component = tool.renderCall(args, theme);
  const lines: string[] = component.render(80);
  const collapsed = collapseLines(lines);

  // Every option label must appear in full — no ellipsis truncation.
  for (const option of args.options) {
    assert.ok(collapsed.includes(option.label), `option label "${option.label}" must be fully visible`);
  }

  // No line should end with the ellipsis that truncateToWidth would produce.
  const raw = lines.join("\n");
  assert.doesNotMatch(raw, /\.\.\.\s*\n|\.\.\.$/m, "rendered output must not contain ellipsis truncation");
});

test("question renderCall shows the question text in full", () => {
  const tools = captureTools();
  const tool = tools.find((t) => t.name === "question");
  assert.ok(tool);

  const longQuestion =
    "Given the constraints of the existing infrastructure and the team's current expertise, which architectural pattern would best support horizontal scaling while keeping operational overhead low?";

  const args = {
    question: longQuestion,
    options: [{ label: "Microservices" }, { label: "Monolith" }],
  };

  const component = tool.renderCall(args, theme);
  const lines: string[] = component.render(80);
  const collapsed = collapseLines(lines);

  // Question text must be present in full across wrapped lines.
  assert.ok(collapsed.includes("constraints of the existing infrastructure"), "question text must wrap and remain visible");
  assert.ok(collapsed.includes("horizontal scaling"), "question text must not be truncated mid-phrase");
});

test("questionnaire renderCall wraps long step labels without truncating with ellipsis", () => {
  const tools = captureTools();
  const tool = tools.find((t) => t.name === "questionnaire");
  assert.ok(tool, "questionnaire tool must be registered");

  const args = {
    questions: [
      { id: "scope", label: "Project Scope and Goals Definition" },
      { id: "priority", label: "Business Priority Ranking" },
      { id: "style", label: "Architectural Style Preference" },
      { id: "timeline", label: "Delivery Timeline Constraint" },
      { id: "team", label: "Team Size and Skills Assessment" },
      { id: "risk", label: "Risk Tolerance and Mitigation Strategy" },
    ],
  };

  const component = tool.renderCall(args, theme);
  const lines: string[] = component.render(80);
  const collapsed = collapseLines(lines);

  for (const question of args.questions) {
    assert.ok(collapsed.includes(question.label!), `step label "${question.label}" must be fully visible`);
  }

  const raw = lines.join("\n");
  assert.doesNotMatch(raw, /\.\.\.\s*\n|\.\.\.$/m, "rendered output must not contain ellipsis truncation");
});
