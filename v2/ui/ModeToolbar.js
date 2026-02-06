/**
 * Mode Toolbar
 *
 * Renders mode-specific controls from the current mode.
 * Integrates with ModeManager to update when mode changes.
 *
 * @see ARCHITECTURE_PLAN.md Module 5.7 for full documentation
 */

import { modeManager } from '../modes/index.js';

/**
 * Mode Toolbar class.
 * Dynamically renders controls based on active mode.
 */
export class ModeToolbar {
  /**
   * Create a new ModeToolbar instance.
   *
   * @param {Object} [config]
   * @param {HTMLElement} [config.container] - Container element
   * @param {Function} [config.onRender] - Callback after render
   */
  constructor(config = {}) {
    /**
     * Container element.
     * @type {HTMLElement|null}
     * @private
     */
    this._container = config.container || null;

    /**
     * Toolbar element.
     * @type {HTMLElement|null}
     * @private
     */
    this._toolbar = null;

    /**
     * Render callback.
     * @type {Function|null}
     * @private
     */
    this._onRender = config.onRender || null;

    /**
     * Unsubscribe function for mode change listener.
     * @type {Function|null}
     * @private
     */
    this._unsubscribe = null;
  }

  /**
   * Initialize the toolbar.
   *
   * @param {HTMLElement} [container] - Container element
   */
  init(container) {
    if (container) {
      this._container = container;
    }

    if (!this._container) {
      console.warn('ModeToolbar: No container provided');
      return;
    }

    // Create toolbar element
    this._createToolbar();

    // Subscribe to mode changes
    this._unsubscribe = modeManager.on('afterChange', () => {
      this.render();
    });

    // Initial render
    this.render();

    console.log('ModeToolbar: Initialized');
  }

