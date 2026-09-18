# Design and architecture

This document records *why* the card is built the way it is, and the Home Assistant frontend
behaviour it depends on. Read it before changing anything under [`src/`](../src/).

All frontend claims below were verified by reading the shipped bundle
(`hass_frontend/frontend_latest/*.js`) at frontend version **20260826.1**, not by reading a
tutorial. Re-verify against the installed bundle before working around anything here.

## Why a custom section, not a wrapper card

The obvious approach to "highlight any card" is a wrapper card holding a nested `card:` config.
It works, but it cannot touch a section, forces users to re-nest existing cards, and shadows the
inner card's `grid_options`. Since the goal was sections, a custom section is both simpler and
more capable.

### Custom sections are supported

`createSectionElement` is a thin wrapper over the same generic element factory used for cards,
badges and rows:

```js
const ALWAYS_LOADED = new Set(['grid']);
const createSectionElement = (config) => createLovelaceElement('section', config, ALWAYS_LOADED, {});
```

That factory checks for a `custom:` prefix **before** it builds the built-in `hui-${type}-section`
tag name. So `type: custom:section-highlighter` resolves to our `<section-highlighter>` element with
no patching of HA internals.

There is **no `customSections` registry** — `window` only gets `customCards`, `customCardFeatures`,
`customBadges` and `customTileFeatures`. That is why our section cannot appear in the "Add section"
picker, and why [`src/convert-card.ts`](../src/convert-card.ts) exists.

### The section layout contract

`hui-section` owns the config, creates the card elements, and drives its layout element. It:

- calls `layoutElement.setConfig(config)` with the **whole** section config;
- sets `hass`, `lovelace`, `index`, `viewIndex`, `isStrategy`, `cards`, `importOnly`, `narrow`
  and `preview`;
- listens on the layout element for `ll-create-card`, `ll-edit-card`, `ll-delete-card`,
  `ll-duplicate-card` and `ll-copy-card`, which bubble up from wherever they are fired.

`cards` arrives as **already-constructed card elements**, not configs. A layout element's whole job
is to arrange them.

That contract is why [`src/section-highlighter.ts`](../src/section-highlighter.ts) creates a real
`hui-grid-section` internally and forwards those nine properties to it. Drag-and-drop, the add-card
button, column spans, and every edit affordance are HA's implementation, not a reimplementation that
would rot. The grid's `ll-*` events bubble through us and reach `hui-section` unchanged.

`hui-grid-section` is in `ALWAYS_LOADED`, so it is defined whenever a sections view renders. We
still guard with `customElements.whenDefined` + `customElements.upgrade` before setting properties,
because setting a property on an un-upgraded element shadows the class accessor — the same dance
HA's own lazy element creation performs.

## Why we paint our own background

HA has shipped native section backgrounds since well before this project started
(`background: true | {color, opacity}`). We are not reimplementing that feature — we are making it
state-driven. But the native layer is **not ours to drive**:

```js
// hui-sections-view
_renderSection(sectionEl, align) {
  const hasBg = sectionEl.config.background !== undefined;
  return html`<div class="section-container ${classMap({'has-background': hasBg, ...})}">
    ${hasBg ? html`<hui-section-background .background=${sectionEl.config.background} ...>` : nothing}
    ${sectionEl}
  </div>`;
}
```

`hui-section-background` is rendered by the **view**, two levels above us, as a sibling of
`hui-section`, and it reads the static config. We cannot make it react to state. So we paint our own
tint layer inside our element, and a section's static `background` still works underneath it,
untouched. When no rule matches we render fully transparent, so the native background shows through
exactly as the user configured it.

### Matching the native box

The view's own geometry is:

```css
.section-container { position: relative }
.section-container.has-background {
  padding: var(--ha-space-2);
  border-radius: var(--ha-section-border-radius, var(--ha-border-radius-xl));
}
```

To trace the same rounded rectangle we mirror that radius, and handle the padding in two cases:

