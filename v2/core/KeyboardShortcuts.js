/**
 * Keyboard Shortcuts - Global keyboard shortcuts for the application
 *
 * This module registers action handlers with ShortcutManager,
 * enabling customizable key bindings while maintaining the application logic.
 *
 * Includes undo/redo support via CommandManager.
 */

import { state, save, clearSelection } from '../state.js';
import { nodeCreator } from '../ui/NodeCreator.js';
import { detailsPanel } from '../ui/DetailsPanel.js';
import { eventManager } from './EventManager.js';
import { commandManager } from '../commands/CommandManager.js';
import { shortcutHints } from '../ui/ShortcutHints.js';
import { shortcutManager } from '../settings/ShortcutManager.js';
import { settingsPanel } from '../settings/SettingsPanel.js';
import { themeManager } from '../ui/ThemeManager.js';

export class KeyboardShortcuts {
  constructor() {
    /**
     * Legacy shortcuts map for backwards compatibility.
     * Used by ShortcutHints to display shortcuts.
     * @type {Map}
     */
    this.shortcuts = new Map();

    /**
     * Whether shortcuts are enabled.
     * @type {boolean}
     */
    this.enabled = true;
  }

  /**
   * Initialize keyboard shortcuts.
   * Registers all handlers with ShortcutManager.
   */
  init() {
    // Initialize ShortcutManager
    shortcutManager.init();

    // Register all action handlers
    this.registerHandlers();

    // Initialize shortcut hints modal
    shortcutHints.init(this);

    // Initialize settings panel
    settingsPanel.init();

    // Initialize theme manager
    themeManager.init();

    // Sync legacy shortcuts map for hints display
    this._syncLegacyShortcuts();

    // Listen for shortcut changes to update legacy map
    shortcutManager.onChange(() => {
      this._syncLegacyShortcuts();
    });

    console.log('KeyboardShortcuts initialized with ShortcutManager');
  }

