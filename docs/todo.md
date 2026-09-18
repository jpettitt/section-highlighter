# Backlog

Working notes. Shipped items stay in place as a record; open ideas are unchecked.

## v0.1 — first working version

- [x] Custom section that delegates layout to `hui-grid-section`
- [x] Condition engine matching HA's schema (`state`, `numeric_state`, `screen`, `user`, `and`, `or`, `not`)
- [x] Background tint, border and glow, resolved from one ordered rule list
- [x] Edit-mode dialog hosting HA's own `ha-card-conditions-editor`
- [x] Setup card that converts a plain grid section on placement
- [x] Remove highlighting, turning a section back into a plain `grid` section
- [x] Rule editor confirmed by hand end to end: add rule, edit a condition, save, remove
- [x] Verify in the Docker testbed on HA 2026.9.2: rendering, live state changes, first-match-wins
      ordering, `column_span: 2`, static background + rules together, edit mode, the rule editor
      (including HA's native condition and colour pickers), save round-trip, and the setup card
- [x] Dragging cards within a section and between sections, and card duplication — confirmed by
      hand on HA 2026.9.2 (not scriptable; sortable drag needs a real pointer)
- [x] Phone-width viewport (390px) and light theme — verified on HA 2026.9.2
- [ ] Pin the real minimum HA version by testing older images. Only 2026.9.2 has been exercised;
      `hacs.json` currently claims 2025.1.0, which is a guess.
- [ ] Screenshot / GIF for the README
- [ ] Remove the alpha callout from README.md when 0.1.0 final ships
- [ ] Alpha and beta builds are published as the current release, not marked pre-release, because
      HACS only offers non-pre-release versions by default and would otherwise refuse to install
      them. Keep doing that until 0.1.0 final; the alpha callout in README.md is what warns people.
- [ ] Verify an actual HACS install end to end. This needs HACS itself in the testbed, whose
      setup requires a GitHub OAuth device authorisation, so it cannot be scripted here. Until
      someone does it, the install steps in README.md are unverified.
- [ ] Cover the setup card and the rule editor's config surgery with unit tests. The three UI
      defects found in testing (grid overflow, unreachable button, unslotted footer) were all
      invisible to scripted checks, but `replaceSection` round-trips and the "which keys survive a
      removal" logic are pure and should not need a browser.

## Next

- [ ] Open the rule editor automatically right after the setup card converts a section. The card
      cannot do it itself — converting destroys it — so the newly created section would need to
      notice it was just converted and open its own editor.

- [ ] `time` conditions. Needs a scheduler rather than a state subscription — a ticker that
      re-evaluates on the minute, and only when a rule actually uses one.
- [ ] `location` conditions.
- [ ] Dashed and dotted borders. Dropped from v1 because `box-shadow` cannot draw them and
      `outline` cannot animate as smoothly; would need a separate non-animated path.
- [ ] Pulse / flash animation for alert states, gated behind `prefers-reduced-motion`.
- [ ] Card-level highlighting (`custom:highlight-card`) reusing the same rule engine, for people
      who want one card lit up rather than a whole section.
- [ ] Per-rule icon or badge in a section corner.
- [ ] Translations. All editor strings are currently hardcoded English.

## Known limitations

- Several setup cards converting at once each build their save from `lovelace.config`, so a
  concurrent save could drop one. It self-heals — the surviving card converts on the next edit —
  and the normal flow adds one card at a time. Two simultaneous conversions were tested and both
  landed, but the race is real.

- Our section cannot appear in HA's "Add section" picker: there is no `customSections` registry.
  The setup card and the YAML swap are the two ways in.
- The rule editor is our own dialog, not a tab in HA's section dialog — `hui-dialog-edit-section`
  has a fixed tab set and no per-type config element lookup.
- A converted section insets its cards by one space unit to make room for the highlight.
