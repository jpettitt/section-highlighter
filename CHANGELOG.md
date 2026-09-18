# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha2] - 2026-09-18

### Fixed

- The rule editor no longer discards unsaved changes. Any entity state change reset it to the
  saved config, so on a busy system a rule added with **Add rule** vanished within a second.

## [0.1.0-alpha1] - 2026-09-17

### Added

- Initial release. `custom:section-highlighter`, a drop-in superset of HA's `grid` section that
  sets its background, border and glow from entity state.
- Ordered rule list using Home Assistant's own condition schema — `state`, `numeric_state`,
  `screen`, `user`, `and`, `or`, `not`. First matching rule wins.
- Background tint, border and glow effects, with colors from HA's palette or hex codes.
- Edit-mode rule editor hosting Home Assistant's own condition builder.
- **Remove highlighting** in the rule editor turns a section back into a plain `grid` section,
  keeping its cards, layout and static background. It asks for confirmation first and names how
  many rules will be lost.
- "Section Highlighter setup" card. Adding it to a plain grid section converts that section and
  removes the card — there is no button to press, because HA makes a card's own controls
  unreachable in edit mode.

### Fixed

- Setup card overflowed its grid cell and collided with the section's add-card button. It declared
  a numeric `rows`, which pins a card to a fixed one-row height in `hui-grid-section`.
- Setup card left an empty grid row outside edit mode. It now sets `hidden`, which collapses the
  cell entirely.
- Setup card showed a "Could not find this section" error in its own config dialog. HA renders that
  dialog's preview inside a real `hui-section`, so finding one is not proof of being on a live
  dashboard; the check now requires a usable `lovelace`.
- Setup card no longer triggers HA's "Visual editor not supported" warning. It supplies a small
  config element explaining that it has no options.
- Rule editor's footer buttons were invisible. `ha-dialog-footer` exposes only the named slots
  `secondaryAction` and `primaryAction`, so unslotted children never render.
