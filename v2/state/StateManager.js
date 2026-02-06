/**
 * State Manager
 *
 * Central state management with event-based subscriptions.
 * Provides controlled access to application state with change notifications.
 *
 * Features:
 * - Event system for state changes
 * - Path-based subscriptions (subscribe to specific state paths)
 * - Batch updates to minimize re-renders
 * - Transaction support for atomic changes
 * - Undo/redo integration ready
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

/**
 * @typedef {Object} StateChangeEvent
 * @property {string} path - State path that changed (e.g., 'views.hierarchical.nodes')
 * @property {*} oldValue - Previous value
 * @property {*} newValue - New value
 * @property {string} action - Action type ('set', 'push', 'splice', 'delete')
 * @property {number} timestamp - Change timestamp
 */

/**
 * @typedef {Object} Subscription
 * @property {string} id - Subscription ID
 * @property {string} path - Path pattern to watch
 * @property {Function} callback - Callback function
 * @property {boolean} [immediate] - Call immediately with current value
 */

/**
 * State Manager class.
 *
 * Provides centralized state management with events.
 */
export class StateManager {
  constructor() {
    /**
     * The state tree.
     * @type {Object}
     * @private
     */
    this._state = this._createInitialState();

    /**
     * Subscriptions by path.
     * @type {Map<string, Set<Subscription>>}
     * @private
     */
    this._subscriptions = new Map();

    /**
     * Global listeners (receive all changes).
     * @type {Set<Function>}
     * @private
     */
    this._globalListeners = new Set();

    /**
     * Batch mode flag.
     * @type {boolean}
     * @private
     */
    this._batchMode = false;

    /**
     * Pending changes during batch mode.
     * @type {StateChangeEvent[]}
     * @private
     */
    this._pendingChanges = [];

    /**
     * Transaction flag.
     * @type {boolean}
     * @private
     */
    this._inTransaction = false;

    /**
     * Transaction snapshot.
     * @type {Object|null}
     * @private
     */
    this._transactionSnapshot = null;

    /**
     * Subscription ID counter.
     * @type {number}
     * @private
     */
    this._subscriptionIdCounter = 0;

    /**
     * Change history for debugging.
     * @type {StateChangeEvent[]}
     * @private
     */
    this._history = [];

    /**
     * Max history size.
     * @type {number}
     */
    this.maxHistorySize = 100;

    /**
     * Whether to track history.
     * @type {boolean}
     */
    this.trackHistory = false;
  }

