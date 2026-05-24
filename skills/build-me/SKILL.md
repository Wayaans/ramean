---
name: build-me
description: Implements assessed ready-to-build plan files or plan directories with role-based orchestration, status updates, checks, and review. Refuses unassessed PRDs, plans, and failed needs-fix work.
---

# Build Me

Implement assessed plan files. This skill is not a requirements or planning shortcut: it never builds directly from a PRD, conversation, broad spec, or unassessed plan. If the requested work is not already gated as build-ready, stop and recommend `assessing`.

## Setup contract

Read `docs/agents/work-tracker.md` for plan paths, artifact format, status lifecycle, build-gate rules, testing policy, review policy, and work tracking behavior. Read `docs/agents/domain-structure.md` for context docs, design docs, ADR locations, and durable constraints relevant to the implementation. Read `docs/agents/interaction-policy.md` before asking the user any questions. If a relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original build task.

## Required input and gate

The user must provide one plan file or a directory of plan files. If no file or directory is provided, ask for it. If the user provides only a PRD, conversation, issue, or broad spec, stop and recommend `assessing` or `create-plans` as appropriate; do not improvise a build contract.

Before implementation, read the requested plan or every plan in the requested directory, the linked PRD or no-PRD index, relevant context docs, design docs, ADRs, and the codebase areas needed to understand the change. The linked PRD or index must have visible `Status: ready-to-build`. A requested plan may be implemented only when it has visible `Status: ready-to-build`. Treat missing status, legacy status, `needs-assessing`, `needs-revision`, `blocked`, and `needs-fix` as hard stops. A plan with `Status: implemented` is already complete and should be skipped rather than rebuilt unless the user explicitly asks for an audit, which is review work rather than build work.

`needs-fix` is not buildable. If a plan is in that state, stop and recommend `assessing`; only assessment can decide whether the plan contract is still valid enough to return to `ready-to-build`.

## Preflight and single confirmation

After the gate is satisfied, perform a preflight before editing files, changing any plan status to `in-progress`, or delegating implementation work. For a directory build, do this once for the whole ready set after reading it; do not ask for a separate confirmation for each plan unless the user explicitly requests that workflow.

The preflight should be prose-first, but use a short checklist when it makes the decision easier to verify. It must make these items clear before asking for confirmation:

- assumptions, scope boundaries, and out-of-scope items;
- risky areas, relevant checks, and likely implementation order;
- any simpler approach or trade-off that could change how the plan should be built;
- goal-driven success criteria, mapping acceptance criteria to verifiable checks;
- relevant loaded skills, documentation consulted, and any important missing skill coverage.

If anything is unclear, contradictory, or decision-worthy, stop and ask the blocking question instead of treating confirmation as permission to guess. For multi-step work, present a short implementation plan in the form `Step -> verify: check`. Prefer targeted tests first for important behavior, then broader checks when the risk justifies them.

During preflight, identify the languages, frameworks, libraries, CLIs, generated tooling, and quality concerns involved. Load and follow matching available skills when they are relevant, such as language or framework skills, clean-code skills, simplify or refactor skills, UI or design skills, and debugging skills. If no relevant skill exists for an important language, framework, or quality concern, say so explicitly so the user knows the gap.

Use current documentation only when it matters. Inspect project versions and consult current docs when an API, framework, CLI, generated-tool behavior, configuration, or best practice is uncertain, version-sensitive, missing from repo patterns, or not covered by a relevant skill. Do not add documentation lookup noise for trivial changes where existing project patterns are sufficient.

Ask exactly one confirmation after the preflight, asking whether to proceed with the stated implementation plan. Do not edit files, update statuses, run implementation delegates, or make code changes until the user confirms.

## One plan file

For a single plan, confirm that the linked source ledger and the plan are both `ready-to-build`. Map each acceptance criterion and required check to the implementation work before editing. Set the plan status to `in-progress` only after the preflight confirmation succeeds and work starts. Implement only the plan's scope, preserve its out-of-scope boundaries and resolved decisions, and avoid opportunistic adjacent refactors unless they are necessary for the acceptance criteria.

When implementation is complete, run the checks named in the plan and any relevant checks from `work-tracker.md` or the codebase. Non-trivial work needs a review pass before completion. If checks and required review pass, update the plan status to `implemented`. If implementation starts but tests, review, or required checks fail and cannot be resolved in the same focused run, update the plan status to `needs-fix` and explain the failure context clearly enough for `assessing` to decide the next gate status.

## Plans directory

