---
name: create-prd
description: Turns conversation context, codebase findings, and existing docs into a PRD that starts with needs-assessing status for the mandatory readiness gate.
---

# Create PRD

Create a PRD from what is already known. This is a synthesis workflow, not an interview workflow: inspect the repo and docs first, ask only blocking or high-impact questions, show one approval summary, then write the durable artifact after the user approves the direction. A written PRD is not build-ready; it must start with visible `Status: needs-assessing` and later pass `assessing` together with its required plans before `build-me` may run.

## Setup contract

Read `docs/agents/work-tracker.md` for work artifact format, PRD paths, work tracking behavior, status lifecycle, testing policy, and review policy. Read `docs/agents/domain-structure.md` when domain docs, design docs, or ADRs may affect the PRD. Read `docs/agents/interaction-policy.md` before asking the user any questions. If a relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original PRD task.

Do not use the old `docs/agents/skill-config.*` file as fallback. That setup shape is unsupported.

Read [PRD-FORMAT.md](PRD-FORMAT.md) before drafting. Use the template that matches the work artifact format configured in `work-tracker.md`, either HTML or Markdown.

## Process

Gather context from the conversation, the requested source document if one was provided, relevant code, domain docs, design docs, ADRs, prior ask-me or ask-me-with-docs decisions when available, and existing work artifacts. If a factual question can be answered by reading those sources, answer it yourself instead of asking the user.

Build a decision ledger before drafting. Track resolved decisions, rejected options, assumptions, out-of-scope items, open gaps, and source coverage for the major points. Treat traceability as two-way: every important source decision that can affect implementation should land in the PRD as a goal, non-goal, story, requirement, decision, risk, assumption, dependency, or open question, and every major PRD claim should have an understandable source. Identify likely modules, interfaces, data contracts, UI surfaces, integrations, and test targets. Prefer deep modules: modules that hide meaningful complexity behind a small, stable, testable interface.

Write the PRD as implementation-grade product context, not as a loose summary. Use concrete, active language and define behavior with observable outcomes. Do not let vague terms such as "proper," "better," "simple," "clean," "nice," or "etc." decide implementation behavior unless the surrounding text defines exactly what they mean. Preserve rejected options and trade-offs when they explain why the chosen shape matters.

Ask the user only when a missing answer would materially change the PRD. Before writing, show a concise approval summary rather than a draft PRD. Summarize the intended artifact path, problem and solution direction, scope boundaries, important decisions and assumptions, proposed modules or interfaces, test targets, blockers, known omissions or deferred decisions, and the fact that the PRD will be written with `Status: needs-assessing`. If the user approves, write `PRD.html` or `PRD.md` according to `work-tracker.md`. Do not dump the full PRD into chat before saving it.

After writing, report the saved path, the `needs-assessing` status, any open questions that remain in the artifact, and the recommended next workflow. If the feature is implementation-bound, the normal next step is `assessing`; assessment may then ask to run `create-plans` if plans are required. Publish, sync, or mirror elsewhere only when `work-tracker.md` and the user explicitly call for it.

## Quality bar

The PRD is complete enough to hand to assessment when another agent can understand what problem to solve, what success means, which user stories and requirements are in scope, what not to build, which decisions are already made, which assumptions are risky, what source each important decision came from, and what still needs human input. It should be possible to create plans from the PRD without rereading the entire interview to recover lost decisions. Do not call the PRD `ready-to-build`; only `assessing` may promote PRDs, and only after the required plans also exist and pass the gate.
