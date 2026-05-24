# PRD Format

A PRD is a durable requirements artifact. Use the work artifact format and path configured in `docs/agents/work-tracker.md`: `PRD.html` when work artifacts are HTML, or `PRD.md` when work artifacts are Markdown. Keep the same semantic sections in either format so `create-plans`, `assessing`, and `build-me` can trace the work later.

## Stable IDs

Use stable IDs so implementation plans can trace slices back to the PRD. Number each family independently with three digits: `GOAL-001`, `NOGOAL-001`, `STORY-001`, `REQ-001`, `DEC-001`, `ASSUMPTION-001`, `DEP-001`, `RISK-001`, `OQ-001`, and `SRC-001`. Do not renumber existing IDs during small edits; add new IDs at the end of the relevant family.

## Status gate

Every PRD must expose a visible metadata field named `Status:`. New PRDs always start as `needs-assessing`; only the `assessing` workflow may promote a PRD to `ready-to-build`, and only after the required plans also exist, pass assessment, and receive user confirmation. Do not write `Draft`, `Approved`, or `ready-to-build` in a newly created PRD.

User stories must be complete, distinct, and non-overlapping. Cover the user intents, flows, edge cases, permissions, failures, and lifecycle states that matter for the feature, but do not pad the list with repetitive stories or create an artificial minimum count. Each story uses this form:

```md
1. [STORY-001] As an <actor>, I want <feature>, so that <benefit>.
```

## Content rules

Write the PRD as durable product context, not a transcript. Quote the conversation only when exact wording matters. Avoid volatile line numbers and implementation snippets. Stable module names, public interfaces, data contracts, state machines, type shapes, or schema outlines are allowed when they encode a decision more precisely than prose can.

Implementation decisions should describe the seams another agent must preserve. Prefer deep modules: modules that hide meaningful complexity behind a small, stable, testable interface. Avoid shallow wrapper decisions that merely pass implementation details around. Testing decisions should focus on externally visible behavior and high-risk contracts, with likely test targets and useful prior art from the repo when known.

Use implementation-grade language. Requirements and decisions should be concrete enough that a later agent does not need to infer what "proper," "better," "simple," "clean," "nice," or "etc." means. If a term is intentionally flexible, define the allowed range and the stop condition. When alternatives were rejected, include the rejection only when it prevents a likely wrong implementation path.

Source coverage must be useful, not bookkeeping. It should show that important conversation decisions, context docs, design docs, ADRs, and code findings were either carried into the PRD or intentionally left out. A reader should be able to answer both questions: which source produced this important requirement or decision, and where did this important source point land in the PRD?

## Required sections

Include sections that have real content. If a section is not relevant, omit it or state why it is not relevant rather than filling it with boilerplate. The important sections are problem statement, solution summary, goals and non-goals, actors, user stories, requirements, technical and product decisions, assumptions, modules and test targets, data/API/integration contracts, testing decisions, dependencies, risks, open questions, decision ledger, and source coverage.

