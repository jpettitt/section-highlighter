# Section Highlighter

[![hacs][hacs-badge]][hacs-url]
[![release][release-badge]][releases]
[![license][license-badge]](LICENSE)

> **Alpha.** `0.1.0-alpha1` is the first public build. It has been exercised by hand against
> Home Assistant 2026.9.2, but it has not been run anywhere else yet. To install it through HACS
> you must turn on **Show beta versions** — see below. Expect rough edges, and please
> [open an issue][issues] when you find one.

A Home Assistant custom section that changes its **background, border and glow based on the state
of your entities**. Alarm triggered? The whole section turns red. Garage left open? Amber border.
Everything normal? It looks like any other section.

It is a drop-in superset of HA's built-in `grid` section — your cards, layout, column spans and
drag-and-drop all keep working, because they are still HA's own grid underneath.

## What it looks like

```yaml
type: custom:section-highlighter
column_span: 2
rules:
  - conditions:
      - condition: state
        entity: binary_sensor.smoke
        state: "on"
    background: { color: red, opacity: 25 }
    border: true
    glow: true
  - conditions:
      - condition: numeric_state
        entity: sensor.garage_temp
        above: 30
    background: { color: amber }
cards:
  - type: tile
    entity: cover.garage
```

The first rule whose conditions all pass wins. When nothing matches, the section is left exactly as
it was.

## Requirements

- Home Assistant **2026.9.0** or newer
- A dashboard using the **Sections** view layout

## Installation

### HACS (recommended)

This is not in the HACS default list, so add it as a custom repository:

1. Open **HACS** in the Home Assistant sidebar
2. Click the three-dot menu (top right) → **Custom repositories**
3. Paste `https://github.com/jpettitt/section-highlighter` into **Repository**
4. Choose **Dashboard** as the type, then click **Add**
5. Search HACS for **Section Highlighter** and open it
6. While this is an alpha: three-dot menu → **Show beta versions**, then pick `0.1.0-alpha1`
7. Click **Download**, then **reload your browser** (Ctrl-Shift-R / Cmd-Shift-R)

HACS adds the dashboard resource for you. If your dashboard is in YAML mode, add it yourself:

```yaml
lovelace:
  resources:
    - url: /hacsfiles/section-highlighter/section-highlighter.js
      type: module
```

### Manual

1. Download `section-highlighter.js` from the [latest release][releases]
2. Copy it to `config/www/section-highlighter/section-highlighter.js`
3. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**
4. URL `/local/section-highlighter/section-highlighter.js`, type **JavaScript module**
5. Reload your browser

### Updating

HACS will offer updates in the usual way. Hard-refresh the browser afterwards — dashboard
resources are cached aggressively, and a normal reload sometimes keeps serving the old file.

## Getting started

Home Assistant has no plugin API for adding custom sections to the "Add section" menu, so there are
two ways in.

**With the setup card (easiest)**

1. Edit your dashboard and add a card to the section you want to highlight
2. Pick **Section Highlighter setup** from the card picker and add it
3. That's it — the section converts and the setup card removes itself immediately
4. Click the highlight button that now appears on the section in edit mode, and add your rules

**By hand**

Open the section's three-dot menu → **Edit section** → the YAML tab, and change
`type: grid` to `type: custom:section-highlighter`. Everything else stays as it is.

Once a section is converted, a highlight button appears on it in edit mode. That opens the rule
editor, which uses Home Assistant's own condition builder — the same one as card visibility.

To undo it, open that editor and choose **Remove highlighting**. The section becomes a normal grid
section again, keeping its cards, layout and any static background; only the rules are discarded.

## Configuration

Rules take HA's standard condition schema, so `state`, `numeric_state`, `screen`, `user`, `and`,
`or` and `not` all work exactly as they do on a conditional card. Colors are HA's palette names or
hex codes, the same as a native section background.

See [docs/configuration.md](docs/configuration.md) for the full reference.

## Good to know

- `time` and `location` conditions are not supported yet — they warn in the console and never match.
- A converted section insets its cards slightly to make room for the highlight. This is deliberate
  and constant, so a rule turning on never makes your cards jump.
- A static `background` on the section still works; highlights paint over it and fall back to it.
- Anything other than a palette name or hex color is rejected, because raw CSS breaks theme
  awareness in dark mode.

## Contributing

Bug reports and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). AI coding agents should read
[AGENTS.md](AGENTS.md) first. The architecture and the HA frontend behaviour it relies on are
documented in [docs/design.md](docs/design.md).

[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://github.com/hacs/integration
[release-badge]: https://img.shields.io/github/v/release/jpettitt/section-highlighter?include_prereleases
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[releases]: https://github.com/jpettitt/section-highlighter/releases
[issues]: https://github.com/jpettitt/section-highlighter/issues
