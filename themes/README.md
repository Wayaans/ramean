# Ramean Enhanced Catppuccin Themes

Catppuccin themes for the Pi Coding Agent, enhanced with **distinguishable tool call state colors**.

## The Problem

Upstream Catppuccin themes for pi assign the same background (`mantle`) to all three tool call states — pending, success, and error. Visually, every tool box looks identical regardless of whether it succeeded, failed, or is still running. You have to read the text to tell them apart.

## What's Enhanced

Each `-enhanced` variant distinguishes tool call states with three different backgrounds:

| Flavor | Pending (subtle tint) | Success (mantle) | Error (10% red tint) |
|--------|------|---------|-------|
| Macchiato | `#222438` | `#1e2030` (mantle) | `#322a3a` |
| Mocha | `#222438` | `#181825` (mantle) | `#2d2332` |
| Frappe | `#222438` | `#292c3c` (mantle) | `#3c3442` |
| Latte | `#dde0ea` | `#e6e9ef` (mantle) | `#eddde2` |

The tints are subtle enough to stay within the Catppuccin palette's aesthetic while being distinguishable at a glance in the TUI.

## Available Themes

| Theme Name | Flavor | Type |
|---|---|---|
| `catppuccin-mocha-enhanced` | Mocha (darkest dark) | Dark |
| `catppuccin-macchiato-enhanced` | Macchiato (medium dark) | Dark |
| `catppuccin-frappe-enhanced` | Frappe (lighter dark) | Dark |
| `catppuccin-latte-enhanced` | Latte (light) | Light |

## Upstream

These themes are derived from [`@sherif-fanous/pi-catppuccin`](https://github.com/sherif-fanous/pi-catppuccin) (v0.2.0). The `vars` and non-tool `colors` are identical to the upstream originals. Only the following tokens differ:

- `toolPendingBg` — slightly darker than conversation background (running/in-progress state)
- `toolSuccessBg` — mantle (neutral, no tint)
- `toolErrorBg` — 10% red tint over mantle

The upstream `toolPendingBg` (mantle) is unchanged.

## Syncing with Upstream

When upstream Catppuccin releases new palette versions:
1. Update the `vars` block to match the new upstream values
2. Re-compute `toolSuccessBg` and `toolErrorBg` using the same 15% blend formula
3. Verify the schema URL matches the current pi version
