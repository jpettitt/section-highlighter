import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { mdiChevronDown, mdiChevronUp, mdiDelete } from '@mdi/js';
import type { HighlightRule, HomeAssistant, SectionHighlighterConfig } from './types';

const CONDITIONS_EDITOR = 'ha-card-conditions-editor';
const PRELOAD_TIMEOUT_MS = 2000;

export interface HighlightEditorParams {
  config: SectionHighlighterConfig;
  hass: HomeAssistant;
  lovelace: any;
  viewIndex: number;
  sectionIndex: number;
}

/**
 * ha-card-conditions-editor ships inside a lazily-loaded editor chunk. Asking the built-in
 * conditional card for its config element pulls that chunk in, which is the same trick HA's
 * own editors rely on. If it does not arrive we fall back to editing conditions as YAML text
 * rather than leaving the user with nothing.
 */
async function preloadConditionsEditor(): Promise<boolean> {
  if (customElements.get(CONDITIONS_EDITOR)) return true;
  try {
    await Promise.race([
      (async () => {
        await customElements.whenDefined('hui-conditional-card');
        const ctor = customElements.get('hui-conditional-card') as any;
        if (ctor?.getConfigElement) await ctor.getConfigElement();
      })(),
      new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
    ]);
  } catch {
    // Fall through to the YAML fallback below.
  }
  return !!customElements.get(CONDITIONS_EDITOR);
}

@customElement('section-highlighter-dialog')
export class SectionHighlighterDialog extends LitElement {
  @state() private _params?: HighlightEditorParams;

  @state() private _rules: HighlightRule[] = [];

  @state() private _hasConditionsEditor = false;

  @state() private _error?: string;

  @state() private _open = false;

  @state() private _confirmRemove = false;

  /**
   * Set by the section that owns this dialog. Declared as a property rather than an imperative
   * showDialog() so the element can be rendered from the section's own template — see
   * showHighlightEditor below for why that placement matters.
   */
  @property({ attribute: false })
  public set params(params: HighlightEditorParams | undefined) {
    if (!params) return;
    void this._open_(params);
  }

  private async _open_(params: HighlightEditorParams): Promise<void> {
    this._params = params;
    this._rules = structuredClone(params.config.rules ?? []);
    this._error = undefined;
    this._confirmRemove = false;
    this._open = true;
    this._hasConditionsEditor = await preloadConditionsEditor();
  }

  /** Requests the close; ha-dialog animates out and then fires `closed`. */
  private _close = (): void => {
    this._open = false;
  };

