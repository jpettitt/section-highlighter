# Contributing to Section Highlighter

Thanks for your interest in contributing.

> **AI coding agents** (Claude Code, Copilot, Cursor, etc.): the canonical contribution rules live
> in [AGENTS.md](AGENTS.md). Read it before making any change. This file is the human-facing
> onboarding guide; the two should not contradict.

## Development setup

### Prerequisites

- Node.js 20 or higher (see `.nvmrc`)
- npm
- Docker Desktop, for the local Home Assistant testbed

### Getting started

```bash
git clone https://github.com/jpettitt/section-highlighter.git
cd section-highlighter
npm install
npm run build
```

`npm start` runs a dev server on port 5000 with rebuild-on-save.

## Testing your changes

### Local HA testbed (Docker)

`docker-compose.yml` spins up a disposable Home Assistant with `dist/` bind-mounted into its
`www/community/section-highlighter/` directory, so every `npm run build` is picked up immediately —
hard-refresh and you are testing the new bundle.

```bash
npm run build      # the bundle is gitignored, so build once after cloning
npm run ha:up      # HA boots at http://localhost:8123 (~1 min first time)
npm run ha:logs    # follow the logs
npm run ha:down    # stop
npm run ha:reset   # wipe the config and start fresh
```

> **If your changes do not appear**, the browser is probably still running the previously
> imported module: Lovelace resources are loaded with a plain `import()` and our resource URL
> carries no version, so a hard refresh does not always re-fetch it. Confirm with
> `curl -s http://localhost:8123/local/community/section-highlighter/section-highlighter.js | grep <something-new>`;
> if the server has your change but the page does not, append a query string to the resource URL
> (Settings → Dashboards → ⋮ → Resources) and reload.

If port 8123 is already in use by another Home Assistant, set `HA_PORT`:

```bash
HA_PORT=8125 npm run ha:up    # then browse to http://localhost:8125
```

Onboard a throwaway user, then create a **Sections** dashboard view. The bundle auto-loads as a
pre-seeded Lovelace resource — add a card to a section, pick **Section Highlighter setup**, and
click **Enable highlighting**.

The `demo:` integration is enabled in the testbed config, so there are entities to write rules
against: `light.bed_light`, `sensor.outside_temperature`, `binary_sensor.basement_floor_wet` and
friends. `.dev/example-section.yaml` has a ready-made section to paste into the raw config editor.

### What must be tested where

The rule engine, color handling and style resolution are pure functions with unit tests:

```bash
npm test
npm run test:coverage
```

Anything touching `hui-grid-section`, `hui-section`, drag-and-drop or the editor dialog **cannot**
be tested in happy-dom — those elements only exist inside a real HA frontend. Test them in the
Docker testbed and describe the manual steps in your PR. Specifically, a change to the section
element should be checked against:

- dragging cards within the section, and between two sections
- the add-card button and the card edit/delete/duplicate menus
- `column_span` at 1 and wider, on both a wide window and a phone-width one
- edit mode and normal mode
- a section with a native static `background` set, and one without
- light and dark themes

## Before you commit

```bash
npm run lint
npm test
npm run build
```

All three must pass. CI runs the same gates plus HACS validation.

## Pull requests

New work goes on a branch off `main`. Fill in every section of the PR template, including what you
tested and what you could not. If a change touches user-visible behavior, update `README.md`,
`CHANGELOG.md` and `docs/configuration.md` in the same PR.
