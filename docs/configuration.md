# Configuration

A `section-highlighter` section accepts every option HA's `grid` section accepts, plus `rules` and
`transition`.

## Section options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | **required** | `custom:section-highlighter` |
| `rules` | list | `[]` | Highlight rules, evaluated in order. First match wins. |
| `transition` | number \| `false` | `300` | Fade duration in milliseconds when the highlight changes. `false` disables it. |
| `cards` | list | `[]` | Cards, exactly as in a `grid` section. |
| `column_span` | number | `1` | Section width, exactly as in a `grid` section. |
| `background` | bool \| map | — | HA's native static background. Rendered by HA; highlights paint over it. |
| `visibility` | list | — | HA's native section visibility conditions. Handled by HA. |

Any other key is passed through to the underlying grid section untouched.

## Removing highlighting

Open the section's highlight button in edit mode and choose **Remove highlighting**. The section's
`type` goes back to `grid` and the `rules` and `transition` keys are dropped; `cards`,
`column_span`, `background`, `visibility` and `theme` are left untouched. By hand, the same change
is editing the section YAML and setting `type: grid`.

## Rule options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `conditions` | list | `[]` | HA condition objects. All must pass. An empty list always matches. |
| `background` | bool \| map | — | Background tint. |
| `border` | bool \| map | — | Border drawn just inside the section edge. |
| `glow` | bool \| map | — | Outer glow around the section. |

`true` means "use the defaults". Omitting a key, or setting it to `false`, leaves that effect off.

### `background`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | string | `primary` | Palette name or hex code. |
| `opacity` | number | `20` | 0–100. |

### `border`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | string | the rule's background color | Palette name or hex code. |
| `width` | number | `2` | Width in pixels. |

### `glow`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | string | the rule's border color, else its background color | Palette name or hex code. |
| `size` | number | `12` | Blur radius in pixels. |

Border and glow inherit the background's color, so `background: {color: red}` with `border: true`
gives a red border without repeating yourself.

## Colors

Either a hex code (`#ff0000`, `#f00`, `#ff0000cc`) or one of Home Assistant's palette names:

`primary`, `accent`, `red`, `pink`, `purple`, `deep-purple`, `indigo`, `blue`, `light-blue`,
`cyan`, `teal`, `green`, `light-green`, `lime`, `yellow`, `amber`, `orange`, `deep-orange`,
`brown`, `light-grey`, `grey`, `dark-grey`, `blue-grey`, `black`, `white`

Palette names follow the active theme and adapt to light and dark mode. Raw CSS values such as
`var(--my-token)`, `rgba(...)` or gradients are rejected with a console warning, because they do
not adapt.

## Conditions

Rules use Home Assistant's standard condition schema, the same one the conditional card and card
visibility use.

Supported: `state`, `numeric_state`, `screen`, `user`, `and`, `or`, `not`, and the legacy
`{entity, state}` shorthand. `time` and `location` are not supported yet; they warn once in the
console and never match.

```yaml
rules:
  # Anyone home and it is hot
  - conditions:
      - condition: and
        conditions:
          - condition: state
            entity: person.jo
            state: home
          - condition: numeric_state
            entity: sensor.living_room_temp
            above: 26
    background: { color: orange }

  # Any door open, on a wide screen only
  - conditions:
      - condition: or
        conditions:
          - condition: state
            entity: binary_sensor.front_door
            state: "on"
          - condition: state
            entity: binary_sensor.back_door
            state: "on"
      - condition: screen
        media_query: "(min-width: 768px)"
    border: { color: amber, width: 3 }
```

An entity that is `unavailable` or `unknown` simply fails its condition, so the rule does not
match and evaluation falls through to the next one.

## Examples

Alarm states, escalating:

```yaml
type: custom:section-highlighter
rules:
  - conditions:
      - condition: state
        entity: alarm_control_panel.home
        state: triggered
    background: { color: red, opacity: 40 }
    border: { width: 3 }
    glow: true
  - conditions:
      - condition: state
        entity: alarm_control_panel.home
        state: [armed_away, armed_home]
    border: { color: green }
cards:
  - type: alarm-panel
    entity: alarm_control_panel.home
```

Tint only while a washing machine runs, with no fade:

```yaml
type: custom:section-highlighter
transition: false
rules:
  - conditions:
      - condition: numeric_state
        entity: sensor.washer_power
        above: 5
    background: { color: light-blue, opacity: 15 }
cards:
  - type: tile
    entity: sensor.washer_power
```
