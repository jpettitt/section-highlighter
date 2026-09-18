export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  user?: { id: string; name: string; is_admin: boolean };
  themes?: unknown;
  localize: (key: string, ...args: unknown[]) => string;
}

export interface StateCondition {
  condition?: 'state';
  entity: string;
  state?: string | string[];
  state_not?: string | string[];
}

export interface NumericStateCondition {
  condition: 'numeric_state';
  entity: string;
  above?: number;
  below?: number;
}

export interface ScreenCondition {
  condition: 'screen';
  media_query: string;
}

export interface UserCondition {
  condition: 'user';
  users: string[];
}

export interface LogicalCondition {
  condition: 'and' | 'or' | 'not';
  conditions: Condition[];
}

export type Condition =
  | StateCondition
  | NumericStateCondition
  | ScreenCondition
  | UserCondition
  | LogicalCondition;

export interface BackgroundStyle {
  color?: string;
  opacity?: number;
}

export interface BorderStyle {
  color?: string;
  width?: number;
}

export interface GlowStyle {
  color?: string;
  size?: number;
}

export type BackgroundConfig = boolean | BackgroundStyle;
export type BorderConfig = boolean | BorderStyle;
export type GlowConfig = boolean | GlowStyle;

export interface HighlightRule {
  conditions?: Condition[];
  background?: BackgroundConfig;
  border?: BorderConfig;
  glow?: GlowConfig;
}

export interface SectionHighlighterConfig {
  type: string;
  rules?: HighlightRule[];
  /** Static background handled natively by hui-sections-view; we only read it for geometry. */
  background?: BackgroundConfig;
  /** Fade duration in ms for style changes. `false` disables the transition. */
  transition?: number | false;
  cards?: unknown[];
  [key: string]: unknown;
}
