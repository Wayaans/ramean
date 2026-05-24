---
name: ask-me-with-docs
description: Relentlessly interviews the user about a plan or design while keeping durable context docs current. Use when clarification may change project terminology, design rules, architectural decisions, ADR-worthy trade-offs, or when the user says with docs.
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<setup-contract>

Read `docs/agents/interaction-policy.md` before asking questions and follow its question delivery preference and shared question format. When repo docs, domain terminology, or ADRs affect the discussion, also read `docs/agents/domain-structure.md` so you know where those docs live and how to interpret them. If the relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original interview.

</setup-contract>

<phases>

## Phase 1: Confirm the prompt

Before reading setup docs, exploring files, editing docs, or starting the interview, restate your understanding of the user's prompt and ask for confirmation. If the user corrects it, revise the understanding from the new instruction and ask again. Continue only after the user confirms the understanding. This confirmation question is the only question allowed before the setup contract; all later questions must follow the setup contract.

## Phase 2: Interview and capture docs

After confirmation, run the interview using all current instructions. Resolve dependencies in order, ask one question at a time, inspect the codebase when it can answer, and update durable docs inline when a term, relationship, design rule, or ADR-worthy decision is resolved.

## Phase 3: Close with readiness

When the interview is done, answer only with a concise summary and a confidence score in the form `Confidence: N/5`. The score measures how clearly the conversation resolved the decision tree and durable docs. Passing requires at least `4.5/5`; below that, recommend starting the interview again until the score can reach `4.5/5` or higher.

</phases>

<supporting-guidelines>

## Reference docs

Read the relevant format reference before creating or editing docs. [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md) covers `CONTEXT.html`, `CONTEXT.md`, and context maps. [DESIGN-FORMAT.md](DESIGN-FORMAT.md) covers `DESIGN.html` and `DESIGN.md`. [ADR-FORMAT.md](ADR-FORMAT.md) covers HTML and Markdown ADRs.

## Design-specific docs

When the conversation touches UI/UX, visual style, interaction behavior, accessibility, frontend behavior, component behavior, design-system conventions, or responsive behavior, read [DESIGN-FORMAT.md](DESIGN-FORMAT.md) and the configured design doc before asking design questions. Treat design rules as durable only when the user resolves a project-specific choice, not when they mention a generic preference or one-off implementation detail.

## Before asking

Use `domain-structure.md` to find the configured context layout. If a context map already exists, read it and then read the relevant context files. If the repo uses a single context doc, read it when it exists. Read the configured design doc and relevant ADRs when they exist. If docs are missing, do not create placeholders; create docs only after a real term, relationship, design rule, or ADR-worthy decision is resolved. Inspect code when it can answer the question.

If docs already define a layout, follow it. Do not re-detect and replace an existing layout during the interview unless the user explicitly asks to redesign the documentation structure.

Create files lazily — only when you have something to write. 

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Challenge design language

When the user uses vague design language such as "clean", "modern", "simple", "premium", or "native", turn it into a concrete rule about layout, hierarchy, surfaces, motion, copy, responsive behavior, accessibility, or component behavior. If the existing `DESIGN.md|html` disagrees, surface the conflict immediately.

### Stress-test design states

When a design branch affects UI or frontend behavior, test it against real states: default, loading, empty, error, disabled, mobile, keyboard, screen reader, destructive, success, and rollback states. Ask only about states that can change the durable design rule or downstream implementation.

### Update DESIGN.md inline

When a design branch is resolved, update `DESIGN.md|html` right there with the durable rule, avoided patterns, and boundary conditions. Do not record generic UI advice or task-specific implementation notes.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md|html` and `DESIGN.md|html` right there. Don't batch these up — capture them as they happen.

Don't couple `CONTEXT.md` to implementation details. Only include terms that are meaningful to domain experts.

Don't couple `DESIGN.md` to implementation details. Only include design rules that are meaningful to domain experts.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-guidelines>
