---
name: tdd-full
description: Test-driven development for large or high-impact changes. Use when user wants TDD for major refactors, codebase-wide features, risky migrations, or large implementations that need tracer-bullet slices, characterization tests, and bounded subagent help.
---

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**On large changes**: scale does not change the rule. Tests still verify behavior through public interfaces. What changes is coordination. Large work needs a clearer first slice, tighter interface ownership, and more discipline about what can be parallelized.

**When refactoring legacy code**: first protect existing behavior with characterization tests through public interfaces. Before changing internals, pin the behavior users already rely on.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

Large-codebase version of the same mistake:

- Plan the whole migration in detail, then start coding
- Dispatch giant vague tasks to several subagents, then try to merge everything later
- Add broad scaffolding everywhere before one end-to-end behavior works

**Correct approach at scale**: one tracer-bullet slice across the real path first. After that, expand with bounded vertical slices that can be integrated safely.

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify what must remain behavior-compatible
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] Decide the thinnest end-to-end tracer bullet
- [ ] Mark where characterization tests are needed before refactoring
- [ ] Separate serial decisions from truly independent work
- [ ] If subagents are available, split help into bounded tasks with clear ownership
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test? What must stay behavior-compatible? What's the thinnest end-to-end slice?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

**You also can't parallelize everything.** Only split work when the interface contract and slice boundary are already clear.

If subagents are available:

- Use `agent` for implementation-shaped non-UI slices
- Use `designer` for implementation-shaped UI/front-end slices
- Use `reviewer` for read-only validation after implementation
- One delegated task = one bounded dispatch
- Never ask a subagent to orchestrate other subagents

### 2. Tracer Bullet

Start with ONE slice that confirms ONE thing about the system end-to-end:

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

If you're refactoring risky existing code, your first test may be a characterization test that pins current public behavior before you move internals.

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior or slice:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test or bounded slice at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior
- When refactoring legacy code, pin current behavior before changing internals
- Parallelize only independent slices with stable interfaces
- If delegating, dispatch narrow tasks with explicit inputs and outputs
- Main agent stays responsible for integration, final interface decisions, and next-step planning
- After integrating delegated work, rerun relevant tests before moving on

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Collapse temporary scaffolding introduced during slicing
- [ ] Re-check boundaries between modules and interfaces
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] If subagents helped implement, integrate first and use `reviewer` only for final validation when warranted
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

**Never fan out speculative refactors.** Prove behavior first, then clean up.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] Slice is small enough to integrate safely
[ ] Characterization test added when protecting legacy behavior
[ ] Delegated task, if any, is bounded and correctly routed
[ ] Main agent has rerun tests after integration
[ ] No speculative features added
```
