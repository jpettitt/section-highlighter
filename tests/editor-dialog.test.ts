import { afterEach, describe, expect, it, vi } from 'vitest';
import { html, render } from 'lit';
import { replaceSection, type SectionHighlighterDialog } from '../src/editor-dialog';

describe('section-highlighter-dialog', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // The section re-renders on every hass update, and Lit re-assigns object bindings on every
  // render even when the object is unchanged. Unsaved rules must survive that.
  it('keeps unsaved rules when the owning section re-renders', async () => {
    vi.useFakeTimers();
    const params = {
      config: { type: 'custom:section-highlighter' },
      hass: {},
      lovelace: {},
      viewIndex: 0,
      sectionIndex: 0,
    } as any;
    const host = document.createElement('div');
    document.body.append(host);
    const template = () =>
      html`<section-highlighter-dialog .params=${params}></section-highlighter-dialog>`;

    render(template(), host);
    const dialog = host.querySelector('section-highlighter-dialog') as SectionHighlighterDialog &
      Record<string, any>;
    dialog._addRule();
    expect(dialog._rules).toHaveLength(1);

    render(template(), host);
    expect(dialog._rules).toHaveLength(1);
  });
});

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