  /**
   * Create initial state structure.
   *
   * @returns {Object} Initial state
   * @private
   */
  _createInitialState() {
    return {
      // Project data (parsed code structure)
      project: {
        id: null,
        name: null,
        data: null,        // ProjectData from parser
        loadedAt: null
      },

      // View state (UI state per mode)
      views: {
        hierarchical: {
          nodes: [],
          connections: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          path: [],
          selection: []
        },
        flow: {
          nodes: [],
          connections: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          focusedNode: null,
          navigationStack: [],
          executionGraph: null,
          flowType: 'entry-point'
        },
        notes: {
          nodes: [],
          connections: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      },

      // UI state
      ui: {
        currentMode: 'hierarchical',
        selectedNodes: [],
        activePanel: null,
        theme: 'dark'
      },

      // Preferences
      preferences: {
        autoSave: true,
        autoSaveInterval: 30000,
        shortcuts: {}
      }
    };
  }

  /**
   * Get a value from state by path.
   *
   * @param {string} path - Dot-separated path (e.g., 'views.hierarchical.nodes')
   * @param {*} [defaultValue] - Default value if path doesn't exist
   * @returns {*} Value at path
   */
  get(path, defaultValue = undefined) {
    const parts = path.split('.');
    let current = this._state;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[part];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Set a value in state by path.
   *
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @param {Object} [options] - Options
   * @param {boolean} [options.silent=false] - Don't emit events
   * @returns {boolean} Success
   */
  set(path, value, options = {}) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this._state;

    // Navigate to parent
    for (const part of parts) {
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }

    const oldValue = current[lastPart];

    // Don't emit if value unchanged (shallow compare)
    if (oldValue === value) {
      return false;
    }

    current[lastPart] = value;

    if (!options.silent) {
      this._emitChange({
        path,
        oldValue,
        newValue: value,
        action: 'set',
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Push a value to an array in state.
   *
   * @param {string} path - Path to array
   * @param {*} value - Value to push
   * @param {Object} [options] - Options
   * @returns {number} New array length
   */
  push(path, value, options = {}) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      throw new Error(`Cannot push to non-array at path: ${path}`);
    }

    const oldLength = array.length;
    array.push(value);

    if (!options.silent) {
      this._emitChange({
        path,
        oldValue: oldLength,
        newValue: array.length,
        action: 'push',
        item: value,
        timestamp: Date.now()
      });
    }

    return array.length;
  }

  /**
   * Remove an item from an array by index or predicate.
   *
   * @param {string} path - Path to array
   * @param {number|Function} indexOrPredicate - Index or predicate function
   * @param {Object} [options] - Options
   * @returns {*} Removed item or undefined
   */
  remove(path, indexOrPredicate, options = {}) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      throw new Error(`Cannot remove from non-array at path: ${path}`);
    }

    let index;
    if (typeof indexOrPredicate === 'function') {
      index = array.findIndex(indexOrPredicate);
    } else {
      index = indexOrPredicate;
    }

    if (index < 0 || index >= array.length) {
      return undefined;
    }

    const [removed] = array.splice(index, 1);

    if (!options.silent) {
      this._emitChange({
        path,
        oldValue: removed,
        newValue: undefined,
        action: 'splice',
        index,
        timestamp: Date.now()
      });
    }

    return removed;
  }

  /**
   * Update an object in state (merge).
   *
   * @param {string} path - Path to object
   * @param {Object} updates - Properties to merge
   * @param {Object} [options] - Options
   * @returns {boolean} Success
   */
  update(path, updates, options = {}) {
    const current = this.get(path);
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Cannot update non-object at path: ${path}`);
    }

    const oldValue = { ...current };

    Object.assign(current, updates);

    if (!options.silent) {
      this._emitChange({
        path,
        oldValue,
        newValue: current,
        action: 'update',
        updates,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Delete a property from state.
   *
   * @param {string} path - Path to delete
   * @param {Object} [options] - Options
   * @returns {boolean} Success
   */
  delete(path, options = {}) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this._state;

    for (const part of parts) {
      if (current[part] === undefined) {
        return false;
      }
      current = current[part];
    }

    if (!(lastPart in current)) {
      return false;
    }

    const oldValue = current[lastPart];
    delete current[lastPart];

    if (!options.silent) {
      this._emitChange({
        path,
        oldValue,
        newValue: undefined,
        action: 'delete',
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Subscribe to state changes at a path.
   *
   * @param {string} path - Path pattern to watch ('*' for all, 'views.*' for prefix)
   * @param {Function} callback - Callback(event)
   * @param {Object} [options] - Options
   * @param {boolean} [options.immediate=false] - Call immediately with current value
   * @returns {string} Subscription ID (for unsubscribing)
   */
  subscribe(path, callback, options = {}) {
    const id = `sub_${++this._subscriptionIdCounter}`;

    const subscription = {
      id,
      path,
      callback,
      immediate: options.immediate || false
    };

    if (!this._subscriptions.has(path)) {
      this._subscriptions.set(path, new Set());
    }
    this._subscriptions.get(path).add(subscription);

    // Call immediately if requested
    if (options.immediate) {
      const currentValue = path === '*' ? this._state : this.get(path);
      callback({
        path,
        oldValue: undefined,
        newValue: currentValue,
        action: 'initial',
        timestamp: Date.now()
      });
    }

    return id;
  }

  /**
   * Unsubscribe by subscription ID.
   *
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} Success
   */
  unsubscribe(subscriptionId) {
    for (const [, subs] of this._subscriptions) {
      for (const sub of subs) {
        if (sub.id === subscriptionId) {
          subs.delete(sub);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Add a global listener that receives all changes.
   *
   * @param {Function} callback - Callback(event)
   * @returns {Function} Unsubscribe function
   */
  addGlobalListener(callback) {
    this._globalListeners.add(callback);
    return () => this._globalListeners.delete(callback);
  }

  /**
   * Start batch mode - changes are collected and emitted together.
   */
  startBatch() {
    this._batchMode = true;
    this._pendingChanges = [];
  }

  /**
   * End batch mode and emit all collected changes.
   */
  endBatch() {
    this._batchMode = false;
    const changes = this._pendingChanges;
    this._pendingChanges = [];

    if (changes.length > 0) {
      // Emit batch event
      this._notifyGlobalListeners({
        path: '*',
        action: 'batch',
        changes,
        timestamp: Date.now()
      });

      // Emit individual events
      for (const change of changes) {
        this._notifySubscribers(change);
      }
    }
  }

  /**
   * Execute a function in batch mode.
   *
   * @param {Function} fn - Function to execute
   * @returns {*} Function return value
   */
  batch(fn) {
    this.startBatch();
    try {
      return fn();
    } finally {
      this.endBatch();
    }
  }

  /**
   * Start a transaction - changes can be rolled back.
   */
  startTransaction() {
    if (this._inTransaction) {
      throw new Error('Already in a transaction');
    }
    this._inTransaction = true;
    this._transactionSnapshot = JSON.parse(JSON.stringify(this._state));
  }

  /**
   * Commit a transaction.
   */
  commitTransaction() {
    if (!this._inTransaction) {
      throw new Error('Not in a transaction');
    }
    this._inTransaction = false;
    this._transactionSnapshot = null;
  }

  /**
   * Rollback a transaction.
   */
  rollbackTransaction() {
    if (!this._inTransaction) {
      throw new Error('Not in a transaction');
    }
    this._state = this._transactionSnapshot;
    this._inTransaction = false;
    this._transactionSnapshot = null;

    // Emit rollback event
    this._emitChange({
      path: '*',
      action: 'rollback',
      timestamp: Date.now()
    });
  }

  /**
   * Get entire state (read-only snapshot).
   *
   * @returns {Object} State snapshot
   */
  getState() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /**
   * Replace entire state (for loading).
   *
   * @param {Object} newState - New state
   * @param {Object} [options] - Options
   */
  setState(newState, options = {}) {
    const oldState = this._state;
    this._state = newState;

    if (!options.silent) {
      this._emitChange({
        path: '*',
        oldValue: oldState,
        newValue: newState,
        action: 'replace',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Reset state to initial values.
   *
   * @param {Object} [options] - Options
   */
  reset(options = {}) {
    const oldState = this._state;
    this._state = this._createInitialState();

    if (!options.silent) {
      this._emitChange({
        path: '*',
        oldValue: oldState,
        newValue: this._state,
        action: 'reset',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get change history (if tracking enabled).
   *
   * @returns {StateChangeEvent[]} History
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Clear change history.
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Emit a change event.
   *
   * @param {StateChangeEvent} event - Change event
   * @private
   */
  _emitChange(event) {
    // Track history if enabled
    if (this.trackHistory) {
      this._history.push(event);
      if (this._history.length > this.maxHistorySize) {
        this._history.shift();
      }
    }

    // In batch mode, collect changes
    if (this._batchMode) {
      this._pendingChanges.push(event);
      return;
    }

    // Notify subscribers
    this._notifySubscribers(event);
    this._notifyGlobalListeners(event);
  }

  /**
   * Notify subscribers matching the event path.
   *
   * @param {StateChangeEvent} event - Event
   * @private
   */
  _notifySubscribers(event) {
    for (const [pattern, subs] of this._subscriptions) {
      if (this._pathMatches(event.path, pattern)) {
        for (const sub of subs) {
          try {
            sub.callback(event);
          } catch (error) {
            console.error('StateManager: Subscriber error:', error);
          }
        }
      }
    }
  }

  /**
   * Notify global listeners.
   *
   * @param {StateChangeEvent} event - Event
   * @private
   */
  _notifyGlobalListeners(event) {
    for (const listener of this._globalListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('StateManager: Global listener error:', error);
      }
    }
  }

  /**
   * Check if a path matches a pattern.
   *
   * @param {string} path - Actual path
   * @param {string} pattern - Pattern ('*' matches all, 'foo.*' matches prefix)
   * @returns {boolean} Match
   * @private
   */
  _pathMatches(path, pattern) {
    if (pattern === '*') return true;
    if (pattern === path) return true;

    // Prefix match (e.g., 'views.*' matches 'views.hierarchical.nodes')
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix + '.');
    }

    return false;
  }
}

/**
 * Singleton state manager instance.
 * @type {StateManager}
 */
export const stateManager = new StateManager();
