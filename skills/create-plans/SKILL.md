---
name: create-plans
description: Breaks a conversation, PRD, or spec into implementation plans that start with needs-assessing status for the mandatory readiness gate.
---

# Create Plans

Turn a PRD, spec, or conversation into implementation plan files that different agents can execute consistently after assessment. The core job is decomposition: break the source into independently-grabbable vertical slices, quiz the user on the breakdown, and write the approved plans. Written plans are not build-ready; they must start with visible `Status: needs-assessing` and later pass `assessing` before `build-me` may run.

## Setup contract

Read `docs/agents/work-tracker.md` for work artifact format, plan paths, work tracking behavior, status lifecycle, testing policy, and review policy. Read `docs/agents/domain-structure.md` when domain docs, design docs, or ADRs may affect the plans. Read `docs/agents/interaction-policy.md` before asking the user any questions. If a relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original planning task.

Do not use the old `docs/agents/skill-config.*` file as fallback. That setup shape is unsupported.

Read [PLAN-FORMAT.md](PLAN-FORMAT.md) before drafting plan files. Use the template that matches the work artifact format configured in `work-tracker.md`, either HTML or Markdown.

## Process

Read the source material completely: PRD, spec, current conversation, linked docs, domain docs, design docs, ADRs, prior ask-me or ask-me-with-docs decisions when available, and relevant code. If a source reference is provided, fetch or read it first. If a factual question can be answered from the repo or docs, answer it yourself instead of asking.

Decide whether this is PRD-backed or no-PRD mode. In PRD-backed mode, preserve the PRD's `STORY-*`, `REQ-*`, and `DEC-*` IDs and use the PRD as the durable source ledger. In no-PRD mode, synthesize a lightweight source ledger with generated `STORY-*`, `REQ-*`, `DEC-*`, assumptions, risks, scope, and out-of-scope boundaries; this ledger is approved with the slice breakdown and later written to `plans/INDEX.html` or `plans/INDEX.md` according to `work-tracker.md`.

Before proposing slices, build a coverage map from source requirements and decisions to planned work. Every implementation-relevant story, requirement, acceptance expectation, constraint, discussed edge case, and constraining design or ADR decision should land in at least one slice or be explicitly deferred or excluded. The inverse must also hold: every slice should trace back to real source scope and should not smuggle in unapproved behavior.

Draft vertical slices. Each plan should be a thin tracer bullet that cuts through all relevant layers needed for that behavior, not a horizontal layer task. A completed slice should be demoable or verifiable on its own. Prefer many thin complete slices over a few broad ones. Rare enabling slices are allowed only when they unlock multiple vertical slices and are independently verifiable; they must not become vague setup, backend, frontend, or refactor chores.

Mark each slice as `AFK` or `HITL` and record the reason. `AFK` means an agent can implement it without more human input because the plan has enough decisions, access, verification, and design direction. `HITL` means it needs a human decision, credential, review, design judgment, or other real interaction, and the plan should say what interaction is needed. Prefer `AFK` where possible, but do not hide real human dependencies. Do not add a recommended subagent or executor field to plans; implementation routing belongs to the build workflow.

## Quiz the user

Before writing files, present the proposed breakdown as a numbered list. For each slice, show its title, type (`HITL` or `AFK`), type reason, blocked-by list, and the user stories or requirements covered. In no-PRD mode, include the concise source ledger summary with the generated IDs before the slice list.

Ask targeted breakdown questions only where the answer can change the files. Challenge granularity that looks too coarse or too fine, dependency relationships that look unsafe, slices that should be merged or split, `HITL`/`AFK` labels whose reason is weak, and any source requirement that appears uncovered or overextended. Iterate until the user approves the breakdown. This approval means the files may be written with `Status: needs-assessing`; it does not mean they are ready for build. Do not paste full plan contents into chat before writing; the files are the artifact.

## Write and check

After approval, write plan files in dependency order using the configured paths and format. PRD-backed mode writes numbered plan files that link to the PRD. No-PRD mode writes `plans/INDEX.html` or `plans/INDEX.md` plus the numbered plan files; each plan links back to the index. Every new no-PRD index and every new plan must include visible metadata with `Status: needs-assessing`.

Before finishing, check the written files against `PLAN-FORMAT.md`, the approved breakdown, and the source coverage map. Confirm that the plan set covers the relevant PRD or no-PRD ledger IDs without adding hidden scope, and that each plan has clear behavior, scope boundaries, constraining decisions, affected areas, dependencies, acceptance criteria, executable checks where practical, expected results, manual verification when needed, risks or rollback notes, and enough guidance for an agent to know what to build and when to stop. If the work is non-trivial, follow the review policy from `work-tracker.md` for the planning artifact itself. End by reporting the saved paths, their `needs-assessing` status, and the recommended next workflow, normally `assessing`.
