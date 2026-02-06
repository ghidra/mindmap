/**
 * Context Menu
 *
 * General-purpose context menu component.
 * Supports nested submenus, icons, shortcuts, and disabled items.
 *
 * @see ARCHITECTURE_PLAN.md Module 6.2 for full documentation
 */

/**
 * @typedef {Object} MenuAction
 * @property {string} id - Action identifier
 * @property {string} label - Display label
 * @property {string} [icon] - Optional icon (emoji or class)
 * @property {string} [shortcut] - Keyboard shortcut hint
 * @property {boolean} [disabled] - Whether action is disabled
 * @property {boolean} [checked] - Show checkmark (for toggle items)
 * @property {boolean} [separator] - Show separator after this item
 * @property {MenuAction[]} [submenu] - Submenu items
 * @property {Function} [action] - Click handler
 */

/**
 * Context Menu class.
 */
export class ContextMenu {
  /**
   * Create a new ContextMenu instance.
   *
   * @param {Object} [config]
   * @param {string} [config.className] - Additional CSS class
   */
  constructor(config = {}) {
    /**
     * Menu element.
     * @type {HTMLElement|null}
     * @private
     */
    this._menuElement = null;

    /**
     * Additional CSS class.
     * @type {string}
     * @private
     */
    this._className = config.className || '';

    /**
     * Current menu items.
     * @type {MenuAction[]}
     * @private
     */
    this._items = [];

    /**
     * Context data passed to action handlers.
     * @type {*}
     * @private
     */
    this._context = null;

    /**
     * Callback after menu action.
     * @type {Function|null}
     */
    this.onAction = null;

    // Create menu element
    this._createMenuElement();
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Create the menu DOM element.
   * @private
   */
  _createMenuElement() {
    this._menuElement = document.createElement('div');
    this._menuElement.className = `context-menu ${this._className}`.trim();
    this._menuElement.style.cssText = `
      position: fixed;
      display: none;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 180px;
      max-width: 300px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #fff;
      padding: 4px 0;
      overflow: visible;
    `;

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!this._menuElement.contains(e.target)) {
        this.hide();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Close on scroll
    document.addEventListener('scroll', () => {
      this.hide();
    }, true);

    document.body.appendChild(this._menuElement);
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Show context menu at position.
   *
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {MenuAction[]} items - Menu items
   * @param {*} [context] - Context data for action handlers
   */
  show(x, y, items, context = null) {
    this._items = items;
    this._context = context;

    // Build menu HTML
    this._menuElement.innerHTML = this._buildMenuHTML(items);

    // Show menu
    this._menuElement.style.display = 'block';

    // Adjust position if menu would go off screen
    const rect = this._menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }

    // Ensure menu doesn't go off left or top edge
    x = Math.max(10, x);
    y = Math.max(10, y);

    this._menuElement.style.left = `${x}px`;
    this._menuElement.style.top = `${y}px`;

    // Add click handlers
    this._addClickHandlers();
  }

  /**
   * Hide the context menu.
   */
  hide() {
    this._menuElement.style.display = 'none';
    this._context = null;
  }

  /**
   * Check if menu is visible.
   *
   * @returns {boolean}
   */
  isVisible() {
    return this._menuElement.style.display !== 'none';
  }

  // =========================================================================
  // Building
  // =========================================================================

  /**
   * Build menu HTML from items.
   *
   * @param {MenuAction[]} items - Menu items
   * @param {boolean} [isSubmenu=false] - Is this a submenu
   * @returns {string} HTML string
   * @private
   */
  _buildMenuHTML(items, isSubmenu = false) {
    let html = '';

    for (const item of items) {
      if (item.separator) {
        html += '<div class="menu-separator" style="height: 1px; background: #444; margin: 4px 8px;"></div>';
        continue;
      }

      const disabled = item.disabled ? 'opacity: 0.5; pointer-events: none;' : '';
      const hasSubmenu = item.submenu && item.submenu.length > 0;

      html += `
        <div class="menu-item" data-action="${item.id}" style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          ${disabled}
        " onmouseover="this.style.background='#3a3a3a'" onmouseout="this.style.background='transparent'">
          <span style="display: flex; align-items: center; gap: 8px;">
            ${item.checked ? '<span style="width: 16px; text-align: center;">✓</span>' : ''}
            ${item.icon ? `<span style="width: 20px; text-align: center;">${item.icon}</span>` : (!item.checked ? '<span style="width: 20px;"></span>' : '')}
            <span>${item.label}</span>
          </span>
          ${item.shortcut ? `<span style="color: #888; font-size: 11px; margin-left: 16px;">${item.shortcut}</span>` : ''}
          ${hasSubmenu ? '<span style="color: #888; margin-left: 8px;">▶</span>' : ''}
        </div>
      `;

      if (hasSubmenu) {
        html += `
          <div class="submenu" data-parent="${item.id}" style="
            display: none;
            position: absolute;
            left: 100%;
            top: 0;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            padding: 4px 0;
          ">
            ${this._buildMenuHTML(item.submenu, true)}
          </div>
        `;
      }
    }

    return html;
  }

  // =========================================================================
  // Event Handling
  // =========================================================================

  /**
   * Add click handlers to menu items.
   * @private
   */
  _addClickHandlers() {
    const menuItems = this._menuElement.querySelectorAll('.menu-item');

    menuItems.forEach(menuItem => {
      const actionId = menuItem.dataset.action;
      const submenu = this._menuElement.querySelector(`.submenu[data-parent="${actionId}"]`);

      // Handle submenu hover
      if (submenu) {
        menuItem.addEventListener('mouseenter', () => {
          // Hide other submenus
          this._menuElement.querySelectorAll('.submenu').forEach(s => s.style.display = 'none');
          // Show this submenu
          submenu.style.display = 'block';

          // Position submenu
          const itemRect = menuItem.getBoundingClientRect();
          const menuRect = this._menuElement.getBoundingClientRect();

          submenu.style.left = `${menuItem.offsetWidth}px`;
          submenu.style.top = `${menuItem.offsetTop}px`;

          // Check if submenu goes off right edge
          const submenuRect = submenu.getBoundingClientRect();
          if (submenuRect.right > window.innerWidth) {
            submenu.style.left = `-${submenuRect.width}px`;
          }
        });
      } else {
        menuItem.addEventListener('mouseenter', () => {
          // Hide submenus when hovering non-submenu items
          this._menuElement.querySelectorAll('.submenu').forEach(s => s.style.display = 'none');
        });
      }

      // Handle click
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();

        // Don't trigger for items with submenus
        if (submenu) return;

        this._handleAction(actionId);
      });
    });
  }

  /**
   * Handle menu action.
   *
   * @param {string} actionId - Action ID
   * @private
   */
  _handleAction(actionId) {
    const item = this._findItem(this._items, actionId);

    if (item && !item.disabled) {
      // Call item's action handler
      if (item.action) {
        try {
          item.action(this._context);
        } catch (error) {
          console.error('ContextMenu: Action error:', error);
        }
      }

      // Call global onAction callback
      if (this.onAction) {
        try {
          this.onAction(actionId, this._context);
        } catch (error) {
          console.error('ContextMenu: onAction callback error:', error);
        }
      }
    }

    this.hide();
  }

  /**
   * Find item by ID recursively.
   *
   * @param {MenuAction[]} items - Items to search
   * @param {string} actionId - Action ID to find
   * @returns {MenuAction|null}
   * @private
   */
  _findItem(items, actionId) {
    for (const item of items) {
      if (item.id === actionId) return item;
      if (item.submenu) {
        const found = this._findItem(item.submenu, actionId);
        if (found) return found;
      }
    }
    return null;
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Destroy the context menu.
   */
  destroy() {
    if (this._menuElement && this._menuElement.parentNode) {
      this._menuElement.parentNode.removeChild(this._menuElement);
    }
    this._menuElement = null;
  }
}

/**
 * Create and show a context menu.
 * Convenience function for one-off menus.
 *
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {MenuAction[]} items - Menu items
 * @param {*} [context] - Context data
 * @returns {ContextMenu}
 */
export function showContextMenu(x, y, items, context = null) {
  const menu = new ContextMenu();
  menu.show(x, y, items, context);
  return menu;
}

/**
 * Node context menu instance.
 * @type {ContextMenu}
 */
export const nodeContextMenu = new ContextMenu({ className: 'node-context-menu' });
