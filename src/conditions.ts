import type { Condition, HomeAssistant, LogicalCondition } from './types';

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`section-highlighter: ${message}`);
}

/** Exported for tests — condition warnings are deduped for the page lifetime. */
export function resetWarnings(): void {
  warned.clear();
}

function isLogical(condition: Condition): condition is LogicalCondition {
  const type = (condition as LogicalCondition).condition;
  return type === 'and' || type === 'or' || type === 'not';
}

function matchesState(state: string, expected: string | string[] | undefined): boolean {
  if (expected === undefined) return false;
  return Array.isArray(expected) ? expected.includes(state) : expected === state;
}

export function checkConditionMet(condition: Condition, hass: HomeAssistant): boolean {
  if (isLogical(condition)) {
    const nested = condition.conditions ?? [];
    switch (condition.condition) {
      case 'and':
        return nested.every((c) => checkConditionMet(c, hass));
      case 'or':
        return nested.some((c) => checkConditionMet(c, hass));
      default:
        return !nested.some((c) => checkConditionMet(c, hass));
    }
  }

  // HA's conditional card still accepts `{entity, state}` with no explicit type.
  const type = (condition as { condition?: string }).condition ?? 'state';

  switch (type) {
    case 'state': {
      const c = condition as { entity: string; state?: string | string[]; state_not?: string | string[] };
      const entity = hass.states[c.entity];
      if (!entity) return false;
      if (c.state !== undefined) return matchesState(entity.state, c.state);
      if (c.state_not !== undefined) return !matchesState(entity.state, c.state_not);
      return false;
    }

    case 'numeric_state': {
      const c = condition as { entity: string; above?: number; below?: number };
      const entity = hass.states[c.entity];
      if (!entity) return false;
      const value = Number(entity.state);
      // Non-numeric states (unavailable, unknown, "on") can never satisfy a threshold.
      if (Number.isNaN(value)) return false;
      if (c.above !== undefined && value <= c.above) return false;
      if (c.below !== undefined && value >= c.below) return false;
      return c.above !== undefined || c.below !== undefined;
    }

    case 'screen': {
      const c = condition as { media_query: string };
      if (!c.media_query || typeof window.matchMedia !== 'function') return false;
      return window.matchMedia(c.media_query).matches;
    }

    case 'user': {
      const c = condition as { users?: string[] };
      if (!hass.user || !Array.isArray(c.users)) return false;
      return c.users.includes(hass.user.id);
    }

    default:
      warnOnce(
        `condition:${type}`,
        `unsupported condition type "${type}" — treated as not met. Supported: state, numeric_state, screen, user, and, or, not.`,
      );
      return false;
  }
}

/** All conditions must pass. An empty or missing list always matches, as in HA. */
export function checkConditionsMet(
  conditions: Condition[] | undefined,
  hass: HomeAssistant,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => checkConditionMet(condition, hass));
}

export function extractEntityIds(conditions: Condition[] | undefined): string[] {
  const ids = new Set<string>();
  const walk = (list: Condition[] | undefined): void => {
    list?.forEach((condition) => {
      if (isLogical(condition)) {
        walk(condition.conditions);
        return;
      }
      const entity = (condition as { entity?: string }).entity;
      if (entity) ids.add(entity);
    });
  };
  walk(conditions);
  return [...ids];
}

export function extractMediaQueries(conditions: Condition[] | undefined): string[] {
  const queries = new Set<string>();
  const walk = (list: Condition[] | undefined): void => {
    list?.forEach((condition) => {
      if (isLogical(condition)) {
        walk(condition.conditions);
        return;
      }
      const query = (condition as { media_query?: string }).media_query;
      if (query) queries.add(query);
    });
  };
  walk(conditions);
  return [...queries];
}