  /**
   * Create the toolbar DOM element.
   * @private
   */
  _createToolbar() {
    this._toolbar = document.createElement('div');
    this._toolbar.className = 'mode-toolbar';
    this._toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: rgba(42, 42, 42, 0.9);
      border-radius: 4px;
      font-size: 13px;
    `;
    this._container.appendChild(this._toolbar);
  }

  /**
   * Render toolbar with current mode's controls.
   */
  render() {
    if (!this._toolbar) return;

    // Clear current controls
    this._toolbar.innerHTML = '';

    // Get controls from current mode
    const controls = modeManager.getControls();

    if (controls.length === 0) {
      this._toolbar.style.display = 'none';
      return;
    }

    this._toolbar.style.display = 'flex';

    // Render each control
    controls.forEach(control => {
      const element = this._renderControl(control);
      if (element) {
        this._toolbar.appendChild(element);
      }
    });

    // Notify render callback
    if (this._onRender) {
      this._onRender();
    }
  }

  /**
   * Render a single control.
   *
   * @param {Object} control - Control definition
   * @returns {HTMLElement|null}
   * @private
   */
  _renderControl(control) {
    switch (control.type) {
      case 'button':
        return this._renderButton(control);
      case 'toggle':
        return this._renderToggle(control);
      case 'select':
        return this._renderSelect(control);
      case 'separator':
        return this._renderSeparator();
      default:
        console.warn(`ModeToolbar: Unknown control type "${control.type}"`);
        return null;
    }
  }

  /**
   * Render a button control.
   *
   * @param {Object} control - Control definition
   * @returns {HTMLElement}
   * @private
   */
  _renderButton(control) {
    const button = document.createElement('button');
    button.className = 'mode-toolbar-btn';
    button.title = control.label;
    button.disabled = control.disabled || false;
    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: ${control.disabled ? '#333' : '#3a3a3a'};
      border: 1px solid #555;
      border-radius: 3px;
      color: ${control.disabled ? '#666' : '#e0e0e0'};
      font-size: 12px;
      cursor: ${control.disabled ? 'not-allowed' : 'pointer'};
      transition: background 0.15s;
    `;

    if (control.icon) {
      const icon = document.createElement('span');
      icon.textContent = control.icon;
      button.appendChild(icon);
    }

    const label = document.createElement('span');
    label.textContent = control.label;
    button.appendChild(label);

    // Hover effect
    if (!control.disabled) {
      button.addEventListener('mouseenter', () => {
        button.style.background = '#4a4a4a';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = '#3a3a3a';
      });
    }

    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      if (!control.disabled && control.action) {
        control.action();
      }
    });

    return button;
  }

  /**
   * Render a toggle control (button group).
   *
   * @param {Object} control - Control definition
   * @returns {HTMLElement}
   * @private
   */
  _renderToggle(control) {
    const group = document.createElement('div');
    group.className = 'mode-toolbar-toggle';
    group.style.cssText = `
      display: flex;
      border: 1px solid #555;
      border-radius: 3px;
      overflow: hidden;
    `;

    control.options.forEach((option, idx) => {
      const btn = document.createElement('button');
      btn.className = 'toggle-option';
      btn.title = option.title || option.label;

      const isActive = option.value === control.value;
      btn.style.cssText = `
        padding: 4px 8px;
        background: ${isActive ? '#4a90d9' : '#3a3a3a'};
        border: none;
        border-left: ${idx > 0 ? '1px solid #555' : 'none'};
        color: ${isActive ? '#fff' : '#e0e0e0'};
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;
      `;

      btn.textContent = option.label;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (control.action) {
          control.action(option.value);
        }
        // Re-render to update active state
        this.render();
      });

      group.appendChild(btn);
    });

    return group;
  }

  /**
   * Render a select control.
   *
   * @param {Object} control - Control definition
   * @returns {HTMLElement}
   * @private
   */
  _renderSelect(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mode-toolbar-select';
    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
    `;

    if (control.label) {
      const label = document.createElement('label');
      label.textContent = control.label;
      label.style.cssText = 'font-size: 12px; color: #aaa;';
      wrapper.appendChild(label);
    }

    const select = document.createElement('select');
    select.style.cssText = `
      padding: 4px 8px;
      background: #3a3a3a;
      border: 1px solid #555;
      border-radius: 3px;
      color: #e0e0e0;
      font-size: 12px;
      cursor: pointer;
    `;

    control.options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      opt.selected = option.value === control.value;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      if (control.action) {
        control.action(e.target.value);
      }
    });

    wrapper.appendChild(select);
    return wrapper;
  }

  /**
   * Render a separator.
   *
   * @returns {HTMLElement}
   * @private
   */
  _renderSeparator() {
    const sep = document.createElement('div');
    sep.className = 'mode-toolbar-separator';
    sep.style.cssText = `
      width: 1px;
      height: 20px;
      background: #555;
      margin: 0 4px;
    `;
    return sep;
  }

  /**
   * Update a specific control's state.
   *
   * @param {string} controlId - Control ID
   * @param {Object} updates - State updates
   */
  updateControl(controlId, updates) {
    // Just re-render for simplicity
    this.render();
  }

  /**
   * Show the toolbar.
   */
  show() {
    if (this._toolbar) {
      this._toolbar.style.display = 'flex';
    }
  }

  /**
   * Hide the toolbar.
   */
  hide() {
    if (this._toolbar) {
      this._toolbar.style.display = 'none';
    }
  }

  /**
   * Check if toolbar is visible.
   *
   * @returns {boolean}
   */
  isVisible() {
    return this._toolbar?.style.display !== 'none';
  }

  /**
   * Destroy the toolbar.
   */
  destroy() {
    // Unsubscribe from mode changes
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    // Remove toolbar from DOM
    if (this._toolbar && this._toolbar.parentNode) {
      this._toolbar.parentNode.removeChild(this._toolbar);
    }
    this._toolbar = null;

    console.log('ModeToolbar: Destroyed');
  }
}

/**
 * Singleton ModeToolbar instance.
 * @type {ModeToolbar}
 */
export const modeToolbar = new ModeToolbar();
