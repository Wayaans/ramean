# Installation guide for ramean subagents

## Local package usage

Install this repository as a pi package:

```bash
pi install /absolute/path/to/ramean
```

Or add it to project settings:

```json
{
  "packages": ["/absolute/path/to/ramean"]
}
```

## Resources loaded by pi

This package exposes one extension entry:

- `extensions/index.ts`

## Project-level files

Ramean stores project overrides in:

- `.pi/ramean/config.yaml`
- `.pi/ramean/agents/agent.md`
- `.pi/ramean/agents/designer.md`
- `.pi/ramean/agents/reviewer.md`

## Commands

- `/agent`
- `/agent:prompt`
- `/agent:spawn`

## Tools

- `manage`
- `dispatch`
