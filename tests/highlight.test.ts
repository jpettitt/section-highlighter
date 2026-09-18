import { describe, expect, it } from 'vitest';
import { NO_HIGHLIGHT, matchRule, resolveHighlight } from '../src/highlight';
import type { HighlightRule, HomeAssistant } from '../src/types';

const hass: HomeAssistant = {
  states: {
    'binary_sensor.smoke': { entity_id: 'binary_sensor.smoke', state: 'off', attributes: {} },
    'sensor.temp': { entity_id: 'sensor.temp', state: '35', attributes: {} },
  },
  localize: (key: string) => key,
};

describe('matchRule', () => {
  const rules: HighlightRule[] = [
    {
      conditions: [{ condition: 'state', entity: 'binary_sensor.smoke', state: 'on' }],
      background: { color: 'red' },
    },
    {
      conditions: [{ condition: 'numeric_state', entity: 'sensor.temp', above: 30 }],
      background: { color: 'amber' },
    },
    { conditions: [], background: { color: 'green' } },
  ];

  it('returns the first rule whose conditions all pass', () => {
    expect(matchRule(rules, hass)).toBe(rules[1]);
  });

  it('falls through to a rule with no conditions', () => {
    expect(matchRule(rules.slice(0, 1).concat(rules[2]), hass)).toBe(rules[2]);
  });

  it('returns nothing without rules or hass', () => {
    expect(matchRule(undefined, hass)).toBeUndefined();
    expect(matchRule(rules, undefined)).toBeUndefined();
    expect(matchRule([], hass)).toBeUndefined();
  });
});

describe('resolveHighlight', () => {
  it('returns the transparent baseline when nothing matches', () => {
    expect(resolveHighlight(undefined)).toEqual(NO_HIGHLIGHT);
  });

  it('keeps every field present so CSS can transition between states', () => {
    const resolved = resolveHighlight({ background: { color: 'red' } });
    expect(resolved.backgroundColor).toBe('var(--red-color)');
    expect(resolved.boxShadow).toContain('inset 0 0 0 0px transparent');
    expect(resolved.boxShadow).toContain('0 0 0px 0 transparent');
  });

  it('defaults background opacity to 20%', () => {
    expect(resolveHighlight({ background: { color: 'red' } }).backgroundOpacity).toBe(0.2);
    expect(resolveHighlight({ background: { color: 'red', opacity: 55 } }).backgroundOpacity).toBe(0.55);
  });

  it('treats `true` as the default style', () => {
    const resolved = resolveHighlight({ background: true, border: true, glow: true });
    expect(resolved.backgroundColor).toBe('var(--primary-color)');
    expect(resolved.boxShadow).toBe(
      'inset 0 0 0 2px var(--primary-color), 0 0 12px 0 var(--primary-color)',
    );
  });

  it('lets border and glow inherit the background colour', () => {
    const resolved = resolveHighlight({ background: { color: 'red' }, border: true, glow: true });
    expect(resolved.boxShadow).toBe('inset 0 0 0 2px var(--red-color), 0 0 12px 0 var(--red-color)');
  });

  it('lets glow inherit an explicit border colour', () => {
    const resolved = resolveHighlight({ border: { color: 'blue' }, glow: true });
    expect(resolved.boxShadow).toBe('inset 0 0 0 2px var(--blue-color), 0 0 12px 0 var(--blue-color)');
  });

  it('honours explicit widths and sizes', () => {
    const resolved = resolveHighlight({ border: { color: 'red', width: 4 }, glow: { color: 'green', size: 24 } });
    expect(resolved.boxShadow).toBe('inset 0 0 0 4px var(--red-color), 0 0 24px 0 var(--green-color)');
  });

  it('ignores a style whose colour is invalid rather than rendering something wrong', () => {
    const resolved = resolveHighlight({ border: { color: 'rgba(1,2,3,.4)' } });
    expect(resolved.boxShadow).toBe(NO_HIGHLIGHT.boxShadow);
  });

  it('treats `false` as absent', () => {
    expect(resolveHighlight({ background: false, border: false, glow: false })).toEqual(NO_HIGHLIGHT);
  });
});
