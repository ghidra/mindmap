/**
 * Shortcut Manager
 *
 * Manages customizable keyboard shortcuts.
 * Integrates with SettingsManager for persistence.
 *
 * @see ARCHITECTURE_PLAN.md Module 8.2 for full documentation
 */

import { settingsManager } from './SettingsManager.js';

/**
 * LocalStorage key for shortcuts.
 * @type {string}
 */
const STORAGE_KEY = 'mindmap-shortcuts';

/**
 * Default keyboard shortcuts.
 * @type {Object.<string, string>}
 */
const DEFAULT_SHORTCUTS = {
  // Editing
  'newNode': 'n',
  'delete': 'Delete',
  'duplicate': 'ctrl+d',
  'undo': 'ctrl+z',
  'redo': 'ctrl+y',
  'redoAlt': 'ctrl+shift+z',

  // Selection
  'selectAll': 'ctrl+a',
  'clearSelection': 'Escape',

  // View
  'zoomIn': 'ctrl+=',
  'zoomOut': 'ctrl+-',
  'zoomReset': 'ctrl+0',
  'centerView': 'c',
  'toggleMinimap': 'm',

  // Panels
  'toggleDetails': 'i',
  'toggleSettings': ',',

  // File
  'save': 'ctrl+s',
  'load': 'ctrl+o',

  // Help
  'showHelp': '?',

  // Mode switching
  'modeHierarchical': '1',
  'modeFlow': '2',
  'modeNotes': '3',

  // Navigation (hierarchical mode)
  'navigateUp': 'Backspace',

  // Theme
  'toggleTheme': 't'
};

/**
 * Shortcut descriptions for UI.
 * @type {Object.<string, Object>}
 */
const SHORTCUT_INFO = {
  'newNode': { description: 'Create new node', category: 'editing' },
  'delete': { description: 'Delete selected', category: 'editing' },
  'duplicate': { description: 'Duplicate selected', category: 'editing' },
  'undo': { description: 'Undo', category: 'editing' },
  'redo': { description: 'Redo', category: 'editing' },
  'redoAlt': { description: 'Redo (alternative)', category: 'editing' },

  'selectAll': { description: 'Select all nodes', category: 'selection' },
  'clearSelection': { description: 'Clear selection', category: 'selection' },

  'zoomIn': { description: 'Zoom in', category: 'view' },
  'zoomOut': { description: 'Zoom out', category: 'view' },
  'zoomReset': { description: 'Reset zoom', category: 'view' },
  'centerView': { description: 'Center view', category: 'view' },
  'toggleMinimap': { description: 'Toggle minimap', category: 'view' },

  'toggleDetails': { description: 'Toggle details panel', category: 'panels' },
  'toggleSettings': { description: 'Open settings', category: 'panels' },

  'save': { description: 'Save', category: 'file' },
  'load': { description: 'Load project', category: 'file' },

  'showHelp': { description: 'Show keyboard shortcuts', category: 'help' },

  'modeHierarchical': { description: 'Switch to hierarchical mode', category: 'modes' },
  'modeFlow': { description: 'Switch to flow mode', category: 'modes' },
  'modeNotes': { description: 'Switch to notes mode', category: 'modes' },

  'navigateUp': { description: 'Navigate up (hierarchical)', category: 'navigation' },

  'toggleTheme': { description: 'Toggle theme', category: 'appearance' }
};

/**
 * Parse a key combination string into components.
 *
 * @param {string} keyCombo - Key combination (e.g., 'ctrl+shift+s')
 * @returns {Object} Parsed key combination
 */
function parseKeyCombo(keyCombo) {
  const parts = keyCombo.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter(p => !['ctrl', 'cmd', 'shift', 'alt'].includes(p))[0] || ''
  };
}

/**
 * Format a key combination for display.
 *
 * @param {string} keyCombo - Key combination
 * @param {boolean} [useMacSymbols=false] - Use Mac-style symbols
 * @returns {string} Formatted string
 */
function formatKeyCombo(keyCombo, useMacSymbols = false) {
  const parsed = parseKeyCombo(keyCombo);
  const parts = [];

  if (parsed.ctrl) {
    parts.push(useMacSymbols ? '⌘' : 'Ctrl');
  }
  if (parsed.shift) {
    parts.push(useMacSymbols ? '⇧' : 'Shift');
  }
  if (parsed.alt) {
    parts.push(useMacSymbols ? '⌥' : 'Alt');
  }

  // Format the key
  let key = parsed.key;
  if (key === 'escape') key = 'Esc';
  else if (key === 'delete') key = useMacSymbols ? '⌫' : 'Del';
  else if (key === 'backspace') key = useMacSymbols ? '⌫' : 'Backspace';
  else if (key === '=') key = '+';
  else key = key.toUpperCase();

  parts.push(key);

  return useMacSymbols ? parts.join('') : parts.join('+');
}

