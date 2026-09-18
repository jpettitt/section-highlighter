import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkConditionMet,
  checkConditionsMet,
  extractEntityIds,
  extractMediaQueries,
  resetWarnings,
} from '../src/conditions';
import type { Condition, HomeAssistant } from '../src/types';

function hassWith(states: Record<string, string>, user?: HomeAssistant['user']): HomeAssistant {
  return {
    states: Object.fromEntries(
      Object.entries(states).map(([entity_id, state]) => [
        entity_id,
        { entity_id, state, attributes: {} },
      ]),
    ),
    user,
    localize: (key: string) => key,
  };
}

beforeEach(() => resetWarnings());

describe('state condition', () => {
  const hass = hassWith({ 'binary_sensor.door': 'on', 'light.hall': 'off' });

  it('matches an exact state', () => {
    expect(checkConditionMet({ condition: 'state', entity: 'binary_sensor.door', state: 'on' }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'state', entity: 'binary_sensor.door', state: 'off' }, hass)).toBe(false);
  });

  it('matches any state in a list', () => {
    const condition: Condition = {
      condition: 'state',
      entity: 'light.hall',
      state: ['off', 'unavailable'],
    };
    expect(checkConditionMet(condition, hass)).toBe(true);
  });

  it('supports state_not', () => {
    expect(checkConditionMet({ condition: 'state', entity: 'light.hall', state_not: 'on' }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'state', entity: 'light.hall', state_not: 'off' }, hass)).toBe(false);
  });

  it('accepts the legacy form with no explicit condition type', () => {
    expect(checkConditionMet({ entity: 'binary_sensor.door', state: 'on' }, hass)).toBe(true);
  });

  it('never matches a missing entity', () => {
    expect(checkConditionMet({ condition: 'state', entity: 'light.nope', state: 'on' }, hass)).toBe(false);
    expect(checkConditionMet({ condition: 'state', entity: 'light.nope', state_not: 'on' }, hass)).toBe(false);
  });
});

describe('numeric_state condition', () => {
  const hass = hassWith({ 'sensor.temp': '25', 'sensor.dead': 'unavailable' });

  it('honours above and below', () => {
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', above: 20 }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', above: 30 }, hass)).toBe(false);
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', below: 30 }, hass)).toBe(true);
    expect(
      checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', above: 20, below: 30 }, hass),
    ).toBe(true);
    expect(
      checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', above: 20, below: 22 }, hass),
    ).toBe(false);
  });

  it('treats thresholds as exclusive', () => {
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', above: 25 }, hass)).toBe(false);
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp', below: 25 }, hass)).toBe(false);
  });

  it('never matches an unavailable or non-numeric state', () => {
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.dead', above: 0 }, hass)).toBe(false);
  });

  it('never matches when no threshold is given', () => {
    expect(checkConditionMet({ condition: 'numeric_state', entity: 'sensor.temp' }, hass)).toBe(false);
  });
});

describe('user condition', () => {
  it('matches the current user id', () => {
    const hass = hassWith({}, { id: 'abc', name: 'Jo', is_admin: true });
    expect(checkConditionMet({ condition: 'user', users: ['abc'] }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'user', users: ['xyz'] }, hass)).toBe(false);
  });

  it('does not match when hass has no user', () => {
    expect(checkConditionMet({ condition: 'user', users: ['abc'] }, hassWith({}))).toBe(false);
  });
});

describe('screen condition', () => {
  it('delegates to matchMedia', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMedia);
    expect(
      checkConditionMet({ condition: 'screen', media_query: '(min-width: 768px)' }, hassWith({})),
    ).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    vi.unstubAllGlobals();
  });
});

describe('logical conditions', () => {
  const hass = hassWith({ 'binary_sensor.a': 'on', 'binary_sensor.b': 'off' });
  const a: Condition = { condition: 'state', entity: 'binary_sensor.a', state: 'on' };
  const b: Condition = { condition: 'state', entity: 'binary_sensor.b', state: 'on' };

  it('handles and / or / not', () => {
    expect(checkConditionMet({ condition: 'and', conditions: [a, b] }, hass)).toBe(false);
    expect(checkConditionMet({ condition: 'or', conditions: [a, b] }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'not', conditions: [b] }, hass)).toBe(true);
    expect(checkConditionMet({ condition: 'not', conditions: [a] }, hass)).toBe(false);
  });

  it('nests arbitrarily deep', () => {
    const nested: Condition = {
      condition: 'and',
      conditions: [a, { condition: 'or', conditions: [b, { condition: 'not', conditions: [b] }] }],
    };
    expect(checkConditionMet(nested, hass)).toBe(true);
  });
});

describe('unsupported conditions', () => {
  it('warns once and does not match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const condition = { condition: 'time', after: '08:00' } as unknown as Condition;
    expect(checkConditionMet(condition, hassWith({}))).toBe(false);
    expect(checkConditionMet(condition, hassWith({}))).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('checkConditionsMet', () => {
  const hass = hassWith({ 'binary_sensor.a': 'on', 'binary_sensor.b': 'on' });

  it('matches when the list is empty or missing', () => {
    expect(checkConditionsMet(undefined, hass)).toBe(true);
    expect(checkConditionsMet([], hass)).toBe(true);
  });

  it('requires every condition to pass', () => {
    const conditions: Condition[] = [
      { condition: 'state', entity: 'binary_sensor.a', state: 'on' },
      { condition: 'state', entity: 'binary_sensor.b', state: 'on' },
    ];
    expect(checkConditionsMet(conditions, hass)).toBe(true);
    conditions.push({ condition: 'state', entity: 'binary_sensor.a', state: 'off' });
    expect(checkConditionsMet(conditions, hass)).toBe(false);
  });
});

describe('extractors', () => {
  const conditions: Condition[] = [
    { condition: 'state', entity: 'light.a', state: 'on' },
    {
      condition: 'or',
      conditions: [
        { condition: 'numeric_state', entity: 'sensor.b', above: 1 },
        { condition: 'screen', media_query: '(min-width: 500px)' },
        { condition: 'and', conditions: [{ condition: 'state', entity: 'light.a', state: 'off' }] },
      ],
    },
  ];

  it('collects unique entity ids across nesting', () => {
    expect(extractEntityIds(conditions).sort()).toEqual(['light.a', 'sensor.b']);
  });

  it('collects media queries across nesting', () => {
    expect(extractMediaQueries(conditions)).toEqual(['(min-width: 500px)']);
  });

  it('is safe on empty input', () => {
    expect(extractEntityIds(undefined)).toEqual([]);
    expect(extractMediaQueries(undefined)).toEqual([]);
  });
});
