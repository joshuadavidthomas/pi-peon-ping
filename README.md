# pi-peon-ping

A [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) extension for [peon-ping](https://github.com/PeonPing/peon-ping) sound notifications. Plays themed audio clips on lifecycle events using [OpenPeon](https://github.com/PeonPing/og-packs) sound packs (Warcraft III Peon, GLaDOS, Duke Nukem, StarCraft, and more).

## Requirements

- [pi](https://github.com/badlogic/pi-mono) >= 0.50.0
- An audio player on your system (see [Platform support](#platform-support))

## Features

| Event | Sound category |
|-------|---------------|
| Session start | `session.start` — "Ready to work?" |
| Agent starts working | `task.acknowledge` — "Work, work." |
| Tool error | `task.error` — error sound |
| Rapid prompts (≥3 in 10s) | `user.spam` — annoyed voice line |
| Agent finishes | `task.complete` — completion sound + desktop notification |

- `/peon` opens a settings panel to toggle sounds, switch packs, adjust volume, and enable/disable individual categories
- `/peon install` downloads the default 10 packs from the [peon-ping registry](https://peonping.github.io/registry/)
- Browsing packs previews each one as you scroll

## Installation

Install as a [pi package](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md) globally:

```bash
pi install npm:pi-peon-ping
```

For project-local installation:

```bash
pi install -l npm:pi-peon-ping
```

To try without installing:

```bash
pi -e npm:pi-peon-ping
```

You can also use the repository URL:

```bash
pi install git:github.com/joshuadavidthomas/pi-peon-ping
# or the full URL
pi install https://github.com/joshuadavidthomas/pi-peon-ping
```

For manual installation:

```bash
git clone https://github.com/joshuadavidthomas/pi-peon-ping ~/.pi/agent/extensions/pi-peon-ping
```

## Usage

On first run, the extension will prompt you to install sound packs. You can also install them manually:

```
/peon install
```

Open the settings panel:

```
/peon
```

## Platform support

| Platform | Player |
|----------|--------|
| macOS | `afplay` (built-in) |
| Linux | `pw-play`, `paplay`, `ffplay`, `mpv`, `play`, or `aplay` (first found) |
| WSL | PowerShell `MediaPlayer` |

## Remote development

The extension auto-detects SSH sessions, devcontainers, and Codespaces, and routes audio through the peon-ping relay running on your local machine. See the [peon-ping remote development docs](https://github.com/PeonPing/peon-ping#remote-development-ssh--devcontainers--codespaces) for relay setup. The relay mode can be configured in `/peon` settings (`auto` / `local` / `relay`).

## Config and data

The extension also picks up existing packs from `~/.claude/hooks/peon-ping/` if you have a Claude Code installation. Config and state are stored in `~/.config/peon-ping/`.

### Configuration options

Edit `~/.config/peon-ping/config.json` or use the `/peon` settings panel:

| Option | Default | Description |
|--------|---------|-------------|
| `default_pack` | `"peon"` | Active sound pack |
| `volume` | `0.5` | Sound volume (0.0–1.0) |
| `enabled` | `true` | Master on/off switch |
| `desktop_notifications` | `true` | Show system notifications on task complete |
| `silent_window_seconds` | `0` | Suppress `task.complete` for tasks shorter than N seconds |
| `annoyed_threshold` | `3` | Number of rapid prompts to trigger spam detection |
| `annoyed_window_seconds` | `10` | Time window for spam detection |
| `relay_mode` | `"auto"` | Relay mode: `"auto"`, `"local"`, or `"relay"` |

> **Note:** If you have an existing config with `active_pack`, it will be automatically migrated to `default_pack` on next load.

## Development

```bash
bun install            # Install dependencies
bun run test           # Run tests
bun run test:watch     # Run tests in watch mode
bun run typecheck      # Type check
```

To test the extension locally without conflicting with a globally installed copy:

```bash
pi -ne -e ./src/index.ts
```

`-ne` disables extension auto-discovery, `-e` loads only the local source.

## License

pi-peon-ping is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for more information.