/**
 * Check if a keyboard event matches a key combination.
 *
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} combo - Parsed key combination
 * @returns {boolean}
 */
function matchesCombo(event, combo) {
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (combo.ctrl && !ctrlOrMeta) return false;
  if (!combo.ctrl && ctrlOrMeta) return false;
  if (combo.shift !== event.shiftKey) return false;
  if (combo.alt !== event.altKey) return false;

  return event.key.toLowerCase() === combo.key.toLowerCase();
}

/**
 * Shortcut Manager class.
 */
export class ShortcutManager {
  /**
   * Create a new ShortcutManager instance.
   */
  constructor() {
    /**
     * Current shortcut bindings.
     * @type {Object.<string, string>}
     * @private
     */
    this._shortcuts = { ...DEFAULT_SHORTCUTS };

    /**
     * Parsed shortcut combinations.
     * @type {Map<string, Object>}
     * @private
     */
    this._parsedShortcuts = new Map();

    /**
     * Action handlers.
     * @type {Map<string, Function>}
     * @private
     */
    this._handlers = new Map();

    /**
     * Whether shortcuts are enabled.
     * @type {boolean}
     * @private
     */
    this._enabled = true;

    /**
     * Contexts where shortcuts should be disabled.
     * @type {Set<string>}
     * @private
     */
    this._disabledContexts = new Set(['input', 'textarea', 'contenteditable']);

    /**
     * Change listeners.
     * @type {Set<Function>}
     * @private
     */
    this._listeners = new Set();
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the shortcut manager.
   */
  init() {
    this._load();
    this._parseAllShortcuts();
    this._setupKeyListener();
    console.log('ShortcutManager initialized');
  }

  /**
   * Load shortcuts from localStorage.
   * @private
   */
  _load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults
        this._shortcuts = { ...DEFAULT_SHORTCUTS, ...parsed };
      }
    } catch (error) {
      console.warn('ShortcutManager: Failed to load shortcuts:', error);
    }
  }

  /**
   * Save shortcuts to localStorage.
   * @private
   */
  _save() {
    try {
      // Only save non-default bindings
      const custom = {};
      for (const [action, binding] of Object.entries(this._shortcuts)) {
        if (binding !== DEFAULT_SHORTCUTS[action]) {
          custom[action] = binding;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch (error) {
      console.error('ShortcutManager: Failed to save shortcuts:', error);
    }
  }

  /**
   * Parse all shortcut bindings.
   * @private
   */
  _parseAllShortcuts() {
    this._parsedShortcuts.clear();
    for (const [action, binding] of Object.entries(this._shortcuts)) {
      if (binding) {
        this._parsedShortcuts.set(action, parseKeyCombo(binding));
      }
    }
  }

  /**
   * Set up the keyboard event listener.
   * @private
   */
  _setupKeyListener() {
    document.addEventListener('keydown', (e) => this._handleKeyDown(e));
  }

  // =========================================================================
  // Handler Registration
  // =========================================================================

  /**
   * Register an action handler.
   *
   * @param {string} action - Action identifier
   * @param {Function} handler - Handler function
   */
  register(action, handler) {
    this._handlers.set(action, handler);
  }

  /**
   * Unregister an action handler.
   *
   * @param {string} action - Action identifier
   */
  unregister(action) {
    this._handlers.delete(action);
  }

  // =========================================================================
  // Binding Management
  // =========================================================================

  /**
   * Get the binding for an action.
   *
   * @param {string} action - Action identifier
   * @returns {string|null} Key combination or null
   */
  getBinding(action) {
    return this._shortcuts[action] || null;
  }

  /**
   * Get all bindings.
   *
   * @returns {Object.<string, string>}
   */
  getAllBindings() {
    return { ...this._shortcuts };
  }

  /**
   * Set a binding for an action.
   *
   * @param {string} action - Action identifier
   * @param {string|null} keyCombo - Key combination or null to unbind
   */
  setBinding(action, keyCombo) {
    if (keyCombo) {
      // Check for conflicts
      const conflict = this.findConflict(keyCombo, action);
      if (conflict) {
        console.warn(`ShortcutManager: Binding conflict with '${conflict}'`);
      }

      this._shortcuts[action] = keyCombo;
      this._parsedShortcuts.set(action, parseKeyCombo(keyCombo));
    } else {
      delete this._shortcuts[action];
      this._parsedShortcuts.delete(action);
    }

    this._save();
    this._notifyListeners(action, keyCombo);
  }

  /**
   * Reset a binding to default.
   *
   * @param {string} action - Action identifier
   */
  resetBinding(action) {
    const defaultBinding = DEFAULT_SHORTCUTS[action] || null;
    this.setBinding(action, defaultBinding);
  }

  /**
   * Reset all bindings to defaults.
   */
  resetAllBindings() {
    this._shortcuts = { ...DEFAULT_SHORTCUTS };
    this._parseAllShortcuts();
    this._save();

    // Notify for all changes
    for (const action of Object.keys(DEFAULT_SHORTCUTS)) {
      this._notifyListeners(action, DEFAULT_SHORTCUTS[action]);
    }
  }

  /**
   * Find an action that conflicts with a binding.
   *
   * @param {string} keyCombo - Key combination to check
   * @param {string} [excludeAction] - Action to exclude from check
   * @returns {string|null} Conflicting action or null
   */
  findConflict(keyCombo, excludeAction = null) {
    const combo = parseKeyCombo(keyCombo);

    for (const [action, existingCombo] of this._parsedShortcuts) {
      if (action === excludeAction) continue;

      if (combo.ctrl === existingCombo.ctrl &&
          combo.shift === existingCombo.shift &&
          combo.alt === existingCombo.alt &&
          combo.key.toLowerCase() === existingCombo.key.toLowerCase()) {
        return action;
      }
    }

    return null;
  }

  // =========================================================================
  // Event Handling
  // =========================================================================

  /**
   * Handle keyboard events.
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleKeyDown(event) {
    if (!this._enabled) return;

    // Check if in disabled context
    if (this._isDisabledContext(event.target)) {
      // Allow certain shortcuts even in disabled contexts
      const alwaysAllowed = ['save', 'clearSelection'];
      let matched = false;

      for (const action of alwaysAllowed) {
        const combo = this._parsedShortcuts.get(action);
        if (combo && matchesCombo(event, combo)) {
          matched = true;
          break;
        }
      }

      if (!matched) return;
    }

    // Find matching shortcut
    for (const [action, combo] of this._parsedShortcuts) {
      if (matchesCombo(event, combo)) {
        const handler = this._handlers.get(action);
        if (handler) {
          event.preventDefault();
          try {
            handler(event);
          } catch (error) {
            console.error(`ShortcutManager: Handler error for '${action}':`, error);
          }
          return;
        }
      }
    }
  }

  /**
   * Check if target is in a disabled context.
   *
   * @param {HTMLElement} target - Event target
   * @returns {boolean}
   * @private
   */
  _isDisabledContext(target) {
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    if (this._disabledContexts.has(tagName)) return true;

    if (target.isContentEditable) return true;

    return false;
  }

  // =========================================================================
  // Enable/Disable
  // =========================================================================

  /**
   * Enable all shortcuts.
   */
  enable() {
    this._enabled = true;
  }

  /**
   * Disable all shortcuts.
   */
  disable() {
    this._enabled = false;
  }

  /**
   * Check if shortcuts are enabled.
   *
   * @returns {boolean}
   */
  isEnabled() {
    return this._enabled;
  }

  // =========================================================================
  // Listeners
  // =========================================================================

  /**
   * Add a change listener.
   *
   * @param {Function} callback - Called with (action, binding)
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Notify listeners of a change.
   *
   * @param {string} action - Changed action
   * @param {string} binding - New binding
   * @private
   */
  _notifyListeners(action, binding) {
    this._listeners.forEach(callback => {
      try {
        callback(action, binding);
      } catch (error) {
        console.error('ShortcutManager: Listener error:', error);
      }
    });
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  /**
   * Get shortcut info for an action.
   *
   * @param {string} action - Action identifier
   * @returns {Object|null} Shortcut info or null
   */
  getInfo(action) {
    return SHORTCUT_INFO[action] || null;
  }

  /**
   * Get all shortcut info.
   *
   * @returns {Object.<string, Object>}
   */
  getAllInfo() {
    return { ...SHORTCUT_INFO };
  }

  /**
   * Get shortcuts grouped by category.
   *
   * @returns {Object.<string, Array>}
   */
  getByCategory() {
    const grouped = {};

    for (const [action, info] of Object.entries(SHORTCUT_INFO)) {
      const category = info.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push({
        action,
        binding: this.getBinding(action),
        description: info.description
      });
    }

    return grouped;
  }

  /**
   * Format a binding for display.
   *
   * @param {string} action - Action identifier
   * @param {boolean} [useMacSymbols=false] - Use Mac-style symbols
   * @returns {string}
   */
  formatBinding(action, useMacSymbols = false) {
    const binding = this.getBinding(action);
    return binding ? formatKeyCombo(binding, useMacSymbols) : '';
  }

  /**
   * Get the default binding for an action.
   *
   * @param {string} action - Action identifier
   * @returns {string|null}
   */
  getDefaultBinding(action) {
    return DEFAULT_SHORTCUTS[action] || null;
  }

  /**
   * Check if a binding has been customized.
   *
   * @param {string} action - Action identifier
   * @returns {boolean}
   */
  isCustomized(action) {
    return this.getBinding(action) !== this.getDefaultBinding(action);
  }
}

/**
 * Singleton shortcut manager instance.
 * @type {ShortcutManager}
 */
export const shortcutManager = new ShortcutManager();

// Export utilities
export { parseKeyCombo, formatKeyCombo, DEFAULT_SHORTCUTS, SHORTCUT_INFO };