For a directory, read every plan file and the linked PRD or no-PRD index before changing anything. The source ledger must be `ready-to-build`. Plans with `implemented` are skipped. Plans with `needs-assessing`, `needs-revision`, `blocked`, or `needs-fix` stop the directory build because the set is not safe to execute. Plans with `ready-to-build` become candidates only when their blocked-by dependencies are already `implemented` or not required.

Build a dependency graph from each plan's blocked-by section and use the plan numbering only as a tie-breaker, not as a substitute for dependencies. Before parallel work, check for shared migrations, global configuration, package manager files, generated files, public types or schemas, shared components, shared routes, auth or permission paths, test fixtures, and other cross-cutting changes. Run independent ready plans in parallel only when their risk areas do not overlap. If there is no safe parallel group, run the next sequential ready plan whose dependencies are satisfied; for example, if plans 01 and 02 are `implemented` and the remaining plans are not safe to parallelize, run plan 03 next.

After each plan finishes, apply the same status rule as a single-plan build: `implemented` only after implementation, required checks, and required review pass; `needs-fix` when started work cannot pass checks or review. Continue through the directory only while the remaining graph has ready, dependency-satisfied, safe work. Stop and report clearly when the next work is blocked by status, dependency order, shared-risk serialization, missing access, or failed checks.

## Role-based orchestration

Separate work by responsibility, not by names baked into the plan. Code implementation covers non-UI logic, tests, tooling, data contracts, APIs, migrations, and refactors. UI/UX implementation covers components, layout, styling, accessibility, interaction behavior, and visual polish. Review covers validation against the plan, source ledger, domain docs, design docs, ADRs, code quality, tests, scope boundaries, and regressions. Map those roles to the available implementation and review tools at runtime, and do not ask any delegate to dispatch other delegates.

Write delegation briefs as implementation contracts. Include the plan path, linked source path, exact status gate, relevant acceptance criteria, constraints, likely files or modules to inspect when known, checks to run, risky areas, relevant loaded skills or documentation constraints, and the expectation to keep the change minimal, clean, goal-driven, and in scope. Do not ask a delegate to make product decisions, expand scope, or silently change plan status ownership.

## Implementation quality bar

Implement the smallest complete change that satisfies the assessed plan. Prefer existing project patterns and clean seams over novelty. Keep structure cohesive, names precise, and modules deep enough to hide meaningful complexity behind stable, testable interfaces. Avoid duplicating logic, adding shallow wrappers, or spreading a single behavior across unrelated files without a reason.

Apply clean code, SOLID principles, and simplification as an in-scope quality gate for code you create or touch. The quality gate is not a broad cleanup pass; it is a check that touched code remains clear, cohesive, minimal, and easy to test.

Use this gate to keep the implementation disciplined:

- Think before coding by stating assumptions, surfacing trade-offs, naming simpler approaches, and stopping when the plan requires an uncaptured product, design, or architecture decision.
- Keep the implementation simple by adding no features beyond the plan, no unrequested flexibility, no single-use abstractions, and no defensive handling for impossible scenarios.
- Make surgical changes by touching only files and lines needed for the acceptance criteria, matching existing style, and cleaning up only unused imports, variables, helpers, tests, or artifacts introduced by the implementation.
- Use current, non-deprecated APIs, consulting current docs when language, framework, library, CLI, or generated-tooling behavior is uncertain or version-sensitive.
- Loop until verified: mapped success criteria must pass their checks, and required review obligations must pass, before the plan can become `implemented`.

If the solution starts to look larger than the problem, simplify before continuing. If unrelated dead code or design debt is noticed, mention it in the final report instead of deleting it. If checks fail, diagnose within scope, fix, and rerun the relevant checks; if the failure cannot be resolved in the same focused run without expanding scope, set the plan to `needs-fix` and report the failure context.

Tests should cover important, risky, or non-trivial behavior. For small documentation or skill-only edits, verification may be structural rather than automated, but the final report must state what was checked and why it is enough. For executable code, prefer targeted tests around the changed behavior first, then broader checks when the risk justifies them.

## Stop conditions

Stop rather than guessing when any of these conditions apply:

- the source ledger or plan is not `ready-to-build`;
- a relevant plan is `needs-fix`;
- dependencies conflict or are not satisfied;
- the plan contradicts domain docs or ADRs;
- required access or credentials are missing;
- implementation would require a product or design decision not captured by the plan;
- checks expose failures that cannot be fixed within the plan's scope.

Report the blocking status, the reason, and the recommended next workflow.
