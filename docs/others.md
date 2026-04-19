# Other extensions

Reference for the extra non-subagent extensions shipped with ramean.

## Handoff

Command:

- `/handoff <goal>`

Behavior:

- reads the current branch conversation
- generates a focused prompt for a new session using the current active model
- opens the generated prompt in an editor for review
- creates a new session linked to the current session as parent
- prefills the new session editor with the reviewed prompt

Config entry:

```yaml
- extension: handoff
  enabled: true
```

If disabled, ramean does not register `/handoff`.

## Notify

Behavior:

- sends a terminal notification when the main agent finishes and is ready for input
- supports:
  - Windows Terminal toast via PowerShell
  - Kitty OSC 99
  - OSC 777 terminals such as Ghostty, iTerm2, WezTerm, and rxvt-unicode

Config entry:

```yaml
- extension: notify
  enabled: true
```

If disabled, ramean does not register the notification hook.

## Minimal mode

Behavior:

- applies a minimal display mode for tool results
- based on the Pi minimal-mode example
- keeps `write` and `edit` unchanged
- affects other tool displays by hiding or shrinking collapsed output
- expanded view still shows the full tool result

Current scope:

- built-in `read`
- built-in `bash`
- custom tool result displays like `grep`, `glob`, `list`, `web_fetch`, and `find_docs`
- `todo_write`, `question`, and `questionnaire` keep their normal rendering
- subagent dispatch UI is not changed by this extension
- subagent runtime is not changed by this extension

Config entry:

```yaml
- extension: minimal-mode
  enabled: true
```

If disabled, ramean keeps the normal tool display behavior.

## Config warnings

If `.pi/ramean/config.yaml` is malformed, ramean warns and falls back to defaults for the affected extension instead of failing silently.