  private _dialogClosed = (): void => {
    this._params = undefined;
    // The owning section listens for this and drops the dialog from its template.
    this.dispatchEvent(
      new CustomEvent('dialog-closed', {
        detail: { dialog: this.localName },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _addRule(): void {
    this._confirmRemove = false;
    this._rules = [...this._rules, { conditions: [], background: { color: 'red', opacity: 20 } }];
  }

  /**
   * Turns the section back into a plain `grid`. Two clicks: the first arms it and explains what
   * will be lost, the second commits. Rules are dropped, everything HA owns is preserved.
   */
  private async _removeHighlighting(): Promise<void> {
    if (!this._confirmRemove) {
      this._confirmRemove = true;
      return;
    }
    if (!this._params) return;

    const { lovelace, viewIndex, sectionIndex, config } = this._params;
    const { rules: _rules, transition: _transition, ...rest } = config;
    const next = { ...rest, type: 'grid' };

    try {
      await lovelace.saveConfig(replaceSection(lovelace.config, viewIndex, sectionIndex, next));
      this._close();
    } catch (err) {
      this._confirmRemove = false;
      this._error = `Could not save: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private _deleteRule(index: number): void {
    this._rules = this._rules.filter((_, i) => i !== index);
  }

  private _moveRule(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this._rules.length) return;
    const rules = [...this._rules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    this._rules = rules;
  }

  private _conditionsChanged(index: number, event: CustomEvent): void {
    event.stopPropagation();
    const rules = [...this._rules];
    rules[index] = { ...rules[index], conditions: event.detail.value ?? event.detail.conditions };
    this._rules = rules;
  }

  private _yamlConditionsChanged(index: number, event: Event): void {
    const text = (event.target as HTMLTextAreaElement & { value: string }).value;
    try {
      const parsed = JSON.parse(text);
      const rules = [...this._rules];
      rules[index] = { ...rules[index], conditions: parsed };
      this._rules = rules;
      this._error = undefined;
    } catch {
      this._error = 'Conditions must be valid JSON while the visual editor is unavailable.';
    }
  }

  private _styleChanged(index: number, event: CustomEvent): void {
    event.stopPropagation();
    const value = event.detail.value;
    const rules = [...this._rules];
    const rule: HighlightRule = { conditions: rules[index].conditions };

    if (value.background_enabled) {
      rule.background = { color: value.background_color, opacity: value.background_opacity };
    }
    if (value.border_enabled) {
      rule.border = { color: value.border_color, width: value.border_width };
    }
    if (value.glow_enabled) {
      rule.glow = { color: value.glow_color, size: value.glow_size };
    }

    rules[index] = rule;
    this._rules = rules;
  }

  private _styleData(rule: HighlightRule): Record<string, unknown> {
    const background = typeof rule.background === 'object' ? rule.background : undefined;
    const border = typeof rule.border === 'object' ? rule.border : undefined;
    const glow = typeof rule.glow === 'object' ? rule.glow : undefined;
    return {
      background_enabled: rule.background !== undefined && rule.background !== false,
      background_color: background?.color,
      background_opacity: background?.opacity ?? 20,
      border_enabled: rule.border !== undefined && rule.border !== false,
      border_color: border?.color,
      border_width: border?.width ?? 2,
      glow_enabled: rule.glow !== undefined && rule.glow !== false,
      glow_color: glow?.color,
      glow_size: glow?.size ?? 12,
    };
  }

  private get _schema() {
    return [
      { name: 'background_enabled', selector: { boolean: {} } },
      {
        name: 'background',
        type: 'expandable',
        flatten: true,
        expanded: true,
        visible: { field: 'background_enabled', value: true },
        schema: [
          { name: 'background_color', selector: { ui_color: {} } },
          {
            name: 'background_opacity',
            selector: {
              number: { min: 0, max: 100, step: 1, unit_of_measurement: '%', mode: 'slider' },
            },
          },
        ],
      },
      { name: 'border_enabled', selector: { boolean: {} } },
      {
        name: 'border',
        type: 'expandable',
        flatten: true,
        expanded: true,
        visible: { field: 'border_enabled', value: true },
        schema: [
          { name: 'border_color', selector: { ui_color: {} } },
          {
            name: 'border_width',
            selector: { number: { min: 1, max: 12, step: 1, unit_of_measurement: 'px' } },
          },
        ],
      },
      { name: 'glow_enabled', selector: { boolean: {} } },
      {
        name: 'glow',
        type: 'expandable',
        flatten: true,
        expanded: true,
        visible: { field: 'glow_enabled', value: true },
        schema: [
          { name: 'glow_color', selector: { ui_color: {} } },
          {
            name: 'glow_size',
            selector: { number: { min: 1, max: 48, step: 1, unit_of_measurement: 'px' } },
          },
        ],
      },
    ];
  }

  private _computeLabel = (schema: { name: string }): string => {
    const labels: Record<string, string> = {
      background_enabled: 'Background',
      background_color: 'Background color',
      background_opacity: 'Background opacity',
      border_enabled: 'Border',
      border_color: 'Border color',
      border_width: 'Border width',
      glow_enabled: 'Glow',
      glow_color: 'Glow color',
      glow_size: 'Glow size',
    };
    return labels[schema.name] ?? schema.name;
  };

  private async _save(): Promise<void> {
    if (!this._params) return;
    const { lovelace, viewIndex, sectionIndex, config } = this._params;

    const next: SectionHighlighterConfig = { ...config };
    if (this._rules.length > 0) {
      next.rules = this._rules;
    } else {
      delete next.rules;
    }

    try {
      await lovelace.saveConfig(replaceSection(lovelace.config, viewIndex, sectionIndex, next));
      this._close();
      return;
    } catch (err) {
      this._error = `Could not save: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._params) return nothing;

    return html`
      <ha-dialog
        .open=${this._open}
        header-title="Section highlighting"
        @closed=${this._dialogClosed}
      >
        <div class="content">
          ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : nothing}
          ${this._confirmRemove
            ? html`
                <ha-alert alert-type="warning">
                  Turn this back into a normal grid section? Its cards and layout are kept,
                  ${this._rules.length === 1
                    ? html`but its rule is deleted.`
                    : html`but its ${this._rules.length} rules are deleted.`}
                </ha-alert>
              `
            : nothing}
          ${this._rules.length === 0
            ? html`<p class="empty">
                No rules yet. The section keeps its normal appearance until a rule matches.
              </p>`
            : nothing}
          ${this._rules.map((rule, index) => this._renderRule(rule, index))}
          <ha-button appearance="plain" variant="brand" @click=${this._addRule}>
            Add rule
          </ha-button>
        </div>
        <ha-dialog-footer slot="footer">
          <ha-button
            slot="secondaryAction"
            class="remove"
            appearance="plain"
            variant="danger"
            @click=${this._removeHighlighting}
          >
            ${this._confirmRemove ? 'Confirm removal' : 'Remove highlighting'}
          </ha-button>
          <ha-button slot="secondaryAction" appearance="plain" @click=${this._close}>
            Cancel
          </ha-button>
          <ha-button slot="primaryAction" appearance="accent" variant="brand" @click=${this._save}>
            Save
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  private _renderRule(rule: HighlightRule, index: number): TemplateResult {
    return html`
      <div class="rule">
        <div class="rule-header">
          <span class="rule-title">Rule ${index + 1}</span>
          <ha-icon-button
            .path=${mdiChevronUp}
            .disabled=${index === 0}
            @click=${() => this._moveRule(index, -1)}
            label="Move up"
          ></ha-icon-button>
          <ha-icon-button
            .path=${mdiChevronDown}
            .disabled=${index === this._rules.length - 1}
            @click=${() => this._moveRule(index, 1)}
            label="Move down"
          ></ha-icon-button>
          <ha-icon-button
            .path=${mdiDelete}
            @click=${() => this._deleteRule(index)}
            label="Delete rule"
          ></ha-icon-button>
        </div>

        <p class="section-label">When</p>
        ${this._hasConditionsEditor
          ? html`
              <ha-card-conditions-editor
                .hass=${this._params!.hass}
                .conditions=${rule.conditions ?? []}
                @value-changed=${(ev: CustomEvent) => this._conditionsChanged(index, ev)}
              ></ha-card-conditions-editor>
            `
          : html`
              <ha-textarea
                class="yaml"
                rows="4"
                .value=${JSON.stringify(rule.conditions ?? [], null, 2)}
                @change=${(ev: Event) => this._yamlConditionsChanged(index, ev)}
              ></ha-textarea>
            `}

        <p class="section-label">Then</p>
        <ha-form
          .hass=${this._params!.hass}
          .data=${this._styleData(rule)}
          .schema=${this._schema}
          .computeLabel=${this._computeLabel}
          @value-changed=${(ev: CustomEvent) => this._styleChanged(index, ev)}
        ></ha-form>
      </div>
    `;
  }

  public static override get styles() {
    return css`
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: min(560px, 90vw);
      }

      .rule {
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: var(--ha-border-radius-lg, 12px);
      }

      .rule-header {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .rule-title {
        flex: 1;
        font-weight: 500;
      }

      .section-label {
        margin: 12px 0 4px;
        color: var(--secondary-text-color);
        font-size: 0.9em;
        text-transform: uppercase;
      }

      .empty {
        color: var(--secondary-text-color);
      }

      /* Keep the destructive action away from Cancel/Save. */
      .remove {
        margin-inline-end: auto;
      }

      .yaml {
        width: 100%;
        font-family: var(--ha-font-family-code, monospace);
      }
    `;
  }
}

/** Replaces one section in a dashboard config without mutating the original. */
export function replaceSection(
  config: any,
  viewIndex: number,
  sectionIndex: number,
  section: unknown,
): any {
  const views = [...config.views];
  const view = { ...views[viewIndex] };
  const sections = [...(view.sections ?? [])];
  sections[sectionIndex] = section;
  view.sections = sections;
  views[viewIndex] = view;
  return { ...config, views };
}

/**
 * Why the dialog is rendered inside the section's own shadow root rather than appended to
 * `document.body` or handed to HA's dialog manager:
 *
 * Current HA elements such as `ha-entity-picker` take no `hass` property at all — they read it
 * from a Lit context provided high in the app tree. A context consumer only resolves if it is a
 * DOM descendant of the provider, so a dialog in `document.body` upgrades but renders nothing,
 * and the condition editor comes up missing its whole "Entity" row. HA's own dialogs avoid this
 * because the dialog manager mounts them inside `home-assistant`'s shadow root; it mounts
 * unrecognised tags to `document.body` instead, so routing through it does not help us.
 *
 * Rendering the dialog from the section's template keeps it inside the tree, and `ha-dialog`
 * uses the top layer, so its position in the DOM does not affect how it displays.
 *
 * Verified against frontend 20260826.1: HA's picker renders at 86px inside the tree and 0px in
 * `document.body`.
 */

declare global {
  interface HTMLElementTagNameMap {
    'section-highlighter-dialog': SectionHighlighterDialog;
  }
}
