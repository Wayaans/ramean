---
name: assessing
description: Mandatory readiness gate for PRDs, no-PRD indexes, plans, and plan sets before build-me. Use after ask-me, ask-me-with-docs, create-prd, create-plans, specs, or implementation failures to decide status, size, split, and next workflow.
---

# Assessing

Assess whether the available context, PRD, no-PRD index, plan, or plan set is production-ready for the next workflow. This skill is the mandatory gate before `build-me`: a build must not start until the relevant source ledger and requested plans have passed assessment, have visible `Status: ready-to-build`, and the user has confirmed that promotion. The goal is honest triage, not rewriting the artifact.

## Setup contract

Read `docs/agents/work-tracker.md` for artifact paths, status lifecycle, testing policy, review policy, and build-gate behavior. Read `docs/agents/domain-structure.md` when context docs, design docs, or ADRs may affect the assessment. Read `docs/agents/interaction-policy.md` before asking the user any questions. When assessing PRDs or plans, read the relevant format references under the producer skill directories if structure or required sections are in doubt. If a relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original assessment.

Do not use the old `docs/agents/skill-config.*` file as fallback. That setup shape is unsupported.

## Contract

Assess whatever source the user provides or the conversation implies: context docs, design docs, ADRs, PRDs, no-PRD indexes, one plan, a plans directory, specs, previous implementation failure context, important decisions from prior ask-me or ask-me-with-docs conversations, and relevant codebase state. Read the source material before judging it. If an answer is available in the repo or docs, do not ask the user for it.

Assessment edits only visible `Status:` metadata on work artifacts: PRDs, no-PRD indexes, and plans. It does not create separate assessment files by default, does not rewrite PRD or plan content, and does not patch acceptance criteria, scope, wording, or plan decomposition. If a status field is missing from an otherwise valid work artifact, add only the visible metadata status needed for the gate. Context docs, design docs, and ADRs are read-only assessment inputs; if they are stale or incomplete, recommend `ask-me-with-docs` rather than writing status into them.

## Status lifecycle

PRDs and no-PRD indexes use `needs-assessing`, `needs-revision`, `blocked`, and `ready-to-build`. Plans use those same gate statuses plus `in-progress`, `needs-fix`, and `implemented`. New PRDs, indexes, and plans should arrive as `needs-assessing`; if they do not, treat unknown legacy statuses such as `Draft` or `Approved` as not build-ready until assessed.

`assessing` owns the gate statuses. It may mark an artifact `needs-revision` when the contract is inadequate, incomplete, stale, contradictory, or badly decomposed. It may mark an artifact `blocked` when external access, credentials, missing repo state, or a required human decision prevents readiness. It must ask the user before promoting any artifact to `ready-to-build`, because that status means the source ledger and required plans passed assessment and the user confirmed they are production-ready for build.

`needs-fix` is a failed implementation state, not a normal planning state. When a plan is `needs-fix`, inspect the failure context, tests, review notes, and current code. If the plan contract remains valid and the user confirms, the plan may return to `ready-to-build`. If the failure exposes a bad plan or stale requirements, mark `needs-revision`; if it exposes missing access or a human decision, mark `blocked`.

## Readiness gate

A PRD or no-PRD index is not `ready-to-build` by itself. It can become `ready-to-build` only when the required implementation plans also exist, are assessed, and are ready. A single plan is build-ready only when its linked PRD or no-PRD index is `ready-to-build`, the plan itself is `ready-to-build`, dependencies are clear, and no relevant domain, design, or ADR constraint is unresolved. A plan directory is build-ready only when the source ledger is `ready-to-build`, every required plan is assessed, bad decomposition has been fixed, and no relevant plan is `needs-assessing`, `needs-revision`, `blocked`, or `needs-fix`.

If a PRD is assessable but plans are missing, report that assessment cannot finish the build gate yet. Ask the user for approval to invoke `create-plans`; if they approve, run that workflow, let it create the plans, then resume assessment of the PRD and plan set. Do not silently create plans without approval, and do not mark the PRD `ready-to-build` before the plans exist and pass.