  /**
   * Register all action handlers with ShortcutManager.
   */
  registerHandlers() {
    // Node creation
    shortcutManager.register('newNode', (e) => {
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      const x = (rect.width / 2) - state.viewport.x;
      const y = (rect.height / 2) - state.viewport.y;

      nodeCreator.show(x, y, () => {
        if (eventManager.onRenderNeeded) {
          eventManager.onRenderNeeded();
        }
      });
    });

    // Delete selected nodes
    shortcutManager.register('delete', (e) => {
      if (state.selectedNodes.length > 0) {
        eventManager.deleteSelectedNodes();
      }
    });

    // Clear selection
    shortcutManager.register('clearSelection', (e) => {
      clearSelection();
      detailsPanel.hide();

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Save
    shortcutManager.register('save', (e) => {
      save();
      console.log('💾 Saved');
    });

    // Undo
    shortcutManager.register('undo', (e) => {
      if (commandManager.canUndo()) {
        const description = commandManager.getUndoDescription();
        const command = commandManager.undo();
        if (command) {
          console.log(`↩️ Undo: ${description}`);
          if (eventManager.onRenderNeeded) {
            eventManager.onRenderNeeded();
          }
        }
      } else {
        console.log('Nothing to undo');
      }
    });

    // Redo (primary)
    shortcutManager.register('redo', (e) => {
      this._doRedo();
    });

    // Redo (alternative)
    shortcutManager.register('redoAlt', (e) => {
      this._doRedo();
    });

    // Select all
    shortcutManager.register('selectAll', (e) => {
      state.selectedNodes = state.nodes.map(n => n.id);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Duplicate
    shortcutManager.register('duplicate', (e) => {
      console.log('Duplicate not yet implemented');
    });

    // Toggle details panel
    shortcutManager.register('toggleDetails', (e) => {
      if (state.selectedNodes.length === 1) {
        if (detailsPanel.panel.classList.contains('visible')) {
          detailsPanel.hide();
        } else {
          detailsPanel.show(state.selectedNodes[0]);
        }
      }
    });

    // Toggle settings panel
    shortcutManager.register('toggleSettings', (e) => {
      settingsPanel.toggle();
    });

    // Zoom in
    shortcutManager.register('zoomIn', (e) => {
      state.viewport.zoom = Math.min(state.viewport.zoom * 1.1, 3);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Zoom out
    shortcutManager.register('zoomOut', (e) => {
      state.viewport.zoom = Math.max(state.viewport.zoom / 1.1, 0.3);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Reset zoom
    shortcutManager.register('zoomReset', (e) => {
      state.viewport.zoom = 1;

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Center view
    shortcutManager.register('centerView', (e) => {
      state.viewport.x = 0;
      state.viewport.y = 0;

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Show keyboard shortcuts help
    shortcutManager.register('showHelp', (e) => {
      this.showHelp();
    });

    // Toggle theme
    shortcutManager.register('toggleTheme', (e) => {
      themeManager.toggle();
    });

    // Mode switching (handlers can be added later by mode-manager)
    shortcutManager.register('modeHierarchical', (e) => {
      this._switchMode('hierarchical');
    });

    shortcutManager.register('modeFlow', (e) => {
      this._switchMode('flow');
    });

    shortcutManager.register('modeNotes', (e) => {
      this._switchMode('notes');
    });

    // Navigate up in hierarchy
    shortcutManager.register('navigateUp', (e) => {
      // Will be handled by hierarchical mode
      if (state.path && state.path.length > 0) {
        state.path.pop();
        if (eventManager.onRenderNeeded) {
          eventManager.onRenderNeeded();
        }
      }
    });
  }

  /**
   * Perform redo action.
   * @private
   */
  _doRedo() {
    if (commandManager.canRedo()) {
      const description = commandManager.getRedoDescription();
      const command = commandManager.redo();
      if (command) {
        console.log(`↪️ Redo: ${description}`);
        if (eventManager.onRenderNeeded) {
          eventManager.onRenderNeeded();
        }
      }
    } else {
      console.log('Nothing to redo');
    }
  }

  /**
   * Switch to a different mode.
   *
   * @param {string} modeName - Mode to switch to
   * @private
   */
  _switchMode(modeName) {
    // This will be overridden or connected to mode-manager
    const modeRadios = document.querySelectorAll(`input[name="mode"][value="${modeName}"]`);
    if (modeRadios.length > 0) {
      modeRadios[0].checked = true;
      modeRadios[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Sync legacy shortcuts map with ShortcutManager bindings.
   * Used for backwards compatibility with ShortcutHints.
   * @private
   */
  _syncLegacyShortcuts() {
    this.shortcuts.clear();

    const allInfo = shortcutManager.getAllInfo();
    for (const [action, info] of Object.entries(allInfo)) {
      const binding = shortcutManager.getBinding(action);
      if (binding) {
        this.shortcuts.set(binding.toLowerCase(), {
          key: binding,
          description: info.description,
          handler: () => {} // Placeholder - actual handling done by ShortcutManager
        });
      }
    }
  }

  /**
   * Show keyboard shortcuts help.
   */
  showHelp() {
    shortcutHints.toggle();
  }

  /**
   * Enable shortcuts.
   */
  enable() {
    this.enabled = true;
    shortcutManager.enable();
  }

  /**
   * Disable shortcuts.
   */
  disable() {
    this.enabled = false;
    shortcutManager.disable();
  }

  /**
   * Register a keyboard shortcut (legacy method).
   * For backwards compatibility - use shortcutManager.register() for new code.
   *
   * @param {string} key - Key combination
   * @param {string} description - Human-readable description
   * @param {Function} handler - Handler function
   * @deprecated Use shortcutManager.register() instead
   */
  register(key, description, handler) {
    console.warn('KeyboardShortcuts.register() is deprecated. Use shortcutManager.register() instead.');
    this.shortcuts.set(key.toLowerCase(), {
      key,
      description,
      handler
    });
  }

  /**
   * Unregister a shortcut (legacy method).
   *
   * @param {string} key - Key combination
   * @deprecated Use shortcutManager.unregister() instead
   */
  unregister(key) {
    console.warn('KeyboardShortcuts.unregister() is deprecated.');
    this.shortcuts.delete(key.toLowerCase());
  }
}

// Create singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();