- **No static background** — the container has no padding, so we add `var(--ha-space-2)` of our own
  padding. The highlight then has the same breathing room the native background gives.
- **Static background set** — the container is *already* padded, so we bleed out over it with a
  negative margin of the same size. The highlight lands on the container edge and the cards do not
  move.

The padding is applied **unconditionally**, not only while a rule matches. A rule switching on must
never reflow the cards.

For the same reason border and glow are rendered as one `box-shadow` (inset segment for the border,
outer segment for the glow) rather than a real `border`: `box-shadow` costs no layout. It also lets
the transition work — CSS will not animate to or from `none`, so the "nothing matches" state is a
transparent, zero-spread shadow rather than no shadow at all. `NO_HIGHLIGHT` and a resolved rule are
built by the same function so the two strings are byte-identical when both mean "off".

## Rules

`rules` is an ordered list; the first rule whose conditions **all** pass wins, and nothing matching
leaves the section alone. That mirrors HA automations and the conditional card, and it keeps the
editor's job to reordering a list.

Conditions use HA's own schema (`state`, `numeric_state`, `screen`, `user`, `and`, `or`, `not`,
plus the legacy `{entity, state}` shorthand). [`src/conditions.ts`](../src/conditions.ts)
reimplements the evaluator because HA's is internal to the frontend bundle; matching the schema is
what matters, since it is what users already know and what `ha-card-conditions-editor` produces.

`time` and `location` conditions are **not** implemented. They need a scheduler rather than a state
subscription; an unsupported type warns once and evaluates false.

Re-evaluation is driven by two signals: a `hass` update where one of the rules' tracked entities
actually changed identity, and a `change` event from any `matchMedia` query used by a `screen`
condition. A `screen` condition would otherwise never re-evaluate on resize.

## The setup card has no button

`hui-card-edit-mode` wraps every card while a dashboard is being edited. On hover it raises a
`.card-overlay` over the card and routes the click to the card editor, so **a card's own controls
cannot be clicked in edit mode**. The overlay is what greys the card out and shows the pencil.

Adding a card only ever happens in edit mode, so a click-to-convert setup card is unreachable by
construction: pressing its button just opens the card's config dialog. The first implementation had
exactly that bug.

[`src/convert-card.ts`](../src/convert-card.ts) therefore acts on *placement* instead. It converts
the section from `updated()` once it finds itself inside a real `hui-section`, then removes itself
from the config. In the card picker's preview there is no section, so it renders a short
explanation and does nothing.

