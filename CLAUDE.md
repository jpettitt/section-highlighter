# CLAUDE.md

The canonical rules for AI coding agents working on this repository live in
[`AGENTS.md`](AGENTS.md). Read it first. Everything below is Claude-specific supplement, not
override.

## Claude-specific notes

- Per-user Claude Code memory under `~/.claude/projects/<project>/` is saved context from prior
  sessions. It complements [`AGENTS.md`](AGENTS.md); it does **not** override it. If a memory
  entry conflicts with [`AGENTS.md`](AGENTS.md), `AGENTS.md` wins and the memory should be updated.
- The user's global instructions (`~/.claude/CLAUDE.md`) add rules on top of these, most notably
  around not committing or pushing without approval. The rule "always let the user test code
  before pushing" survives any session-level commit-autonomy grant.
- The **diagnostic discipline** in [`AGENTS.md`](AGENTS.md) has a specific form here: this project
  depends on undocumented Home Assistant frontend internals, and every one of those dependencies
  was established by reading the shipped `hass_frontend` bundle. Before working around any
  frontend behaviour, grep the bundle and confirm. Then record what you found in
  [`docs/design.md`](docs/design.md) with the frontend version.
- `main` is the canonical and only long-lived branch.
