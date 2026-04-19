# Archived plan: subagent alignment and safety implementation plan

Date: 2026-04-19
Status: historical

## Historical note

This document described an earlier architecture that included the `manage` orchestration tool and `parallel.max` configuration.

That is no longer the current contract.

Current architecture:

- `manage` has been removed
- parallel delegated work is expressed by multiple top-level `dispatch` calls
- `parallel.max` is no longer part of the active product surface

For the current migration and active design, see:

- `docs/plans/dispatch-only-subagents.md`
- `docs/subagents.md`
- `docs/guidelines/subagents.md`

The remaining notes below are preserved only as implementation history.