The conversion is gated on `preview` (HA's name for edit mode) so a config rewrite never happens
under someone who is only looking at their dashboard. A setup card added by hand in YAML converts
the next time the dashboard is edited.

### "Am I in a real section?" is not "did I find a hui-section?"

The card config dialog does not render its preview bare. It builds a **real
`hui-section` + `hui-grid-section` pair** inside the dialog to show the card in context:

```
section-highlighter-convert → hui-card → … → hui-grid-section → hui-section → ha-dialog → hui-dialog-edit-card
```

So walking up and finding a `hui-section` is *not* enough to conclude you are on a live dashboard —
the first implementation did exactly that and showed a "Could not find this section" error in the
config dialog every time.

The distinguishing property is `lovelace`: the dialog's preview section carries none, and neither
do `index` / `viewIndex`. Requiring a usable `lovelace` separates a live section from both the
config-dialog preview and the card-picker preview (which has no section at all). Treat either as
"nothing to convert" rather than an error.

### The card provides a stand-in config editor

The card has no options, but a card without `getConfigElement` makes HA render a "Visual editor not
supported" warning beside a YAML box, which reads like a fault. `getConfigElement()` returns a small
element that just explains what adding the card does, and HA then shows its normal Config /
Visibility / Layout tabs.

## Colors

`resolveColor` accepts exactly what HA's own section background accepts: one of the 26 `ui_color`
palette names (mapped to `var(--<name>-color)`) or a hex code. Raw CSS — `var()`, `rgba()`,
gradients — is rejected with a one-time console warning rather than passed through, because it
bypasses theme awareness and silently breaks in the other color scheme.

## The editor

`hui-dialog-edit-section` has a fixed tab set (settings, visibility, YAML) and never looks up a
per-type config element, so a custom section cannot add a tab. Instead our section renders its own
edit-mode button, which opens our own dialog.

That dialog hosts HA's real `ha-card-conditions-editor` (`.hass`, `.conditions`, `@value-changed`)
so the condition UI is identical to card and section visibility. That element lives in a lazily
loaded editor chunk; we pull it in by asking the built-in conditional card for its config element,
and fall back to a JSON text area if it does not arrive within two seconds.

### The dialog must be rendered inside the section

The dialog is rendered from the section's own Lit template, not appended to `document.body` and
not handed to HA's dialog manager. This is load-bearing, and it was found the hard way.

Current HA elements such as `ha-entity-picker` do **not** take `hass` as a property — they read it
from a Lit context provided high in the app tree. A context consumer only resolves if it is a DOM
descendant of the provider. A dialog appended to `document.body` is outside that tree, so the
picker upgrades but renders nothing: the condition editor comes up with its entire "Entity" row
missing, while the rows that do take plain properties (attribute, state) render fine. That is a
confusing failure, because most of the dialog looks correct.

Routing through HA's dialog manager (`fireEvent(el, 'show-dialog', {dialogTag, dialogImport,
dialogParams})`) does not fix it. The manager mounts its own dialogs inside `home-assistant`'s
shadow root, but it mounts unrecognised tags into `document.body`, which lands us back where we
started.

Rendering from the section's template keeps the dialog inside the tree, and `ha-dialog` uses the
top layer, so its position in the DOM does not affect how the modal displays.

Measured at frontend 20260826.1: `ha-entity-picker` renders 86px tall inside the tree and 0px in
`document.body` — the same 86px HA's own section-visibility dialog produces.

Saving goes through the `lovelace` object `hui-section` already handed us, so no DOM traversal is
involved. Unknown keys survive HA's own section settings editor, which spreads `{...this.config}`
on save — `rules` is not stripped when a user edits column span in the native dialog.

## Verified HA element APIs

These were confirmed present in frontend 20260826.1 before use. The published frontend renames and
reshapes elements between releases, so re-check before relying on any of them.

| Element | API used | Notes |
| --- | --- | --- |
| `ha-dialog` | `.open`, `header-title`, `@closed` | **Not** `.heading` / `hideActions` — that is the older MWC-era API. Actions go in `<ha-dialog-footer slot="footer">`, and the dialog fires `closed` after animating out, at which point it should clear params and fire `dialog-closed`. |
| `ha-card-conditions-editor` | `.hass`, `.conditions`, `@value-changed` | Lives in a lazily loaded editor chunk; see "The editor" above. |
| `ha-form` | `.hass`, `.data`, `.schema`, `.computeLabel`, `@value-changed` | `expandable` + `flatten` + `visible: {field, value}` schema entries work — copied from `hui-section-settings-editor`. |
| `ha-selector` | `selector: {ui_color: {}}` | `ha-selector-ui_color` is the native color picker. |
| `ha-button` | `appearance="plain" \| "filled" \| "accent"` | |
| `ha-alert` | `alert-type="error" \| "warning" \| "info"` | |
| `ha-dialog-footer` | `slot="footer"` on itself; children need `slot="secondaryAction"` or `slot="primaryAction"` | It has **no default slot** — its shadow root is `<footer><slot name="secondaryAction"><slot name="primaryAction"></footer>`. Buttons without a `slot` attribute are assigned nowhere and never render, while staying in the DOM and clickable from script. |
| `ha-icon-button` | `.path`, `.disabled`, `label` | No confirmed slot fallback — always give it `.path`, from `@mdi/js`. |
| `ha-entity-picker` | context-provided `hass` | Takes no `hass` property. Only renders inside the HA element tree — see "The dialog must be rendered inside the section". |
