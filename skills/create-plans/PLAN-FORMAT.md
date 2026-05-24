# Plan Format

Implementation plans are agent contracts. They tell the next agent what to build, what not to build, where to look, how to verify the work, and when to stop. Use the work artifact format and paths configured in `docs/agents/work-tracker.md`: numbered `.html` plans when work artifacts are HTML, or numbered `.md` plans when work artifacts are Markdown.

## Modes

In PRD-backed mode, the parent PRD is the source ledger. Preserve its `STORY-*`, `REQ-*`, and `DEC-*` IDs. Every plan cites the `STORY-*` and/or `REQ-*` IDs it covers, and cites relevant `DEC-*` IDs in the decisions section when those decisions constrain implementation. If a design doc, context doc, or ADR constrains a slice, cite that source in the decisions or contracts section even when the PRD also mentions it. Write numbered plan files only unless the user asks for an additional overview.

In no-PRD mode, create a lightweight source ledger from the conversation, spec, and repo findings. The ledger uses generated `STORY-*`, `REQ-*`, and `DEC-*` IDs and is approved together with the slice breakdown. After approval, write it as `plans/INDEX.html` or `plans/INDEX.md`, then write the numbered plan files that link back to that index.

## Vertical-slice rules

A plan should be an independently-grabbable vertical slice: a narrow but complete path through all relevant layers needed for one behavior. It is not a horizontal task such as “build backend,” “create components,” or “refactor architecture.” A completed slice should be demoable or verifiable on its own, and many thin complete slices are better than a few broad ones.

An enabling slice is allowed when it unlocks multiple vertical slices and is independently verifiable. Keep these rare and concrete. “Add the shared import parser contract and fixtures used by slices 02–04” is an enabling slice; “set up the backend” is not.

Every slice is either `AFK` or `HITL`, and the plan records the reason. `AFK` means an agent can implement it without more human input because the needed decisions, access, verification, and design direction are already present. `HITL` means it needs a human decision, credential, review, design judgment, or other real interaction; name that interaction so assessment and build do not have to guess. Do not add a recommended subagent or executor field; implementation routing belongs to the build workflow.

## Status gate

Every no-PRD index and plan must expose a visible metadata field named `Status:`. New indexes and plans always start as `needs-assessing`; approval of the slice breakdown allows the files to be written, but it does not make them ready for build. Only the `assessing` workflow may promote source ledgers or plans to `ready-to-build`, and `build-me` may only implement plans after that gate passes.

## Plan sections

Use consistent sections so plans are easy for `assessing`, `build-me`, and humans to read. Each plan should include metadata, goal, user-visible or system-visible behavior, coverage, scope and out of scope, decisions and assumptions, interfaces and contracts, dependencies and blocked-by, implementation guidance, acceptance criteria, tests and checks, risks and rollback, and known unknowns or readiness notes.

Coverage must list the `STORY-*` and/or `REQ-*` IDs covered by the plan. `DEC-*` IDs are not coverage IDs; cite them in the decisions section when they shape the implementation. Acceptance criteria should be measurable and use `CR01`, `CR02`, and so on. Tests and checks should be executable where possible and should include exact commands and expected results when known; when automation is not practical, include a manual verification path and explain why it is sufficient. Risks should include rollback, fallback, or a short reason rollback is not relevant.

