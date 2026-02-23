# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project attempts to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
## [${version}]

### Added - for new features
### Changed - for changes in existing functionality
### Deprecated - for soon-to-be removed features
### Removed - for now removed features
### Fixed - for any bug fixes
### Security - in case of vulnerabilities

[${version}]: https://github.com/joshuadavidthomas/pi-peon-ping/releases/tag/${tag}
-->

## [Unreleased]

### Added

- Added [remote relay](https://github.com/PeonPing/peon-ping#remote-development-ssh--devcontainers--codespaces) support — sounds play on your local machine when pi runs over SSH, in a devcontainer, or in Codespaces
- Added `relay_mode` setting to `/peon` settings panel (`auto` / `local` / `relay`)

## [0.1.0]

### Added

- Added pi extension for peon-ping sound notifications on lifecycle events (session start, task acknowledge, task complete, rapid prompt spam)
- Added `/peon` command with settings panel for toggling sounds, switching packs, adjusting volume, and enabling/disabling individual categories
- Added `/peon install` command to download sound packs from the peon-ping registry
- Added cross-platform audio playback (macOS `afplay`, Linux `pw-play`/`paplay`/`ffplay`/`mpv`/`play`/`aplay`, WSL PowerShell `MediaPlayer`)
- Added desktop notifications via OSC 777 on task completion
- Added pack preview when browsing packs in the settings panel
- Added spam detection (annoyed voice lines on ≥3 rapid prompts within 10s)
- Added legacy pack support from `~/.claude/hooks/peon-ping/`

### New Contributors

- Josh Thomas <josh@joshthomas.dev> (maintainer)

[unreleased]: https://github.com/joshuadavidthomas/pi-peon-ping/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/joshuadavidthomas/pi-peon-ping/releases/tag/v0.1.0
