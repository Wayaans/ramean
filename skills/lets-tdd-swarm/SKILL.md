---
name: lets-tdd-swarm
description: Subagent-orchestrated test-driven development. Use when building features or fixing bugs using TDD with subagent delegation, when mentioning "swarm TDD", "TDD with agents", "delegate implementation", or doing TDD on tasks that span UI and logic layers. Also use when the user wants to parallelize TDD work across multiple agents, or when doing red-green-refactor and mentions subagents or delegation.
---

# Test-Driven Development (Swarm)

TDD where the orchestrator writes tests and delegates implementation to subagents. The core loop stays intact — what changes is *who* does the green phase and refactoring.

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**Git Branch** Never start TDD on main/master branch without explicit user consent or create a new branch using `git switch -c`.

See [tests.md](tests.md) for examples, [mocking.md](mocking.md) for mocking guidelines, and [delegation.md](delegation.md) for subagent routing rules.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" — treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes — they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

Subagents make horizontal slicing even more tempting — it's easy to dispatch five implementation tasks at once. Resist this. Dispatch one subagent per test. Wait for the result. Let each cycle inform the next.

**Correct approach**: Vertical slices via tracer bullets. One test → one subagent dispatch → verify → repeat.

```
WRONG (horizontal, even with subagents):
  RED:       test1, test2, test3, test4, test5
  DISPATCH:  agent→impl1, agent→impl2, agent→impl3, ...

RIGHT (vertical, one at a time):
  RED→DISPATCH→VERIFY: test1→impl1→✓
  RED→DISPATCH→VERIFY: test2→impl2→✓
  RED→DISPATCH→VERIFY: test3→impl3→✓
  ...
```

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Classify each behavior: **logic slice** (`agent`), **UI slice** (`designer`), or **mixed** (split logic-first)
- [ ] Identify dependencies between slices — UI slices often depend on logic slices
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system. The orchestrator always writes tests — never delegate test writing to a subagent.

```
RED:       Write test for first behavior → test fails
GREEN:     Dispatch subagent to make it pass → test passes
VERIFY:    Run the test, check implementation quality
```

This is your tracer bullet — proves the path works end-to-end, including the dispatch pipeline.

The test must be self-contained enough that any subagent can understand *what* to implement without asking follow-up questions. Include file paths, type signatures, and expected behavior in the test or dispatch message.

### 3. Incremental Loop

For each remaining behavior:

```
RED:       Write next test → fails
GREEN:     Dispatch subagent → implement → passes
VERIFY:    Run test, check quality, proceed
```

Rules:

- One test at a time
- Only enough code to pass current test — tell the subagent this explicitly
- Don't anticipate future tests
- Keep tests focused on observable behavior
- The orchestrator always writes the test. The subagent always writes the implementation.

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

For refactoring, use subagents when the scope is large:
- Logic/data refactoring → `agent`
- UI/component refactoring → `designer`
- Small refactors → do it yourself, no dispatch needed

### 5. Review

After implementation, dispatch `reviewer` for a read-only quality pass:

- Test quality: does each test verify behavior through public interfaces?
- Implementation quality: does the code match the interface design from planning?
- Coverage gaps: are there critical paths without tests?

## Delegating to Subagents

See [delegation.md](delegation.md) for the full routing guide. Quick reference:

| Slice type | Subagent | Examples |
|-----------|----------|---------|
| Logic, data, API, algorithms | `agent` | Business rules, database queries, auth, validation |
| UI, components, layout, styling | `designer` | React components, CSS, responsive layout, accessibility |
| Read-only review | `reviewer` | Code review, test quality check, architecture audit |

**Mixed slices** — when a feature spans both logic and UI:
1. Write a test for the logic part, dispatch `agent`
2. Verify it passes
3. Write a test for the UI part, dispatch `designer`
4. Verify it passes

### Dispatch Task Template

Give subagents everything they need to act autonomously:

```
Implement [specific behavior] so this test passes:

[paste test code]

Files to modify: [paths]
Related interfaces: [types, contracts]
Constraints: [framework conventions, project rules]
Only implement what's needed to pass this test — no speculative features.
```

### Parallel Slices

When two or more tests have **no dependencies on each other and touch different files**, you can dispatch their green phases in the same turn:

```
Slice A (logic): dispatch agent
Slice B (UI):    dispatch designer
(both in same turn)
```

Rules:
- Slices must not share files or modify the same interface
- You must still verify each result independently when they complete
- If in doubt, dispatch sequentially

### Subagent Rules

- One delegated task = one bounded dispatch (one test's worth of implementation)
- Never ask a subagent to orchestrate other subagents
- Never let subagents write their own tests — they'll write tests that match their implementation, not tests that specify behavior
- If a subagent's implementation fails the test, fix trivial issues yourself or re-dispatch with clarified instructions

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Test is self-contained enough for a subagent to implement
[ ] Code is minimal for this test — no speculative features
[ ] Subagent dispatch targets the right slice type (logic→agent, UI→designer)
[ ] After GREEN: verified test passes and checked implementation quality
```
