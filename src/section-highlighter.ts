import {
  LitElement,
  css,
  html,
  nothing,
  unsafeCSS,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { mdiFormatColorFill } from '@mdi/js';
import { styleMap } from 'lit/directives/style-map.js';
import { CARD_VERSION, SECTION_PAD, SECTION_RADIUS } from './const';
import { extractEntityIds, extractMediaQueries } from './conditions';
import { NO_HIGHLIGHT, matchRule, resolveHighlight, type ResolvedHighlight } from './highlight';
import type { HighlightEditorParams } from './editor-dialog';
import type { HomeAssistant, SectionHighlighterConfig } from './types';
import './convert-card';

const GRID_TAG = 'hui-grid-section';
const DEFAULT_TRANSITION_MS = 300;

type GridSection = HTMLElement & {
  setConfig: (config: unknown) => void;
  [key: string]: unknown;
};

/**
 * A drop-in superset of HA's `grid` section that paints a state-driven highlight around it.
 *
 * Layout is delegated to a real `hui-grid-section`, which keeps drag-and-drop, the add-card
 * button, column spans and edit affordances as HA's code rather than a reimplementation. We
 * receive everything needed for that from `hui-section`, which sets these properties on its
 * layout element and listens for the `ll-*` events the grid fires (they bubble through us).
 */
@customElement('section-highlighter')
export class SectionHighlighter extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public lovelace?: unknown;

  @property({ type: Number }) public index?: number;

  @property({ attribute: false }) public viewIndex?: number;

  @property({ attribute: false }) public isStrategy = false;

  @property({ attribute: false }) public cards: HTMLElement[] = [];

  @property({ attribute: 'import-only', type: Boolean }) public importOnly = false;

  @property({ attribute: false }) public narrow = false;

  @property({ type: Boolean }) public preview = false;

  @state() private _config?: SectionHighlighterConfig;

  @state() private _highlight: ResolvedHighlight = NO_HIGHLIGHT;

  @state() private _editorParams?: HighlightEditorParams;

  private _grid?: GridSection;

  private _trackedEntities: string[] = [];

  private _mediaQueries: MediaQueryList[] = [];

  private _onMediaChange = (): void => this._evaluate();

  public setConfig(config: SectionHighlighterConfig): void {
    if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
    if (config.rules !== undefined && !Array.isArray(config.rules)) {
      throw new Error('"rules" must be a list');
    }

    this._config = config;
    this._trackedEntities = (config.rules ?? []).flatMap((rule) =>
      extractEntityIds(rule.conditions),
    );
    this.toggleAttribute('native-background', config.background !== undefined);
    this._watchMediaQueries();
    this._ensureGrid();
    this._evaluate();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unwatchMediaQueries();
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._watchMediaQueries();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('hass')) {
      const previous = changed.get('hass') as HomeAssistant | undefined;
      if (!previous || this._trackedStatesChanged(previous)) this._evaluate();
    }
    this._forwardToGrid();
  }

  private _trackedStatesChanged(previous: HomeAssistant): boolean {
    if (previous.user !== this.hass?.user) return true;
    return this._trackedEntities.some(
      (entityId) => previous.states[entityId] !== this.hass?.states[entityId],
    );
  }

  private _evaluate(): void {
    const next = resolveHighlight(matchRule(this._config?.rules, this.hass));
    const current = this._highlight;
    if (
      next.backgroundColor !== current.backgroundColor ||
      next.backgroundOpacity !== current.backgroundOpacity ||
      next.boxShadow !== current.boxShadow
    ) {
      this._highlight = next;
    }
  }

  private _watchMediaQueries(): void {
    this._unwatchMediaQueries();
    if (typeof window.matchMedia !== 'function') return;
    const queries = (this._config?.rules ?? []).flatMap((rule) =>
      extractMediaQueries(rule.conditions),
    );
    // A `screen` condition changes with the viewport, not with hass, so it needs its own signal.
    this._mediaQueries = queries.map((query) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', this._onMediaChange);
      return list;
    });
  }

  private _unwatchMediaQueries(): void {
    this._mediaQueries.forEach((list) => list.removeEventListener('change', this._onMediaChange));
    this._mediaQueries = [];
  }

  private _ensureGrid(): void {
    if (this._grid) {
      this._applyGridConfig();
      return;
    }

    this._grid = document.createElement(GRID_TAG) as GridSection;

    if (!customElements.get(GRID_TAG)) {
      // Mirrors HA's own lazy-element dance: setting properties on an un-upgraded element would
      // shadow the class accessors, so wait for the definition and upgrade before touching it.
      customElements.whenDefined(GRID_TAG).then(() => {
        if (!this._grid) return;
        customElements.upgrade(this._grid);
        this._applyGridConfig();
        this._forwardToGrid();
      });
      return;
    }

    this._applyGridConfig();
  }

  private _applyGridConfig(): void {
    if (!this._grid || !this._config || typeof this._grid.setConfig !== 'function') return;
    const { rules: _rules, transition: _transition, ...gridConfig } = this._config;
    this._grid.setConfig({ ...gridConfig, type: 'grid' });
  }

  private _forwardToGrid(): void {
    const grid = this._grid;
    if (!grid || !customElements.get(GRID_TAG)) return;
    grid.hass = this.hass;
    grid.lovelace = this.lovelace;
    grid.index = this.index;
    grid.viewIndex = this.viewIndex;
    grid.isStrategy = this.isStrategy;
    grid.cards = this.cards;
    grid.importOnly = this.importOnly;
    grid.narrow = this.narrow;
    grid.preview = this.preview;
  }

  protected override render(): TemplateResult {
    const { transition } = this._config ?? {};
    const duration = transition === false ? '0ms' : `${transition ?? DEFAULT_TRANSITION_MS}ms`;

    return html`
      <div
        class="root"
        style=${styleMap({
          'box-shadow': this._highlight.boxShadow,
          '--sh-transition': duration,
        })}
      >
        <div
          class="tint"
          style=${styleMap({
            'background-color': this._highlight.backgroundColor,
            opacity: String(this._highlight.backgroundOpacity),
          })}
        ></div>
        ${this.preview ? this._renderEditButton() : nothing}
        ${this._grid ?? nothing}
      </div>
      ${this._editorParams
        ? html`
            <section-highlighter-dialog
              .params=${this._editorParams}
              @dialog-closed=${this._editorClosed}
            ></section-highlighter-dialog>
          `
        : nothing}
    `;
  }

  private _renderEditButton(): TemplateResult {
    return html`
      <ha-icon-button
        class="edit"
        .path=${mdiFormatColorFill}
        label="Configure highlighting"
        @click=${this._openEditor}
      ></ha-icon-button>
    `;
  }

  private async _openEditor(event: Event): Promise<void> {
    event.stopPropagation();
    // Imported on demand so the editor only loads for someone actually editing a dashboard.
    await import('./editor-dialog');
    this._editorParams = {
      config: this._config!,
      hass: this.hass!,
      lovelace: this.lovelace,
      viewIndex: this.viewIndex!,
      sectionIndex: this.index!,
    };
  }

  private _editorClosed = (): void => {
    this._editorParams = undefined;
  };

  public static override get styles() {
    return css`
      :host {
        display: block;
        position: relative;
      }

      .root {
        position: relative;
        border-radius: ${unsafeCSS(SECTION_RADIUS)};
        /* Padding is unconditional so that a rule switching on never reflows the cards. */
        padding: ${unsafeCSS(SECTION_PAD)};
        transition: box-shadow var(--sh-transition, 300ms) ease;
      }

      /*
       * When the section also has a native static background, hui-sections-view has already
       * padded the container by one space unit. Bleed out over that padding so the highlight
       * traces the same rounded box the native background paints, without moving the cards.
       */
      :host([native-background]) .root {
        margin: calc(-1 * ${unsafeCSS(SECTION_PAD)});
      }

      .tint {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        transition:
          opacity var(--sh-transition, 300ms) ease,
          background-color var(--sh-transition, 300ms) ease;
      }

      @media (prefers-reduced-motion: reduce) {
        .root,
        .tint {
          transition: none;
        }
      }

      .edit {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 2;
        border-radius: 50%;
        color: var(--secondary-text-color);
        background: var(--card-background-color);
        box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0, 0, 0, 0.2));
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'section-highlighter': SectionHighlighter;
  }
}

console.info(
  `%c SECTION-HIGHLIGHTER %c ${CARD_VERSION} `,
  'color: white; background: #03a9f4; font-weight: 700;',
  'color: #03a9f4; background: white; font-weight: 700;',
);
