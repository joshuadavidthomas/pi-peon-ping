# peon-ping pi Extension — Feature Gap Analysis & Plan

Comparison of the current pi-peon-ping extension against the upstream peon-ping README to identify features we could support.

## Already Supported

| Feature | Notes |
|---------|-------|
| **session.start** sounds | On `session_start` event |
| **task.acknowledge** sounds | On `agent_start` event |
| **task.complete** sounds + notification | On `agent_end` event, with 5s debounce and 3s minimum session filter |
| **user.spam** detection | 3+ rapid prompts in configurable window |
| **Pack management** | Install from registry, switch packs via TUI |
| **Volume control** | 0–100% in 10% steps via TUI |
| **Per-category toggles** | All 7 CESP categories toggleable |
| **Pause/resume** | Via TUI settings panel |
| **Relay support** | Auto-detect SSH/devcontainer/Codespaces, relay health checks |
| **Cross-platform audio** | macOS (`afplay`), Linux (`pw-play`/`paplay`/etc.), WSL (PowerShell) |
| **No-repeat logic** | Avoids playing same sound twice in a row per category |

## Not Yet Supported

### 1. Missing Event Handlers

The extension defines `task.error`, `input.required`, and `resource.limit` categories but never triggers them.

| peon-ping Feature | CESP Category | pi Event to Use |
|---|---|---|
| Tool/command errors | `task.error` | `tool_execution_end` where `event.isError === true` |
| Permission requests | `input.required` | Detect when the agent is waiting for user input |
| Session shutdown | `session.end` | `session_shutdown` event |

### 2. Configuration Options

| Feature | Description |
|---|---|
| `silent_window_seconds` | Suppress `task.complete` for tasks shorter than N seconds (currently hardcoded to 3s) |
| `desktop_notifications` toggle | Independent toggle for notifications vs sounds (currently tied together) |
| `default_pack` / `active_pack` migration | peon-ping renamed `active_pack` → `default_pack`; could follow suit |
| `path_rules` | Assign different packs per project directory via glob patterns |
| `pack_rotation` / `pack_rotation_mode` | Rotate through packs randomly or round-robin across sessions |
| `headphones_only` | Only play sounds when headphones detected (suppress on built-in speakers) |
| `suppress_subagent_complete` | Suppress completion sounds from sub-agent sessions |

### 3. Pack Features

| Feature | Description |
|---|---|
| `peon packs next` | Cycle to next pack — could be a `/peon next` subcommand |
| `peon packs remove` | Remove installed packs — could be `/peon remove <name>` |
| `peon preview <category>` | Play all sounds from a category — could be a TUI action |

### 4. Desktop Notifications

The current extension uses only OSC escape sequences (`\x1b]777;notify;...`) which only work in iTerm2-like terminals. peon-ping supports:

- **Overlay banners** — large, visible on-screen banners (JXA Cocoa on macOS, WinForms on Windows)
- **Standard system notifications** — via `terminal-notifier`, `osascript`, `notify-send`
- **Overlay themes** — jarvis, glass, sakura
- **Terminal tab title updates** — `● project: done`, `✗ project: error`

pi's `ctx.ui.notify()` is available and might be a better fit than raw OSC sequences. For system-level notifications, we could shell out to `notify-send` (Linux) or `osascript`/`terminal-notifier` (macOS).

### 5. Peon Trainer (exercise mode)

A unique feature where the peon reminds you to do pushups every ~20 minutes. Could map to:

- `session_start` → initial exercise prompt
- A timer or `agent_end` count → periodic reminders
- `/peon trainer` subcommands for logging reps and checking progress

Substantial feature but very on-brand.

### 6. Mobile Notifications

Push notifications via ntfy.sh, Pushover, or Telegram. Would require:

- Config fields for `mobile_provider`, `mobile_topic`, etc.
- HTTP calls on events (simple `fetch` to ntfy.sh endpoint)
- `/peon mobile` subcommand

## Recommended Priority

1. ~~**Hook up `task.error`** — trivial, just add a `tool_execution_end` handler checking `isError`~~ ✅
2. ~~**Better desktop notifications** — replace OSC with `ctx.ui.notify()` and/or platform-native commands~~ ✅
3. **`silent_window_seconds`** config — make the short-task filter configurable instead of hardcoded 3s
4. **`path_rules`** — per-project pack selection using `ctx.cwd`
5. **Pack rotation** — random/round-robin across sessions
6. **Mobile notifications** — simple HTTP POST to ntfy.sh
7. **Peon Trainer** — fun but substantial feature
