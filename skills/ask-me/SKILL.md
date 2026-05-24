---
name: ask-me
description: Relentlessly interviews the user about a plan or design until the decision tree is clear, without writing files. Use when the user wants to be questioned, stress-test an idea, clarify scope, resolve trade-offs, or says ask-me/grill me.
---

# Ask Me

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Setup contract

Read `docs/agents/interaction-policy.md` before asking questions and follow its question delivery preference and shared question format. When repo docs, domain terminology, or ADRs affect the discussion, also read `docs/agents/domain-structure.md` so you know where those docs live and how to interpret them. If the relevant setup file is missing or insufficient, invoke and follow `setup-me`, then continue the original interview.

## Phases

### Phase 1: Confirm the prompt

Before reading setup docs, exploring files, or starting the interview, restate your understanding of the user's prompt and ask for confirmation. If the user corrects it, revise the understanding from the new instruction and ask again. Continue only after the user confirms the understanding. This confirmation question is the only question allowed before the setup contract; all later questions must follow the setup contract.

### Phase 2: Interview

After confirmation, run the interview using the setup contract and the instructions above. Resolve dependencies in order, ask only questions that can change the outcome, and keep going until the decision tree is clear enough for the next artifact, plan, or implementation.

### Phase 3: Close with readiness

When the interview is done, answer only with a concise summary and a confidence score in the form `Confidence: N/5`. The score measures how clearly the conversation resolved the decision tree. Passing requires at least `4.5/5`; below that, recommend starting the interview again until the score can reach `4.5/5` or higher.