## HTML template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Feature Name} PRD</title>
  <style>
    :root { color-scheme: light dark; --border: #d7dce2; --muted: #5f6673; --bg: #f6f7f9; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; max-width: 980px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3 { line-height: 1.2; }
    section { border-top: 1px solid var(--border); margin-top: 1.5rem; padding-top: 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; vertical-align: top; }
    code { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
    .meta, .muted { color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <h1>{Feature Name} PRD</h1>
    <p class="meta"><strong>Status:</strong> needs-assessing · <strong>Created:</strong> YYYY-MM-DD · <strong>Source:</strong> conversation, file path, URL, or parent artifact</p>

    <section id="problem"><h2>Problem statement</h2><p>{Describe the problem from the user's perspective and why solving it matters now.}</p></section>
    <section id="solution"><h2>Solution summary</h2><p>{Describe the intended solution from the user's perspective.}</p></section>

    <section id="goals">
      <h2>Goals and non-goals</h2>
      <h3>Goals</h3>
      <ul><li id="GOAL-001"><strong>GOAL-001:</strong> {Goal.}</li></ul>
      <h3>Non-goals</h3>
      <ul><li id="NOGOAL-001"><strong>NOGOAL-001:</strong> {Explicitly out-of-scope item.}</li></ul>
    </section>

    <section id="actors"><h2>Actors</h2><p>{Name the users, roles, systems, or maintainers involved.}</p></section>

    <section id="user-stories">
      <h2>User stories</h2>
      <ol><li id="STORY-001"><strong>STORY-001:</strong> As an &lt;actor&gt;, I want &lt;feature&gt;, so that &lt;benefit&gt;.</li></ol>
    </section>

    <section id="requirements">
      <h2>Requirements</h2>
      <ul><li id="REQ-001"><strong>REQ-001:</strong> {Concrete requirement with observable behavior.}</li></ul>
    </section>

    <section id="decisions">
      <h2>Technical and product decisions</h2>
      <ul><li id="DEC-001"><strong>DEC-001:</strong> {Decision and short rationale.}</li></ul>
    </section>

    <section id="assumptions"><h2>Assumptions</h2><ul><li id="ASSUMPTION-001"><strong>ASSUMPTION-001:</strong> {Assumption, why it is safe for now, and what would invalidate it.}</li></ul></section>
    <section id="modules"><h2>Modules, interfaces, and test targets</h2><p>{Name likely modules or interfaces to build or modify. Identify deep-module opportunities and likely test targets.}</p></section>
    <section id="contracts"><h2>Data, API, and integration contracts</h2><p>{Describe data ownership, API behavior, integration boundaries, and compatibility expectations.}</p></section>
    <section id="testing"><h2>Testing decisions</h2><p>{Describe the behavior to test, the modules/contracts most worth testing, and relevant prior art in the repo.}</p></section>

    <section id="dependencies"><h2>Dependencies</h2><ul><li id="DEP-001"><strong>DEP-001:</strong> {Dependency or prerequisite.}</li></ul></section>
    <section id="risks"><h2>Risks and constraints</h2><ul><li id="RISK-001"><strong>RISK-001:</strong> {Risk, constraint, and mitigation when known.}</li></ul></section>
    <section id="open-questions"><h2>Open questions</h2><ul><li id="OQ-001"><strong>OQ-001:</strong> {Question that remains open and why it does not block the PRD, or why it blocks later work.}</li></ul></section>

    <section id="decision-ledger">
      <h2>Decision ledger</h2>
      <table>
        <thead><tr><th>ID</th><th>Decision</th><th>Rejected options</th><th>Assumptions</th></tr></thead>
        <tbody><tr><td>DEC-001</td><td>{Decision.}</td><td>{Rejected option and why.}</td><td>{Assumption, if any.}</td></tr></tbody>
      </table>
    </section>

    <section id="source-coverage">
      <h2>Source coverage</h2>
      <table>
        <thead><tr><th>ID</th><th>Source</th><th>Covered points</th><th>Omissions or notes</th></tr></thead>
        <tbody><tr id="SRC-001"><td>SRC-001</td><td>{Conversation, file, URL, doc, ADR, or code inspection.}</td><td>{Which goals, stories, requirements, decisions, assumptions, or risks came from this source.}</td><td>{Important source points intentionally deferred, excluded, or not applicable.}</td></tr></tbody>
      </table>
    </section>
  </main>
</body>
</html>
```

## Markdown template

```md
# {Feature Name} PRD

**Status:** needs-assessing  
**Created:** YYYY-MM-DD  
**Source:** conversation, file path, URL, or parent artifact

## Problem statement

{Describe the problem from the user's perspective and why solving it matters now.}

## Solution summary

{Describe the intended solution from the user's perspective.}

## Goals and non-goals

### Goals

- **GOAL-001:** {Goal.}

### Non-goals

- **NOGOAL-001:** {Explicitly out-of-scope item.}

## Actors

{Name the users, roles, systems, or maintainers involved.}

## User stories

1. **STORY-001:** As an <actor>, I want <feature>, so that <benefit>.

## Requirements

- **REQ-001:** {Concrete requirement with observable behavior.}

## Technical and product decisions

- **DEC-001:** {Decision and short rationale.}

## Assumptions

- **ASSUMPTION-001:** {Assumption, why it is safe for now, and what would invalidate it.}

## Modules, interfaces, and test targets

{Name likely modules or interfaces to build or modify. Identify deep-module opportunities and likely test targets.}

## Data, API, and integration contracts

{Describe data ownership, API behavior, integration boundaries, and compatibility expectations.}

## Testing decisions

{Describe the behavior to test, the modules/contracts most worth testing, and relevant prior art in the repo.}

## Dependencies

- **DEP-001:** {Dependency or prerequisite.}

## Risks and constraints

- **RISK-001:** {Risk, constraint, and mitigation when known.}

## Open questions

- **OQ-001:** {Question that remains open and why it does not block the PRD, or why it blocks later work.}

## Decision ledger

| ID | Decision | Rejected options | Assumptions |
| --- | --- | --- | --- |
| DEC-001 | {Decision.} | {Rejected option and why.} | {Assumption, if any.} |

## Source coverage

| ID | Source | Covered points | Omissions or notes |
| --- | --- | --- | --- |
| SRC-001 | {Conversation, file, URL, doc, ADR, or code inspection.} | {Which goals, stories, requirements, decisions, assumptions, or risks came from this source.} | {Important source points intentionally deferred, excluded, or not applicable.} |
```
