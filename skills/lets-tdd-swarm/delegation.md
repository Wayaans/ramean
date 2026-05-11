# Subagent Delegation for TDD

## Routing

| Slice type | Subagent | Examples |
|-----------|----------|---------|
| Logic, data, API, algorithms | `agent` | Business rules, database queries, data transforms, auth, validation, pricing calculations |
| UI, components, layout, styling | `designer` | React components, CSS, responsive layout, accessibility, animations, page structure |
| Read-only review or audit | `reviewer` | Code review, test quality check, architecture audit, security review |

## Mixed Slices

When a feature spans both logic and UI (e.g., "user sees their order history"):

1. Write a test for the logic behavior, dispatch `agent`
2. Verify the logic test passes
3. Write a test for the UI behavior, dispatch `designer` — include the data contract the logic slice established
4. Verify the UI test passes

Example:
- Logic slice: `getOrderHistory(userId)` returns `Order[]`
- UI slice: `OrderHistoryList` component renders `Order[]`

## Dispatch Task Template

Give subagents everything they need to act autonomously. A good dispatch is bounded, self-contained, and test-anchored:

```
Implement [specific behavior] so this test passes:

[test code]

Files to modify: [paths]
Related interfaces: [types, contracts the code must satisfy]
Constraints: [framework conventions, project rules]
Only implement what's needed to pass this test — no speculative features.
```

Bounded = one clear behavior, one or two files.
Self-contained = no need for the subagent to ask follow-up questions.
Test-anchored = the test is the acceptance criterion.

## What Never to Delegate

- **Writing tests.** The orchestrator owns the RED phase. If subagents write their own tests, they'll match the tests to their implementation instead of specifying behavior. This defeats the entire point of TDD.
- **Verifying tests.** The orchestrator runs the test after the subagent finishes. If it fails, you diagnose — don't blindly re-dispatch.
- **Choosing slice boundaries.** The orchestrator decides what counts as one behavior, which tests to write, and which subagent handles each. Subagents implement; they don't plan.

## What to Delegate

- **Making a failing test pass.** That's the GREEN phase. The subagent gets a test, writes minimal code to satisfy it.
- **Large-scale refactoring.** After all tests are green, dispatch `agent` or `designer` for substantial refactors with clear instructions about what to change and what tests must still pass.
- **Review.** Dispatch `reviewer` for a read-only quality pass after implementation.

## Parallel Dispatch

When two or more slices have no dependencies on each other and touch different files, dispatch their green phases in the same turn:

```
Slice A (logic): dispatch agent
Slice B (UI):    dispatch designer
```

Rules:
- Slices must not share files or modify the same interface
- Verify each result independently when they complete
- If in doubt, dispatch sequentially