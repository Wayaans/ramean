# Dispatch-only subagent migration plan

Date: 2026-04-19

## Goal

Remove the `manage` orchestration tool completely and move the extension to a dispatch-only model:

- one subagent task = one `dispatch`
- parallel subagent work = multiple top-level `dispatch` calls started by the main agent
- no chain mode
- no grouped orchestration transcript or widget

## Agreed end state

### Product surface

- Keep:
  - `dispatch`
  - `/agent`
  - `/agent:prompt`
  - `/agent:spawn`
  - `/agent:status`
- Remove:
  - `manage`
  - all single/parallel/chain orchestration concepts
  - `parallel.max` from active settings, status, and docs

### Runtime rules

- Only the main agent may call `dispatch`
- Subagents still cannot delegate further
- Repeated concurrent dispatches to the same subagent role are allowed
- Aggregate orchestration success/failure semantics disappear
- The shared standalone dispatch widget remains the only above-editor parallel UI

### Config behavior

- `enabled` remains supported
- stale `parallel.max` values in existing config files are ignored silently
- new writes stop emitting `parallel.max`

### Documentation and prompting

- Main-agent guidance must explicitly say:
  - use `dispatch` for one delegated task
  - use multiple `dispatch` calls in parallel when multiple subagents are needed
- Historical docs that describe `manage` must be marked as historical or updated so they do not read as current behavior

## Implementation workstreams

### 1. Delete manage from runtime and registration

- Remove `extensions/tools/manage.ts`
- Remove `extensions/subagents/manage.ts`
- Stop importing/registering `manage` in `extensions/index.ts`
- Remove manage-specific renderers and types

### 2. Simplify types and UI surfaces

- Remove `ManageMode`, `ManageDetails`, `ManageParallelTask`, and `ManageChainStep`
- Remove manage card/widget rendering from `extensions/UI/renderers.ts`
- Keep dispatch card rendering and shared widget aggregation unchanged
- Remove `parallelMax` from agent-status details and renderers

### 3. Simplify config and settings

- Remove active `parallel.max` support from the normalized config shape
- Keep config parsing tolerant of legacy `parallel.max` fields
- Stop writing `parallel.max` to project config
- Remove `getParallelMax()` and `updateProjectSubagentParallelLimit()`
- Simplify `/agent` extension settings down to enable/disable only

### 4. Tighten prompt/runtime guidance

- Update `dispatch` tool guidance so the model learns dispatch-only orchestration
- Update subagent runtime restriction copy from “manage or dispatch” to “dispatch”
- Update built-in subagent prompts to forbid `dispatch` only

### 5. Rewrite docs and archive stale plans

- Update authoritative docs:
  - `docs/subagents.md`
  - `docs/guidelines/subagents.md`
  - `docs/installation_guides.md`
- Update historical plan docs so `manage` is clearly not current architecture
- Add this plan doc as the current migration plan

### 6. Regression coverage

Add or update tests to enforce:

- no active `parallel.max` in merged/written config behavior
- dispatch widget aggregation still works
- `/agent:status` no longer reports `parallel.max`
- manage-specific helpers/types are gone from the tested surface
- legacy config containing `parallel.max` is tolerated but ignored

## Validation

Run Bun-based validation after implementation:

- `bun test`

If failures show stale `manage` assumptions, remove or update the remaining surfaces rather than adding compatibility shims.
