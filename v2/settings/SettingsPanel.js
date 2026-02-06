/**
 * Settings Panel
 *
 * Modal dialog for viewing and modifying application settings.
 * Organized by categories with form controls for each setting type.
 *
 * @see ARCHITECTURE_PLAN.md Module 8.4 for full documentation
 */

import { settingsManager } from './SettingsManager.js';
import { shortcutManager, formatKeyCombo } from './ShortcutManager.js';
import { SETTING_CATEGORIES, SETTING_INFO, SHORTCUT_CATEGORIES } from './defaults.js';

/**
 * Settings Panel class.
 */
export class SettingsPanel {
  /**
   * Create a new SettingsPanel instance.
   */
  constructor() {
    /**
     * Modal overlay element.
     * @type {HTMLElement|null}
     * @private
     */
    this._overlay = null;

    /**
     * Modal content element.
     * @type {HTMLElement|null}
     * @private
     */
    this._content = null;

    /**
     * Current active tab.
     * @type {string}
     * @private
     */
    this._activeTab = 'appearance';

    /**
     * Whether panel is visible.
     * @type {boolean}
     * @private
     */
    this._visible = false;

    /**
     * Shortcut being edited.
     * @type {string|null}
     * @private
     */
    this._editingShortcut = null;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the settings panel.
   */
  init() {
    this._createDOM();
    this._setupEventListeners();
    console.log('SettingsPanel initialized');
  }

  /**
   * Create the DOM structure.
   * @private
   */
  _createDOM() {
    // Create overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'settings-panel-overlay';
    this._overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10002;
      backdrop-filter: blur(2px);
    `;

    // Create modal
    this._content = document.createElement('div');
    this._content.className = 'settings-panel-content';
    this._content.style.cssText = `
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      width: 700px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
    `;

    this._overlay.appendChild(this._content);
    document.body.appendChild(this._overlay);
  }

  /**
   * Set up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Close on overlay click
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._visible) {
        if (this._editingShortcut) {
          this._cancelShortcutEdit();
        } else {
          this.hide();
        }
        e.stopPropagation();
      }
    });
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Show the settings panel.
   *
   * @param {string} [tab='appearance'] - Initial tab to show
   */
  show(tab = 'appearance') {
    this._activeTab = tab;
    this._render();
    this._overlay.style.display = 'flex';
    this._visible = true;
  }

  /**
   * Hide the settings panel.
   */
  hide() {
    this._overlay.style.display = 'none';
    this._visible = false;
    this._editingShortcut = null;
  }

  /**
   * Toggle the settings panel.
   */
  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible.
   *
   * @returns {boolean}
   */
  isVisible() {
    return this._visible;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render the panel content.
   * @private
   */
  _render() {
    this._content.innerHTML = `
      <div class="settings-header" style="
        padding: 16px 20px;
        border-bottom: 1px solid #444;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Settings</h2>
        <button class="settings-close-btn" style="
          background: none;
          border: none;
          font-size: 24px;
          color: #888;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        ">&times;</button>
      </div>

      <div class="settings-body" style="
        display: flex;
        flex: 1;
        overflow: hidden;
      ">
        <nav class="settings-tabs" style="
          width: 180px;
          border-right: 1px solid #444;
          padding: 12px 0;
          overflow-y: auto;
        ">
          ${this._renderTabs()}
        </nav>

        <div class="settings-content" style="
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        ">
          ${this._renderContent()}
        </div>
      </div>

      <div class="settings-footer" style="
        padding: 12px 20px;
        border-top: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <button class="settings-reset-btn" style="
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Reset All to Defaults</button>
        <button class="settings-done-btn" style="
          padding: 8px 24px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Done</button>
      </div>
    `;

    // Set up event handlers
    this._setupPanelEvents();
  }

  /**
   * Render tab navigation.
   *
   * @returns {string} HTML string
   * @private
   */
  _renderTabs() {
    const tabs = [
      ...Object.entries(SETTING_CATEGORIES).map(([id, cat]) => ({
        id,
        name: cat.name,
        icon: this._getCategoryIcon(id)
      })),
      { id: 'shortcuts', name: 'Shortcuts', icon: '⌨️' }
    ];

    return tabs.map(tab => `
      <button class="settings-tab ${this._activeTab === tab.id ? 'active' : ''}"
              data-tab="${tab.id}"
              style="
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 10px 16px;
                background: ${this._activeTab === tab.id ? '#3a3a3a' : 'transparent'};
                border: none;
                border-left: 3px solid ${this._activeTab === tab.id ? '#007bff' : 'transparent'};
                color: ${this._activeTab === tab.id ? '#fff' : '#aaa'};
                cursor: pointer;
                font-size: 13px;
                text-align: left;
              ">
        <span style="width: 20px; text-align: center;">${tab.icon}</span>
        <span>${tab.name}</span>
      </button>
    `).join('');
  }

  /**
   * Get icon for a category.
   *
   * @param {string} category - Category ID
   * @returns {string} Icon
   * @private
   */
  _getCategoryIcon(category) {
    const icons = {
      appearance: '🎨',
      behavior: '⚙️',
      editor: '📐',
      parser: '📄',
      advanced: '🔧'
    };
    return icons[category] || '📁';
  }

  /**
   * Render tab content.
   *
   * @returns {string} HTML string
   * @private
   */
  _renderContent() {
    if (this._activeTab === 'shortcuts') {
      return this._renderShortcuts();
    }

    const category = SETTING_CATEGORIES[this._activeTab];
    if (!category) {
      return '<p>Unknown category</p>';
    }

    let html = `
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${category.name}</h3>
      <p style="margin: 0 0 20px 0; color: #888; font-size: 13px;">${category.description}</p>
    `;

    for (const settingKey of category.settings) {
      const info = SETTING_INFO[settingKey];
      if (!info) continue;

      html += this._renderSetting(settingKey, info);
    }

    return html;
  }

  /**
   * Render a single setting control.
   *
   * @param {string} key - Setting key
   * @param {Object} info - Setting info
   * @returns {string} HTML string
   * @private
   */
  _renderSetting(key, info) {
    const value = settingsManager.get(key);
    const isModified = settingsManager.isModified(key);

    let control = '';

    switch (info.type) {
      case 'boolean':
        control = `
          <label class="toggle-switch" style="
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
          ">
            <input type="checkbox"
                   data-setting="${key}"
                   ${value ? 'checked' : ''}
                   style="opacity: 0; width: 0; height: 0;">
            <span class="toggle-slider" style="
              position: absolute;
              cursor: pointer;
              top: 0; left: 0; right: 0; bottom: 0;
              background-color: ${value ? '#007bff' : '#555'};
              transition: 0.2s;
              border-radius: 24px;
            ">
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: ${value ? '23px' : '3px'};
                bottom: 3px;
                background-color: white;
                transition: 0.2s;
                border-radius: 50%;
              "></span>
            </span>
          </label>
        `;
        break;

      case 'select':
        control = `
          <select data-setting="${key}" style="
            padding: 6px 10px;
            background: #3a3a3a;
            border: 1px solid #555;
            border-radius: 4px;
            color: #fff;
            font-size: 13px;
            min-width: 150px;
          ">
            ${info.options.map(opt => `
              <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        `;
        break;

      case 'number':
        control = `
          <input type="number"
                 data-setting="${key}"
                 value="${value}"
                 min="${info.min || 0}"
                 max="${info.max || 999999}"
                 step="${info.step || 1}"
                 style="
                   padding: 6px 10px;
                   background: #3a3a3a;
                   border: 1px solid #555;
                   border-radius: 4px;
                   color: #fff;
                   font-size: 13px;
                   width: 100px;
                 ">
        `;
        break;

      case 'range':
        control = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range"
                   data-setting="${key}"
                   value="${value}"
                   min="${info.min || 0}"
                   max="${info.max || 1}"
                   step="${info.step || 0.1}"
                   style="width: 120px;">
            <span class="range-value" style="color: #888; font-size: 12px; min-width: 30px;">
              ${value}
            </span>
          </div>
        `;
        break;

      default:
        control = `
          <input type="text"
                 data-setting="${key}"
                 value="${value}"
                 style="
                   padding: 6px 10px;
                   background: #3a3a3a;
                   border: 1px solid #555;
                   border-radius: 4px;
                   color: #fff;
                   font-size: 13px;
                   width: 200px;
                 ">
        `;
    }

    return `
      <div class="setting-row" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #333;
      ">
        <div style="flex: 1;">
          <label style="font-size: 13px; color: #fff;">
            ${info.label}
            ${isModified ? '<span style="color: #007bff; margin-left: 4px;">*</span>' : ''}
          </label>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${control}
          ${isModified ? `
            <button class="reset-setting-btn"
                    data-setting="${key}"
                    title="Reset to default"
                    style="
                      background: none;
                      border: none;
                      color: #888;
                      cursor: pointer;
                      font-size: 14px;
                      padding: 4px;
                    ">↺</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render shortcuts tab.
   *
   * @returns {string} HTML string
   * @private
   */
  _renderShortcuts() {
    const grouped = shortcutManager.getByCategory();

    let html = `
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">Keyboard Shortcuts</h3>
      <p style="margin: 0 0 20px 0; color: #888; font-size: 13px;">
        Click on a shortcut to change it. Press Escape to cancel.
      </p>
    `;

    for (const [categoryId, shortcuts] of Object.entries(grouped)) {
      const categoryName = SHORTCUT_CATEGORIES[categoryId] || categoryId;

      html += `
        <div class="shortcut-category" style="margin-bottom: 20px;">
          <h4 style="
            font-size: 12px;
            text-transform: uppercase;
            color: #888;
            margin: 0 0 10px 0;
            letter-spacing: 0.5px;
          ">${categoryName}</h4>
      `;

      for (const shortcut of shortcuts) {
        const isEditing = this._editingShortcut === shortcut.action;
        const isCustomized = shortcutManager.isCustomized(shortcut.action);

        html += `
          <div class="shortcut-row" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #333;
          ">
            <span style="color: #ccc; font-size: 13px;">
              ${shortcut.description}
              ${isCustomized ? '<span style="color: #007bff; margin-left: 4px;">*</span>' : ''}
            </span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="shortcut-binding ${isEditing ? 'editing' : ''}"
                      data-action="${shortcut.action}"
                      style="
                        padding: 6px 12px;
                        background: ${isEditing ? '#007bff' : '#3a3a3a'};
                        border: 1px solid ${isEditing ? '#007bff' : '#555'};
                        border-radius: 4px;
                        color: #fff;
                        font-size: 12px;
                        font-family: monospace;
                        cursor: pointer;
                        min-width: 80px;
                        text-align: center;
                      ">
                ${isEditing ? 'Press key...' : (shortcut.binding ? formatKeyCombo(shortcut.binding) : 'None')}
              </button>
              ${isCustomized ? `
                <button class="reset-shortcut-btn"
                        data-action="${shortcut.action}"
                        title="Reset to default"
                        style="
                          background: none;
                          border: none;
                          color: #888;
                          cursor: pointer;
                          font-size: 14px;
                          padding: 4px;
                        ">↺</button>
              ` : ''}
            </div>
          </div>
        `;
      }

      html += '</div>';
    }

    return html;
  }

  // =========================================================================
  // Event Handling
  // =========================================================================

  /**
   * Set up panel event handlers.
   * @private
   */
  _setupPanelEvents() {
    // Close button
    const closeBtn = this._content.querySelector('.settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Done button
    const doneBtn = this._content.querySelector('.settings-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.hide());
    }

    // Reset all button
    const resetAllBtn = this._content.querySelector('.settings-reset-btn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        if (confirm('Reset all settings to defaults?')) {
          settingsManager.resetAll();
          shortcutManager.resetAllBindings();
          this._render();
        }
      });
    }

    // Tab switching
    const tabs = this._content.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._editingShortcut = null;
        this._render();
      });
    });

    // Setting controls
    this._setupSettingControls();

    // Shortcut controls
    this._setupShortcutControls();
  }

  /**
   * Set up setting control event handlers.
   * @private
   */
  _setupSettingControls() {
    // Checkbox inputs
    const checkboxes = this._content.querySelectorAll('input[type="checkbox"][data-setting]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        settingsManager.set(checkbox.dataset.setting, checkbox.checked);
        this._render();
      });
    });

    // Select inputs
    const selects = this._content.querySelectorAll('select[data-setting]');
    selects.forEach(select => {
      select.addEventListener('change', () => {
        settingsManager.set(select.dataset.setting, select.value);
        this._render();
      });
    });

    // Number inputs
    const numbers = this._content.querySelectorAll('input[type="number"][data-setting]');
    numbers.forEach(input => {
      input.addEventListener('change', () => {
        settingsManager.set(input.dataset.setting, parseFloat(input.value));
        this._render();
      });
    });

    // Range inputs
    const ranges = this._content.querySelectorAll('input[type="range"][data-setting]');
    ranges.forEach(input => {
      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        settingsManager.set(input.dataset.setting, value, false);
        const valueSpan = input.parentElement.querySelector('.range-value');
        if (valueSpan) {
          valueSpan.textContent = value;
        }
      });
      input.addEventListener('change', () => {
        settingsManager.set(input.dataset.setting, parseFloat(input.value));
      });
    });

    // Text inputs
    const texts = this._content.querySelectorAll('input[type="text"][data-setting]');
    texts.forEach(input => {
      input.addEventListener('change', () => {
        settingsManager.set(input.dataset.setting, input.value);
        this._render();
      });
    });

    // Reset buttons
    const resetBtns = this._content.querySelectorAll('.reset-setting-btn');
    resetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        settingsManager.reset(btn.dataset.setting);
        this._render();
      });
    });
  }

  /**
   * Set up shortcut control event handlers.
   * @private
   */
  _setupShortcutControls() {
    // Shortcut binding buttons
    const bindingBtns = this._content.querySelectorAll('.shortcut-binding');
    bindingBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._editingShortcut = btn.dataset.action;
        this._render();

        // Start listening for key press
        this._startShortcutCapture();
      });
    });

    // Reset shortcut buttons
    const resetBtns = this._content.querySelectorAll('.reset-shortcut-btn');
    resetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shortcutManager.resetBinding(btn.dataset.action);
        this._render();
      });
    });
  }

  /**
   * Start capturing a keyboard shortcut.
   * @private
   */
  _startShortcutCapture() {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        this._cancelShortcutEdit();
        document.removeEventListener('keydown', handler, true);
        return;
      }

      // Build key combo string
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');

      // Ignore modifier-only presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      parts.push(e.key);
      const keyCombo = parts.join('+');

      // Check for conflict
      const conflict = shortcutManager.findConflict(keyCombo, this._editingShortcut);
      if (conflict) {
        const info = shortcutManager.getInfo(conflict);
        if (!confirm(`This shortcut is already used by "${info?.description || conflict}". Override?`)) {
          return;
        }
        // Clear the conflicting binding
        shortcutManager.setBinding(conflict, null);
      }

      // Set the new binding
      shortcutManager.setBinding(this._editingShortcut, keyCombo);
      this._editingShortcut = null;
      this._render();

      document.removeEventListener('keydown', handler, true);
    };

    document.addEventListener('keydown', handler, true);
  }

  /**
   * Cancel shortcut editing.
   * @private
   */
  _cancelShortcutEdit() {
    this._editingShortcut = null;
    this._render();
  }
}

/**
 * Singleton settings panel instance.
 * @type {SettingsPanel}
 */
export const settingsPanel = new SettingsPanel();
