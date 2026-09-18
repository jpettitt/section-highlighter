import { describe, expect, it } from 'vitest';
import { replaceSection } from '../src/editor-dialog';

describe('replaceSection', () => {
  const config = {
    views: [
      { sections: [{ type: 'grid', cards: [] }] },
      { sections: [{ type: 'grid', cards: [1] }, { type: 'grid', cards: [2] }] },
    ],
  };

  it('replaces only the targeted section', () => {
    const next = replaceSection(config, 1, 1, { type: 'custom:section-highlighter' });
    expect(next.views[1].sections[1]).toEqual({ type: 'custom:section-highlighter' });
    expect(next.views[1].sections[0]).toBe(config.views[1].sections[0]);
    expect(next.views[0]).toBe(config.views[0]);
  });

  it('does not mutate the original config', () => {
    const snapshot = JSON.parse(JSON.stringify(config));
    replaceSection(config, 0, 0, { type: 'changed' });
    expect(config).toEqual(snapshot);
  });

  it('tolerates a view with no sections array', () => {
    const next = replaceSection({ views: [{}] }, 0, 0, { type: 'x' });
    expect(next.views[0].sections).toEqual([{ type: 'x' }]);
  });
});
