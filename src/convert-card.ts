import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { replaceSection } from './editor-dialog';
import type { HomeAssistant } from './types';

const SECTION_TAG = 'HUI-SECTION';
const HIGHLIGHT_TYPE = 'custom:section-highlighter';
const CONVERT_TYPE = 'custom:section-highlighter-convert';

interface HuiSection extends HTMLElement {
  config?: { type?: string; cards?: { type?: string }[] };
  lovelace?: any;
  index?: number;
  viewIndex?: number;
}

/**
 * Walks out through shadow roots to the enclosing hui-section.
 *
 * This is the one place the project touches HA's DOM shape, and it is confined to a one-shot
 * setup action rather than the rendering path: if HA restructures the tree the card reports an
 * error and points at the YAML route, instead of a dashboard that renders wrong. Searching by tag
 * name rather than a fixed number of hops keeps it working when intermediate wrappers change.
 */
function findSection(start: HTMLElement): HuiSection | undefined {
  let node: Node | null = start;
  let hops = 0;
  while (node && hops < 30) {
    if ((node as HTMLElement).tagName === SECTION_TAG) return node as HuiSection;
    node = (node as HTMLElement).parentNode ?? (node.getRootNode() as ShadowRoot).host;
    hops += 1;
  }
  return undefined;
}

/**
 * Converts the section it is dropped into, then deletes itself from the dashboard config.
 *
 * It deliberately has **no button**. In edit mode HA wraps every card in `hui-card-edit-mode`,
 * which lays a `.card-overlay` over it on hover and routes the click to the card editor — a
 * card's own controls are unreachable there. Since adding a card only ever happens in edit mode,
 * a click-to-convert card could never work. Acting on placement sidesteps the problem entirely
 * and makes the whole flow one step: add the card, the section converts.
 */
@customElement('section-highlighter-convert')
export class SectionHighlighterConvert extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ type: Boolean }) public preview = false;

  @state() private _error?: string;

  private _done = false;

  public setConfig(): void {
    // No options — the card exists only to convert its section and then delete itself.
  }

  /**
   * The card has no options, but without a config element HA shows a "Visual editor not
   * supported" warning next to a YAML box, which reads like something is wrong. A tiny editor
   * that simply explains the card is friendlier than that warning.
   */
  public static async getConfigElement(): Promise<HTMLElement> {
    return document.createElement('section-highlighter-convert-editor');
  }

  public getCardSize(): number {
    return 1;
  }

  public getGridOptions(): Record<string, unknown> {
    // rows must not be a number: hui-grid-section only adds its fixed-height `fit-rows` class
    // when it is one, and this card's content is taller than a row, so a number makes it
    // overflow its grid cell and collide with the add-card button.
    return { columns: 'full', rows: 'auto' };
  }

  protected override willUpdate(_changed: PropertyValues): void {
    // hui-grid-section collapses a cell whose card is [hidden] (`.card:has(>[hidden])`). Without
    // it the cell still takes a grid row and a row-gap even at zero height.
    this.toggleAttribute('hidden', !this.preview);
  }

  protected override updated(_changed: PropertyValues): void {
    if (this._done || this._error) return;
    // Only act while the dashboard is being edited, so a config rewrite never happens under
    // someone who is merely looking at their dashboard.
    if (!this.preview) return;

    const section = findSection(this);
    // Two different previews reach this point and neither has anything to convert:
    //  - the card picker, which renders the card with no section around it at all;
    //  - the card config dialog, which builds a real hui-section/hui-grid-section pair to show
    //    the card in context. That one *is* a hui-section, but it carries no `lovelace`.
    // Requiring a usable lovelace is what separates a live dashboard section from either preview.
    if (!section?.lovelace || section.index === undefined || section.viewIndex === undefined) {
      return;
    }

    this._done = true;
    void this._convert(section);
  }

  private async _convert(section: HuiSection): Promise<void> {
    const { lovelace, index, viewIndex } = section;
    if (!lovelace || index === undefined || viewIndex === undefined) return;
    const current = section.config ?? {};
    // Dropping this card into an already-converted section just removes the card again.
    const cards = (current.cards ?? []).filter((card) => card.type !== CONVERT_TYPE);
    const next = { ...current, type: HIGHLIGHT_TYPE, cards };

    try {
      await lovelace.saveConfig(replaceSection(lovelace.config, viewIndex, index, next));
    } catch (err) {
      this._done = false;
      this._error = `Could not update the dashboard: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    // Outside edit mode there is nothing to show; the card removes itself as soon as it is used.
    if (!this.preview) return nothing;

    return html`
      <ha-card>
        <div class="content">
          ${this._error
            ? html`<ha-alert alert-type="error">${this._error}</ha-alert>`
            : html`
                <p>
                  Adding this card turns its section into a highlighting section — your cards and
                  layout stay exactly as they are — and then removes this card. Add rules
                  afterwards with the highlight button on the section.
                </p>
              `}
        </div>
      </ha-card>
    `;
  }

  public static override get styles() {
    return css`
      .content {
        padding: 16px;
      }

      p {
        margin: 0;
        color: var(--secondary-text-color);
      }
    `;
  }
}

/** Stand-in editor: the card has no options, so this only explains what adding it does. */
@customElement('section-highlighter-convert-editor')
export class SectionHighlighterConvertEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  public setConfig(): void {
    // Nothing to configure.
  }

  protected override render(): TemplateResult {
    return html`
      <ha-alert alert-type="info">
        This card has no options. Add it to a section and that section becomes a highlighting
        section — the card then removes itself. Use the highlight button on the section to add
        rules.
      </ha-alert>
    `;
  }
}

declare global {
  interface Window {
    customCards?: unknown[];
  }
  interface HTMLElementTagNameMap {
    'section-highlighter-convert': SectionHighlighterConvert;
    'section-highlighter-convert-editor': SectionHighlighterConvertEditor;
  }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: 'section-highlighter-convert',
  name: 'Section Highlighter setup',
  description: 'Add it to a section to turn that section into a highlighting section.',
  preview: false,
  documentationURL: 'https://github.com/jpettitt/section-highlighter',
});
