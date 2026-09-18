import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_COLORS, resetColorWarnings, resolveColor } from '../src/colors';

beforeEach(() => resetColorWarnings());

describe('resolveColor', () => {
  it('maps every HA palette name to its theme variable', () => {
    UI_COLORS.forEach((name) => {
      expect(resolveColor(name)).toBe(`var(--${name}-color)`);
    });
  });

  it('passes hex codes through in all four lengths', () => {
    ['#abc', '#abcd', '#aabbcc', '#aabbccdd'].forEach((hex) => {
      expect(resolveColor(hex)).toBe(hex);
    });
  });

  it('returns undefined for no colour', () => {
    expect(resolveColor(undefined)).toBeUndefined();
  });

  it('rejects raw CSS that would bypass theme awareness, warning once per value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveColor('var(--my-token)')).toBeUndefined();
    expect(resolveColor('rgba(1,2,3,.5)')).toBeUndefined();
    expect(resolveColor('linear-gradient(red, blue)')).toBeUndefined();
    expect(resolveColor('var(--my-token)')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('rejects malformed hex', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveColor('#ab')).toBeUndefined();
    expect(resolveColor('#gggggg')).toBeUndefined();
    warn.mockRestore();
  });
});