## Quality review

Judge the artifact as a contract for another agent. Scope and out-of-scope boundaries must be explicit. Resolved decisions, assumptions, dependencies, interfaces, data or API contracts, acceptance criteria, verification strategy, risks, rollback or fallback notes, and relevant domain/design/ADR constraints must be clear enough that an implementer knows what to build, what not to build, where to look, how to verify, and when to stop.

Bad plan decomposition fails the gate. Mark plans `needs-revision` when they are too broad, overloaded, split horizontally by layer rather than by behavior, missing dependencies, missing acceptance criteria, missing checks, likely to hide shared-risk conflicts, or likely to make `build-me` miss requirements or overbuild. Prefer vertical, independently verifiable slices; rare enabling slices must be concrete and independently checkable.

## Traceability and clarity review

Assessment must verify that the PRD carries forward the important decisions already made in conversation and durable docs. Decisions from ask-me or ask-me-with-docs, context docs, design docs, ADRs, and relevant prior discussion must appear in the PRD when they affect behavior, scope, design, architecture, terminology, constraints, acceptance criteria, or verification. If a decision affects implementation but exists only in conversation or durable context, the PRD is not ready. If a durable doc and the PRD conflict, or if a newer conversation appears to supersede a durable doc, do not guess which source wins; mark the artifact `needs-revision` or `blocked` as appropriate and recommend `ask-me-with-docs` when the durable context needs updating.

Assessment must also judge the PRD's writing as implementation instructions. The PRD should use specific, active, unambiguous language that tells an implementer what to build, what not to build, where the boundaries are, and how completion will be recognized. Vague words such as "proper," "better," "simple," "nice," or "etc." are acceptable only when the surrounding text defines the concrete behavior. Unresolved alternatives, hidden assumptions, unclear ownership, undefined terms, contradictory statements, and missing stop conditions fail the gate because they force `build-me` to invent requirements.

Assessment must compare the plan set against the PRD rather than judging each plan in isolation. Every major PRD requirement, acceptance criterion, constraint, and discussed edge case must be covered by at least one plan, and every plan must trace back to real PRD scope. Plans must not silently add behavior, drop acceptance criteria, weaken design or ADR constraints, or hide implementation-relevant details in broad wording. If the PRD is sound but the plans lose information, mark the affected plans `needs-revision` instead of promoting the set.

Assessment must check that implementation will not require avoidable guessing. Plans should make affected areas, data or API contracts, UI states, error states, permissions or auth behavior, migration or rollback notes, verification commands, expected results, review needs, and manual checks clear when those details matter to the change. It must also inspect build sequencing and shared risk: hidden ordering dependencies, shared migrations, global configuration, generated files, public contracts, shared UI surfaces, or other cross-cutting changes must be made explicit so `build-me` can serialize risky work instead of running unsafe parallel tasks.

## Sizing and split recommendation

Every assessment verdict should include a complexity and risk score from 1 to 10, with reasoning tied to scope, uncertainty, coupling, data changes, UI complexity, integrations, migration risk, test burden, and rollback difficulty. When planning is missing or deficient, include a recommended `create-plans` split count and explain which slices are likely AFK and which are likely HITL. Use the score as a triage tool rather than a time estimate: low scores usually need one thin plan, medium scores usually need several vertical slices, and high scores usually need a revised PRD or a larger plan set before build.

## Output and next action

End with one clear verdict. State the assessed scope, the current or changed statuses, the 1–10 complexity/risk score, the recommended split count when relevant, the key reasons for the verdict, and exactly one next workflow: `ask-me`, `ask-me-with-docs`, `create-prd`, `create-plans`, `build-me`, or `stop`. If the artifact passes readiness, ask the user to confirm before changing status to `ready-to-build`; after confirmation, update only the visible status metadata and recommend `build-me`. If it fails, update status to `needs-revision` or `blocked` when appropriate and explain the shortest path back to readiness.
