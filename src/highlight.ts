import { checkConditionsMet } from './conditions';
import { resolveColor } from './colors';
import type {
  BackgroundStyle,
  BorderStyle,
  GlowStyle,
  HighlightRule,
  HomeAssistant,
} from './types';

const DEFAULT_BACKGROUND_OPACITY = 20;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_GLOW_SIZE = 12;
const FALLBACK_COLOR = 'primary';

/**
 * Every field is always present. Border and glow ride on one box-shadow with a transparent
 * zero-spread baseline so a rule switching on or off animates instead of snapping — CSS will
 * not transition to or from `none`. box-shadow also costs no layout, so the cards never move.
 */
export interface ResolvedHighlight {
  backgroundColor: string;
  backgroundOpacity: number;
  boxShadow: string;
}

/** Single source of truth for the shadow string: the baseline must be byte-identical to a
 * resolved "nothing on" rule, or _evaluate() sees a change where there is none. */
function buildShadow(
  borderWidth: number,
  borderColor: string | undefined,
  glowSize: number,
  glowColor: string | undefined,
): string {
  return [
    `inset 0 0 0 ${borderWidth}px ${borderColor ?? 'transparent'}`,
    `0 0 ${glowSize}px 0 ${glowColor ?? 'transparent'}`,
  ].join(', ');
}

export const NO_HIGHLIGHT: ResolvedHighlight = {
  backgroundColor: 'transparent',
  backgroundOpacity: 0,
  boxShadow: buildShadow(0, undefined, 0, undefined),
};

function asObject<T extends object>(value: boolean | T | undefined): T | undefined {
  if (value === undefined || value === false) return undefined;
  return value === true ? ({} as T) : value;
}

/** First rule whose conditions all pass wins; nothing matching leaves the section untouched. */
export function matchRule(
  rules: HighlightRule[] | undefined,
  hass: HomeAssistant | undefined,
): HighlightRule | undefined {
  if (!rules || !hass) return undefined;
  return rules.find((rule) => checkConditionsMet(rule.conditions, hass));
}

export function resolveHighlight(rule: HighlightRule | undefined): ResolvedHighlight {
  if (!rule) return NO_HIGHLIGHT;

  const background = asObject<BackgroundStyle>(rule.background);
  const border = asObject<BorderStyle>(rule.border);
  const glow = asObject<GlowStyle>(rule.glow);

  // Border and glow inherit the background's colour, so `background: {color: red}, border: true`
  // does the obvious thing without repeating yourself.
  const baseColor = background?.color ?? FALLBACK_COLOR;

  const backgroundColor = background ? resolveColor(background.color ?? FALLBACK_COLOR) : undefined;
  const borderColor = border ? resolveColor(border.color ?? baseColor) : undefined;
  const glowColor = glow ? resolveColor(glow.color ?? border?.color ?? baseColor) : undefined;

  const borderWidth = borderColor ? (border?.width ?? DEFAULT_BORDER_WIDTH) : 0;
  const glowSize = glowColor ? (glow?.size ?? DEFAULT_GLOW_SIZE) : 0;

  return {
    backgroundColor: backgroundColor ?? 'transparent',
    backgroundOpacity: backgroundColor ? (background?.opacity ?? DEFAULT_BACKGROUND_OPACITY) / 100 : 0,
    boxShadow: buildShadow(borderWidth, borderColor, glowSize, glowColor),
  };
}
