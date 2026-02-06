/**
 * Connection Context Menu
 *
 * Provides a context menu for connection operations:
 * - Delete connection
 * - Edit label
 * - Change style
 * - Toggle animation
 * - Change connection type
 *
 * @see ARCHITECTURE_PLAN.md Module 3 for full documentation
 */

import { connectionManager, ConnectionType } from './ConnectionManager.js';
import { connectionTypeRegistry } from './types/ConnectionTypeRegistry.js';

/**
 * @typedef {Object} MenuAction
 * @property {string} id - Action identifier
 * @property {string} label - Display label
 * @property {string} [icon] - Optional icon
 * @property {string} [shortcut] - Keyboard shortcut
 * @property {boolean} [disabled] - Whether action is disabled
 * @property {boolean} [separator] - Show separator after this item
 * @property {MenuAction[]} [submenu] - Submenu items
 */

/**
 * Connection Context Menu class.
 */
export class ConnectionContextMenu {
  constructor() {
    /**
     * Menu element.
     * @type {HTMLElement|null}
     * @private
     */
    this._menuElement = null;

    /**
     * Currently targeted connection ID.
     * @type {string|null}
     * @private
     */
    this._targetConnectionId = null;

    /**
     * Callback for when connection is modified.
     * @type {Function|null}
     */
    this.onConnectionModified = null;

    /**
     * Callback for when render is needed.
     * @type {Function|null}
     */
    this.onRenderNeeded = null;

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
    this._menuElement.className = 'connection-context-menu';
    this._menuElement.style.cssText = `
      position: fixed;
      display: none;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 180px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #fff;
      padding: 4px 0;
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

    document.body.appendChild(this._menuElement);
  }

  /**
   * Get menu actions for a connection.
   *
   * @param {Object} connection - Connection object
   * @returns {MenuAction[]}
   * @private
   */
  _getMenuActions(connection) {
    const style = connection.style || {};
    const metadata = connection.metadata || {};

    return [
      {
        id: 'edit-label',
        label: metadata.label ? 'Edit Label' : 'Add Label',
        icon: '✏️'
      },
      {
        id: 'toggle-animation',
        label: style.animated ? 'Disable Animation' : 'Enable Animation',
        icon: style.animated ? '⏹️' : '▶️'
      },
      {
        id: 'toggle-label-visibility',
        label: style.showLabel !== false ? 'Hide Label' : 'Show Label',
        icon: style.showLabel !== false ? '👁️' : '👁️‍🗨️',
        disabled: !metadata.label
      },
      { separator: true },
      {
        id: 'change-type',
        label: 'Connection Type',
        icon: '🔗',
        submenu: this._getTypeSubmenu(connection)
      },
      {
        id: 'change-style',
        label: 'Style',
        icon: '🎨',
        submenu: this._getStyleSubmenu(connection)
      },
      { separator: true },
      {
        id: 'delete',
        label: 'Delete Connection',
        icon: '🗑️',
        shortcut: 'Del'
      }
    ];
  }

  /**
   * Get type change submenu.
   * @private
   */
  _getTypeSubmenu(connection) {
    const types = connectionTypeRegistry.getAll();
    return types.map(type => ({
      id: `type-${type.id}`,
      label: type.name,
      checked: connection.type === type.id
    }));
  }

  /**
   * Get style submenu.
   * @private
   */
  _getStyleSubmenu(connection) {
    const style = connection.style || {};
    return [
      {
        id: 'style-color',
        label: 'Color',
        submenu: [
          { id: 'color-default', label: 'Default', color: '#666' },
          { id: 'color-blue', label: 'Blue', color: '#3498db' },
          { id: 'color-green', label: 'Green', color: '#27ae60' },
          { id: 'color-orange', label: 'Orange', color: '#f39c12' },
          { id: 'color-red', label: 'Red', color: '#e74c3c' },
          { id: 'color-purple', label: 'Purple', color: '#9b59b6' }
        ]
      },
      {
        id: 'style-width',
        label: 'Width',
        submenu: [
          { id: 'width-thin', label: 'Thin (1px)', checked: style.strokeWidth === 1 },
          { id: 'width-normal', label: 'Normal (2px)', checked: style.strokeWidth === 2 || !style.strokeWidth },
          { id: 'width-thick', label: 'Thick (3px)', checked: style.strokeWidth === 3 },
          { id: 'width-bold', label: 'Bold (4px)', checked: style.strokeWidth === 4 }
        ]
      },
      {
        id: 'style-dash',
        label: 'Line Style',
        submenu: [
          { id: 'dash-solid', label: 'Solid', checked: !style.strokeDasharray },
          { id: 'dash-dashed', label: 'Dashed', checked: style.strokeDasharray === '5,5' },
          { id: 'dash-dotted', label: 'Dotted', checked: style.strokeDasharray === '2,2' }
        ]
      }
    ];
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Show context menu for a connection.
   *
   * @param {string} connectionId - Connection ID
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  show(connectionId, x, y) {
    const connection = connectionManager.getById(connectionId);
    if (!connection) {
      console.warn(`Connection not found: ${connectionId}`);
      return;
    }

    this._targetConnectionId = connectionId;
    const actions = this._getMenuActions(connection);

    // Build menu HTML
    this._menuElement.innerHTML = this._buildMenuHTML(actions);

    // Position menu
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
    this._targetConnectionId = null;
  }

  /**
   * Build menu HTML from actions.
   * @private
   */
  _buildMenuHTML(actions, isSubmenu = false) {
    let html = '';

    for (const action of actions) {
      if (action.separator) {
        html += '<div class="menu-separator" style="height: 1px; background: #444; margin: 4px 8px;"></div>';
        continue;
      }

      const disabled = action.disabled ? 'opacity: 0.5; pointer-events: none;' : '';
      const hasSubmenu = action.submenu && action.submenu.length > 0;

      html += `
        <div class="menu-item" data-action="${action.id}" style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          ${disabled}
        " onmouseover="this.style.background='#3a3a3a'" onmouseout="this.style.background='transparent'">
          <span style="display: flex; align-items: center; gap: 8px;">
            ${action.icon ? `<span style="width: 20px; text-align: center;">${action.icon}</span>` : ''}
            ${action.checked ? '<span style="width: 20px; text-align: center;">✓</span>' : (!action.icon ? '<span style="width: 20px;"></span>' : '')}
            ${action.color ? `<span style="width: 12px; height: 12px; border-radius: 2px; background: ${action.color};"></span>` : ''}
            <span>${action.label}</span>
          </span>
          ${action.shortcut ? `<span style="color: #888; font-size: 11px;">${action.shortcut}</span>` : ''}
          ${hasSubmenu ? '<span style="color: #888;">▶</span>' : ''}
        </div>
      `;

      if (hasSubmenu) {
        html += `
          <div class="submenu" data-parent="${action.id}" style="
            display: none;
            position: absolute;
            left: 100%;
            top: 0;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            ${this._buildMenuHTML(action.submenu, true)}
          </div>
        `;
      }
    }

    return html;
  }

  /**
   * Add click handlers to menu items.
   * @private
   */
  _addClickHandlers() {
    const items = this._menuElement.querySelectorAll('.menu-item');

    items.forEach(item => {
      // Handle submenu hover
      const submenu = this._menuElement.querySelector(`.submenu[data-parent="${item.dataset.action}"]`);
      if (submenu) {
        item.addEventListener('mouseenter', () => {
          // Hide other submenus
          this._menuElement.querySelectorAll('.submenu').forEach(s => s.style.display = 'none');
          // Show this submenu
          submenu.style.display = 'block';
          submenu.style.left = `${item.offsetWidth}px`;
          submenu.style.top = `${item.offsetTop}px`;
        });
      }

      // Handle click
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const actionId = item.dataset.action;

        // Don't trigger for items with submenus
        if (submenu) return;

        this._handleAction(actionId);
      });
    });
  }

  // =========================================================================
  // Action Handlers
  // =========================================================================

  /**
   * Handle menu action.
   * @private
   */
  _handleAction(actionId) {
    if (!this._targetConnectionId) return;

    const connection = connectionManager.getById(this._targetConnectionId);
    if (!connection) return;

    // Handle different actions
    if (actionId === 'delete') {
      this._deleteConnection();
    } else if (actionId === 'edit-label') {
      this._editLabel(connection);
    } else if (actionId === 'toggle-animation') {
      this._toggleAnimation(connection);
    } else if (actionId === 'toggle-label-visibility') {
      this._toggleLabelVisibility(connection);
    } else if (actionId.startsWith('type-')) {
      this._changeType(connection, actionId.replace('type-', ''));
    } else if (actionId.startsWith('color-')) {
      this._changeColor(connection, actionId);
    } else if (actionId.startsWith('width-')) {
      this._changeWidth(connection, actionId);
    } else if (actionId.startsWith('dash-')) {
      this._changeDash(connection, actionId);
    }

    this.hide();
  }

  /**
   * Delete the target connection.
   * @private
   */
  _deleteConnection() {
    connectionManager.delete(this._targetConnectionId);
    this._notifyModified();
    this._notifyRender();
  }

  /**
   * Edit connection label.
   * @private
   */
  _editLabel(connection) {
    const currentLabel = connection.metadata?.label || '';
    const newLabel = prompt('Enter connection label:', currentLabel);

    if (newLabel !== null) {
      connectionManager.updateMetadata(this._targetConnectionId, {
        label: newLabel
      });

      // Also show label if it was hidden and now has text
      if (newLabel && connection.style?.showLabel === false) {
        connectionManager.updateStyle(this._targetConnectionId, {
          showLabel: true
        });
      }

      this._notifyModified();
      this._notifyRender();
    }
  }

  /**
   * Toggle connection animation.
   * @private
   */
  _toggleAnimation(connection) {
    const currentAnimated = connection.style?.animated ?? false;
    connectionManager.updateStyle(this._targetConnectionId, {
      animated: !currentAnimated
    });
    this._notifyModified();
    this._notifyRender();
  }

  /**
   * Toggle label visibility.
   * @private
   */
  _toggleLabelVisibility(connection) {
    const currentVisible = connection.style?.showLabel !== false;
    connectionManager.updateStyle(this._targetConnectionId, {
      showLabel: !currentVisible
    });
    this._notifyModified();
    this._notifyRender();
  }

  /**
   * Change connection type.
   * @private
   */
  _changeType(connection, typeId) {
    connectionManager.update(this._targetConnectionId, {
      type: typeId
    });
    this._notifyModified();
    this._notifyRender();
  }

  /**
   * Change connection color.
   * @private
   */
  _changeColor(connection, colorId) {
    const colors = {
      'color-default': '#666',
      'color-blue': '#3498db',
      'color-green': '#27ae60',
      'color-orange': '#f39c12',
      'color-red': '#e74c3c',
      'color-purple': '#9b59b6'
    };

    const color = colors[colorId];
    if (color) {
      connectionManager.updateStyle(this._targetConnectionId, {
        stroke: color
      });
      this._notifyModified();
      this._notifyRender();
    }
  }

  /**
   * Change connection width.
   * @private
   */
  _changeWidth(connection, widthId) {
    const widths = {
      'width-thin': 1,
      'width-normal': 2,
      'width-thick': 3,
      'width-bold': 4
    };

    const width = widths[widthId];
    if (width) {
      connectionManager.updateStyle(this._targetConnectionId, {
        strokeWidth: width
      });
      this._notifyModified();
      this._notifyRender();
    }
  }

  /**
   * Change connection dash style.
   * @private
   */
  _changeDash(connection, dashId) {
    const dashes = {
      'dash-solid': null,
      'dash-dashed': '5,5',
      'dash-dotted': '2,2'
    };

    const dash = dashes[dashId];
    connectionManager.updateStyle(this._targetConnectionId, {
      strokeDasharray: dash
    });
    this._notifyModified();
    this._notifyRender();
  }

  // =========================================================================
  // Notifications
  // =========================================================================

  /**
   * Notify that connection was modified.
   * @private
   */
  _notifyModified() {
    if (this.onConnectionModified) {
      try {
        this.onConnectionModified(this._targetConnectionId);
      } catch (e) {
        console.error('onConnectionModified callback error:', e);
      }
    }
  }

  /**
   * Notify that render is needed.
   * @private
   */
  _notifyRender() {
    if (this.onRenderNeeded) {
      try {
        this.onRenderNeeded();
      } catch (e) {
        console.error('onRenderNeeded callback error:', e);
      }
    }
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
 * Singleton ConnectionContextMenu instance.
 * @type {ConnectionContextMenu}
 */
export const connectionContextMenu = new ConnectionContextMenu();
