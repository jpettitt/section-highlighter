/** HA's `ui_color` selector palette, copied verbatim so our names match the native picker. */
export const UI_COLORS = [
  'primary',
  'accent',
  'red',
  'pink',
  'purple',
  'deep-purple',
  'indigo',
  'blue',
  'light-blue',
  'cyan',
  'teal',
  'green',
  'light-green',
  'lime',
  'yellow',
  'amber',
  'orange',
  'deep-orange',
  'brown',
  'light-grey',
  'grey',
  'dark-grey',
  'blue-grey',
  'black',
  'white',
] as const;

export type UiColor = (typeof UI_COLORS)[number];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const warned = new Set<string>();

/** Exported for tests — invalid-color warnings are deduped for the page lifetime. */
export function resetColorWarnings(): void {
  warned.clear();
}

/**
 * Accepts exactly what HA's own section background accepts: a palette name or a hex code.
 * Anything else (var(), rgba(), gradients) is rejected rather than passed through, because
 * raw CSS bypasses theme awareness and silently breaks in the other color scheme.
 */
export function resolveColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  if ((UI_COLORS as readonly string[]).includes(color)) return `var(--${color}-color)`;
  if (HEX.test(color)) return color;
  if (!warned.has(color)) {
    warned.add(color);
    console.warn(
      `section-highlighter: ignoring unsupported color "${color}". Use a hex code or one of: ${UI_COLORS.join(', ')}.`,
    );
  }
  return undefined;
}
