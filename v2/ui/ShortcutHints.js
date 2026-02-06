/**
 * Shortcut Hints
 *
 * Displays a modal with all available keyboard shortcuts.
 * Shows proper keyboard key styling and categorization.
 *
 * @see ARCHITECTURE_PLAN.md Module 6.5 for full documentation
 */

/**
 * Shortcut category definitions.
 * @type {Object.<string, string>}
 */
const CATEGORIES = {
  'navigation': 'Navigation',
  'editing': 'Editing',
  'selection': 'Selection',
  'view': 'View',
  'file': 'File',
  'help': 'Help'
};

/**
 * Map shortcuts to categories.
 * @type {Object.<string, string>}
 */
const SHORTCUT_CATEGORIES = {
  'n': 'editing',
  'delete': 'editing',
  'ctrl+d': 'editing',
  'escape': 'selection',
  'ctrl+a': 'selection',
  'ctrl+s': 'file',
  'ctrl+z': 'editing',
  'ctrl+y': 'editing',
  'ctrl+shift+z': 'editing',
  'i': 'view',
  'ctrl+=': 'view',
  'ctrl+-': 'view',
  'ctrl+0': 'view',
  'c': 'navigation',
  '?': 'help'
};

/**
 * Shortcut Hints class.
 */
export class ShortcutHints {
  /**
   * Create a new ShortcutHints instance.
   */
  constructor() {
    /**
     * Modal element.
     * @type {HTMLElement|null}
     * @private
     */
    this._modal = null;

    /**
     * Reference to KeyboardShortcuts instance.
     * @type {Object|null}
     * @private
     */
    this._keyboardShortcuts = null;

    /**
     * Whether modal is visible.
     * @type {boolean}
     * @private
     */
    this._visible = false;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the shortcut hints modal.
   *
   * @param {Object} keyboardShortcuts - KeyboardShortcuts instance
   */
  init(keyboardShortcuts) {
    this._keyboardShortcuts = keyboardShortcuts;
    this._createModal();
  }

  /**
   * Create the modal DOM element.
   * @private
   */
  _createModal() {
    // Create overlay
    this._modal = document.createElement('div');
    this._modal.className = 'shortcut-hints-overlay';
    this._modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      backdrop-filter: blur(2px);
    `;

    // Create modal content
    const content = document.createElement('div');
    content.className = 'shortcut-hints-content';
    content.style.cssText = `
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'shortcut-hints-header';
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #444;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      color: #888;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#fff');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#888');

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'shortcut-hints-body';
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
    `;

    this._body = body;

    content.appendChild(header);
    content.appendChild(body);
    this._modal.appendChild(content);

    // Close on overlay click
    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._visible) {
        this.hide();
        e.stopPropagation();
      }
    });

    document.body.appendChild(this._modal);
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Show the shortcut hints modal.
   */
  show() {
    this._renderShortcuts();
    this._modal.style.display = 'flex';
    this._visible = true;
  }

  /**
   * Hide the shortcut hints modal.
   */
  hide() {
    this._modal.style.display = 'none';
    this._visible = false;
  }

  /**
   * Toggle the modal visibility.
   */
  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if modal is visible.
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
   * Render shortcuts grouped by category.
   * @private
   */
  _renderShortcuts() {
    if (!this._keyboardShortcuts) {
      this._body.innerHTML = '<p>No keyboard shortcuts registered.</p>';
      return;
    }

    const shortcuts = Array.from(this._keyboardShortcuts.shortcuts.values());
    const grouped = this._groupByCategory(shortcuts);

    let html = '';

    // Render each category
    for (const [categoryId, categoryShortcuts] of Object.entries(grouped)) {
      const categoryName = CATEGORIES[categoryId] || 'Other';

      html += `
        <div class="shortcut-category" style="margin-bottom: 20px;">
          <h3 style="
            font-size: 12px;
            text-transform: uppercase;
            color: #888;
            margin: 0 0 10px 0;
            letter-spacing: 0.5px;
          ">${categoryName}</h3>
          <div class="shortcut-list">
      `;

      for (const shortcut of categoryShortcuts) {
        const keyHtml = this._formatKey(shortcut.key);

        html += `
          <div class="shortcut-item" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #333;
          ">
            <span class="shortcut-description" style="color: #ccc;">${shortcut.description}</span>
            <span class="shortcut-keys">${keyHtml}</span>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    // Add footer with hint
    html += `
      <div class="shortcut-footer" style="
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #444;
        text-align: center;
        color: #666;
        font-size: 12px;
      ">
        Press <kbd style="
          display: inline-block;
          padding: 2px 6px;
          background: #444;
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
          color: #fff;
        ">?</kbd> to toggle this panel
      </div>
    `;

    this._body.innerHTML = html;
  }

  /**
   * Group shortcuts by category.
   *
   * @param {Array} shortcuts - Array of shortcut objects
   * @returns {Object} Shortcuts grouped by category
   * @private
   */
  _groupByCategory(shortcuts) {
    const grouped = {};

    // Initialize categories
    for (const categoryId of Object.keys(CATEGORIES)) {
      grouped[categoryId] = [];
    }
    grouped['other'] = [];

    // Assign shortcuts to categories
    for (const shortcut of shortcuts) {
      const key = shortcut.key.toLowerCase();
      const category = SHORTCUT_CATEGORIES[key] || 'other';

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(shortcut);
    }

    // Remove empty categories
    for (const key of Object.keys(grouped)) {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    }

    return grouped;
  }

  /**
   * Format a key combination as HTML with styled keys.
   *
   * @param {string} key - Key combination (e.g., 'ctrl+s')
   * @returns {string} HTML string
   * @private
   */
  _formatKey(key) {
    const keyStyle = `
      display: inline-block;
      padding: 4px 8px;
      background: linear-gradient(180deg, #555 0%, #444 100%);
      border: 1px solid #333;
      border-radius: 4px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
      min-width: 24px;
      text-align: center;
      box-shadow: 0 2px 0 #222, 0 3px 4px rgba(0, 0, 0, 0.3);
      margin-left: 4px;
    `;

    const parts = key.toLowerCase().split('+');
    const formattedParts = parts.map(part => {
      // Convert modifier keys to symbols
      switch (part) {
        case 'ctrl':
          return this._isMac() ? '⌘' : 'Ctrl';
        case 'shift':
          return this._isMac() ? '⇧' : 'Shift';
        case 'alt':
          return this._isMac() ? '⌥' : 'Alt';
        case 'delete':
          return this._isMac() ? '⌫' : 'Del';
        case 'escape':
          return 'Esc';
        case '=':
          return '+';
        case '-':
          return '-';
        case '0':
          return '0';
        default:
          return part.toUpperCase();
      }
    });

    return formattedParts
      .map(part => `<kbd style="${keyStyle}">${part}</kbd>`)
      .join('');
  }

  /**
   * Check if running on macOS.
   *
   * @returns {boolean}
   * @private
   */
  _isMac() {
    return navigator.platform.toLowerCase().includes('mac');
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Destroy the modal.
   */
  destroy() {
    if (this._modal && this._modal.parentNode) {
      this._modal.parentNode.removeChild(this._modal);
    }
    this._modal = null;
    this._visible = false;
  }
}

/**
 * Singleton shortcut hints instance.
 * @type {ShortcutHints}
 */
export const shortcutHints = new ShortcutHints();