## HTML plan template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Plan NN: {Slice Title}</title>
  <style>
    :root { color-scheme: light dark; --border: #d7dce2; --muted: #5f6673; --bg: #f6f7f9; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; max-width: 960px; margin: 0 auto; padding: 2rem; }
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
    <h1>Plan NN: {Slice Title}</h1>

    <section id="metadata"><h2>Metadata</h2><p><strong>Type:</strong> AFK or HITL</p><p><strong>Type reason:</strong> {Why this can run without human input, or what human interaction is required.}</p><p><strong>Source:</strong> <a href="../PRD.html">Parent PRD</a> or <a href="./INDEX.html">No-PRD source ledger</a></p><p><strong>Status:</strong> needs-assessing</p></section>
    <section id="goal"><h2>Goal</h2><p>{State the one behavior or enabling outcome this plan delivers.}</p></section>
    <section id="behavior"><h2>User-visible or system-visible behavior</h2><p>{Describe what changes when the plan is complete. Prefer behavior over layer-by-layer chores.}</p></section>

    <section id="coverage">
      <h2>Coverage</h2>
      <ul>
        <li><strong>User stories:</strong> STORY-001, STORY-002</li>
        <li><strong>Requirements:</strong> REQ-001, REQ-002</li>
      </ul>
    </section>

    <section id="scope"><h2>Scope and out of scope</h2><p>{Define the exact scope of this slice and the nearest tempting work that must not be included.}</p></section>
    <section id="decisions"><h2>Decisions and assumptions</h2><p>{List decisions already made, relevant `DEC-*` IDs, constraining context/design/ADR references, and assumptions the implementer may rely on.}</p></section>
    <section id="contracts"><h2>Interfaces, data, API, and integration contracts</h2><p>{Name stable modules, interfaces, contracts, routes, schemas, or UI surfaces when known. If exact files are unknown, say what to discover and how to confirm.}</p></section>
    <section id="dependencies"><h2>Dependencies and blocked by</h2><p><strong>Blocked by:</strong> None, or `01-short-slug.html` with the reason it must come first.</p><p>{Mention external credentials, services, migrations, or decisions this plan depends on.}</p></section>
    <section id="implementation"><h2>Implementation guidance</h2><p>{Give enough guidance to execute without stale line references. Use stable paths when known. Avoid fake precision.}</p></section>

    <section id="acceptance">
      <h2>Acceptance criteria</h2>
      <ul>
        <li><input type="checkbox" disabled> CR01 — {Measurable completion criterion.}</li>
        <li><input type="checkbox" disabled> CR02 — {Another observable criterion.}</li>
      </ul>
    </section>

    <section id="tests"><h2>Tests and checks</h2><ul><li><strong>TEST-001:</strong> {Targeted test, command, expected result, or manual verification path.}</li></ul></section>
    <section id="risks"><h2>Risks and rollback</h2><p>{Describe the main risk, mitigation, and rollback or fallback path. If rollback is not relevant, explain why.}</p></section>
    <section id="readiness"><h2>Known unknowns and readiness</h2><p>{State any remaining uncertainty. If none remains, say why an agent can tell what to build, what not to build, where to look, how to verify, and when to stop.}</p></section>
  </main>
</body>
</html>
```

## Markdown plan template

```md
# Plan NN: {Slice Title}

## Metadata

**Type:** AFK or HITL  
**Type reason:** {Why this can run without human input, or what human interaction is required.}  
**Source:** [Parent PRD](../PRD.md) or [No-PRD source ledger](./INDEX.md)  
**Status:** needs-assessing

## Goal

{State the one behavior or enabling outcome this plan delivers.}

## User-visible or system-visible behavior

{Describe what changes when the plan is complete. Prefer behavior over layer-by-layer chores.}

## Coverage

**User stories:** STORY-001, STORY-002  
**Requirements:** REQ-001, REQ-002

## Scope and out of scope

{Define the exact scope of this slice and the nearest tempting work that must not be included.}

## Decisions and assumptions

{List decisions already made, relevant `DEC-*` IDs, constraining context/design/ADR references, and assumptions the implementer may rely on.}

## Interfaces, data, API, and integration contracts

{Name stable modules, interfaces, contracts, routes, schemas, or UI surfaces when known. If exact files are unknown, say what to discover and how to confirm.}

## Dependencies and blocked by

**Blocked by:** None, or `01-short-slug.md` with the reason it must come first.

{Mention external credentials, services, migrations, or decisions this plan depends on.}

## Implementation guidance

{Give enough guidance to execute without stale line references. Use stable paths when known. Avoid fake precision.}

## Acceptance criteria

- [ ] CR01 — {Measurable completion criterion.}
- [ ] CR02 — {Another observable criterion.}

## Tests and checks

- **TEST-001:** {Targeted test, command, expected result, or manual verification path.}

## Risks and rollback

{Describe the main risk, mitigation, and rollback or fallback path. If rollback is not relevant, explain why.}

## Known unknowns and readiness

{State any remaining uncertainty. If none remains, say why an agent can tell what to build, what not to build, where to look, how to verify, and when to stop.}
```

## HTML no-PRD index template

Use this only when there is no parent PRD. The index is the durable source ledger for the plan set.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Feature Name} Plan Index</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 960px; margin: 0 auto; padding: 2rem; }
    section { border-top: 1px solid #d7dce2; margin-top: 1.5rem; padding-top: 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #d7dce2; padding: 0.5rem; text-align: left; vertical-align: top; }
  </style>
</head>
<body>
  <main>
    <h1>{Feature Name} Plan Index</h1>
    <p><strong>Status:</strong> needs-assessing · <strong>Mode:</strong> No PRD · <strong>Created:</strong> YYYY-MM-DD · <strong>Source:</strong> conversation, spec, or repo findings</p>
    <section id="source-ledger"><h2>Source ledger</h2><p>{Short source summary and the approved interpretation of the request.}</p></section>
    <section id="scope"><h2>Scope and out of scope</h2><p>{Approved scope boundaries and explicit non-goals.}</p></section>
    <section id="stories"><h2>User stories</h2><ol><li id="STORY-001"><strong>STORY-001:</strong> As an &lt;actor&gt;, I want &lt;feature&gt;, so that &lt;benefit&gt;.</li></ol></section>
    <section id="requirements"><h2>Requirements</h2><ul><li id="REQ-001"><strong>REQ-001:</strong> {Requirement.}</li></ul></section>
    <section id="decisions"><h2>Decisions, assumptions, and risks</h2><ul><li id="DEC-001"><strong>DEC-001:</strong> {Decision.}</li><li id="ASSUMPTION-001"><strong>ASSUMPTION-001:</strong> {Assumption.}</li><li id="RISK-001"><strong>RISK-001:</strong> {Risk.}</li></ul></section>
    <section id="slice-breakdown"><h2>Approved slice breakdown</h2><ol><li><a href="./01-short-slug.html">01 — {Slice title}</a> · AFK · reason: {why AFK or what HITL needs} · blocked by: none · covers STORY-001, REQ-001</li></ol></section>
    <section id="coverage-matrix"><h2>Coverage matrix</h2><table><thead><tr><th>ID</th><th>Covered by plans</th><th>Notes</th></tr></thead><tbody><tr><td>REQ-001</td><td><a href="./01-short-slug.html">01-short-slug.html</a></td><td>{Deferred, excluded, or cross-cutting notes if any.}</td></tr></tbody></table></section>
  </main>
</body>
</html>
```

## Markdown no-PRD index template

```md
# {Feature Name} Plan Index

**Status:** needs-assessing  
**Mode:** No PRD  
**Created:** YYYY-MM-DD  
**Source:** conversation, spec, or repo findings

## Source ledger

{Short source summary and the approved interpretation of the request.}

## Scope and out of scope

{Approved scope boundaries and explicit non-goals.}

## User stories

1. **STORY-001:** As an <actor>, I want <feature>, so that <benefit>.

## Requirements

- **REQ-001:** {Requirement.}

## Decisions, assumptions, and risks

- **DEC-001:** {Decision.}
- **ASSUMPTION-001:** {Assumption.}
- **RISK-001:** {Risk.}

## Approved slice breakdown

1. [01 — {Slice title}](./01-short-slug.md) · AFK · reason: {why AFK or what HITL needs} · blocked by: none · covers STORY-001, REQ-001

## Coverage matrix

| ID | Covered by plans | Notes |
| --- | --- | --- |
| REQ-001 | [01-short-slug.md](./01-short-slug.md) | {Deferred, excluded, or cross-cutting notes if any.} |
```
