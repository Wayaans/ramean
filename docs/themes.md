# Themes

Ramean ships enhanced Catppuccin themes for the Pi Coding Agent. They are automatically discovered when ramean is installed as a pi package.

## Enhanced Catppuccin Themes

These themes are derived from the upstream [`@sherif-fanous/pi-catppuccin`](https://github.com/sherif-fanous/pi-catppuccin) package, with one key improvement: **tool call state backgrounds are visually distinct**.

### Problem

In the upstream themes, all three tool call states (pending, success, error) share the same background color (`mantle`). You must read the text to know whether a tool call succeeded, failed, or is still running.

### Solution

Each enhanced theme distinguishes tool call states by background:

- **Pending** — slightly darker than the conversation background, signaling "in progress"
- **Success** — mantle (neutral, no tint), keeping successful calls visually quiet
- **Error** — 10% red tint over mantle, calling attention to failures

### Available Themes

| Theme | Flavor | Use When |
|---|---|---|
| `catppuccin-mocha-enhanced` | Mocha (darkest) | You want maximum contrast |
| `catppuccin-macchiato-enhanced` | Macchiato (medium dark) | Balanced dark theme (recommended) |
| `catppuccin-frappe-enhanced` | Frappe (lighter dark) | Softer dark theme |
| `catppuccin-latte-enhanced` | Latte (light) | Light terminal |

### Usage

Set the theme in your `~/.pi/agent/settings.json`:

```json
{
  "theme": "catppuccin-macchiato-enhanced"
}
```

Or select via `/settings` in the TUI.

### Tool State Color Reference

| Flavor | Pending (conversation bg) | Success (mantle) | Error (10% red tint) |
|---|---|---|---|
| Mocha | `#222438` | `#181825` | `#2d2332` |
| Macchiato | `#222438` | `#1e2030` | `#322a3a` |
| Frappe | `#222438` | `#292c3c` | `#3c3442` |
| Latte | `#dde0ea` | `#e6e9ef` | `#eddde2` |

### Hot Reload

When you edit the currently active theme file, pi automatically reloads it for immediate visual feedback. This makes it easy to fine-tune the tint intensity:

1. Open the active theme in your editor
2. Adjust `toolSuccessBg` or `toolErrorBg`
3. Save — the change appears instantly in the TUI

### Derivation Formula

Tool state colors use these formulas:

```
toolPendingBg = conversation background (#25273A), slightly darkened
toolSuccessBg = mantle (no tint)
toolErrorBg   = 0.90 × mantle + 0.10 × red
```

To adjust tint intensity, modify the blend ratio in the theme file. A 10% blend is more subtle; 20% is more pronounced.

## Theme File Location

Themes live in `themes/` at the repo root and are registered via `package.json`:

```json
{
  "pi": {
    "themes": ["./themes"]
  }
}
```

When ramean is installed as a pi package, pi discovers these themes automatically.
