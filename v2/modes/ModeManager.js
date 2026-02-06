/**
 * Mode Manager
 *
 * Central controller for visualization modes.
 * Handles mode registration, switching, and lifecycle management.
 *
 * Features:
 * - Mode registration and lookup
 * - Lifecycle hooks (onEnter, onExit, onActivate, onDeactivate)
 * - Position caching per mode
 * - Event emission for mode changes
 * - Integration with BaseMode interface
 *
 * @see ARCHITECTURE_PLAN.md Module 5 for full documentation
 */

import { state, save } from '../state.js';
import { BaseMode } from './BaseMode.js';

/**
 * @typedef {Object} ModeChangeEvent
 * @property {string} from - Previous mode ID
 * @property {string} to - New mode ID
 * @property {BaseMode|null} fromInstance - Previous mode instance
 * @property {BaseMode|null} toInstance - New mode instance
 */

/**
 * Mode Manager class.
 * Singleton that manages all visualization modes.
 */
export class ModeManager {
  // =========================================================================
  // Constructor
  // =========================================================================

  constructor() {
    /**
     * Registered mode classes.
     * @type {Map<string, typeof BaseMode>}
     * @private
     */
    this._modeClasses = new Map();

    /**
     * Mode instances (created on first use).
     * @type {Map<string, BaseMode>}
     * @private
     */
    this._modeInstances = new Map();

    /**
     * Current mode ID.
     * @type {string|null}
     * @private
     */
    this._currentModeId = null;

    /**
     * Event listeners.
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._listeners = new Map();

    /**
     * Mode switching in progress.
     * @type {boolean}
     * @private
     */
    this._switching = false;

    /**
     * Render callback.
     * @type {Function|null}
     * @private
     */
    this._renderCallback = null;

    /**
     * Save callback.
     * @type {Function|null}
     * @private
     */
    this._saveCallback = null;

    /**
     * Position cache per mode.
     * @type {Map<string, Map<string, {x: number, y: number}>>}
     * @private
     */
    this._positionCache = new Map();
  }

  // =========================================================================
  // Registration
  // =========================================================================

  /**
   * Register a mode class.
   *
   * @param {typeof BaseMode} ModeClass - Mode class to register
   * @throws {Error} If mode ID already registered or invalid class
   */
  register(ModeClass) {
    if (!ModeClass || !ModeClass.id) {
      throw new Error('Invalid mode class: must have static id property');
    }

    const modeId = ModeClass.id;

    if (this._modeClasses.has(modeId)) {
      console.warn(`Mode "${modeId}" already registered, replacing`);
    }

    this._modeClasses.set(modeId, ModeClass);
    this._positionCache.set(modeId, new Map());

    console.log(`ModeManager: Registered mode "${modeId}"`);
  }

  /**
   * Unregister a mode.
   *
   * @param {string} modeId - Mode ID to unregister
   * @returns {boolean} Whether mode was unregistered
   */
  unregister(modeId) {
    if (!this._modeClasses.has(modeId)) {
      return false;
    }

    // Can't unregister current mode
    if (this._currentModeId === modeId) {
      throw new Error(`Cannot unregister active mode "${modeId}"`);
    }

    // Destroy instance if exists
    const instance = this._modeInstances.get(modeId);
    if (instance) {
      this._modeInstances.delete(modeId);
    }

    this._modeClasses.delete(modeId);
    this._positionCache.delete(modeId);

    console.log(`ModeManager: Unregistered mode "${modeId}"`);
    return true;
  }

  /**
   * Check if a mode is registered.
   *
   * @param {string} modeId - Mode ID to check
   * @returns {boolean}
   */
  isRegistered(modeId) {
    return this._modeClasses.has(modeId);
  }

  /**
   * Get all registered mode IDs.
   *
   * @returns {string[]}
   */
  getRegisteredModes() {
    return Array.from(this._modeClasses.keys());
  }

  /**
   * Get mode info for all registered modes.
   *
   * @returns {Array<Object>}
   */
  getModeInfoList() {
    const infos = [];
    for (const ModeClass of this._modeClasses.values()) {
      infos.push(ModeClass.getInfo());
    }
    return infos;
  }

  // =========================================================================
  // Instance Management
  // =========================================================================

  /**
   * Get or create a mode instance.
   *
   * @param {string} modeId - Mode ID
   * @returns {BaseMode|null} Mode instance or null if not registered
   */
  getInstance(modeId) {
    // Return existing instance
    if (this._modeInstances.has(modeId)) {
      return this._modeInstances.get(modeId);
    }

    // Get mode class
    const ModeClass = this._modeClasses.get(modeId);
    if (!ModeClass) {
      return null;
    }

    // Create new instance with callbacks
    const instance = new ModeClass({
      renderCallback: () => this._triggerRender(),
      saveCallback: () => this._triggerSave()
    });

    // Transfer position cache reference
    instance._positionCache = this._positionCache.get(modeId);

    this._modeInstances.set(modeId, instance);
    return instance;
  }

  /**
   * Get current mode instance.
   *
   * @returns {BaseMode|null}
   */
  getCurrentMode() {
    if (!this._currentModeId) return null;
    return this.getInstance(this._currentModeId);
  }

  /**
   * Get current mode ID.
   *
   * @returns {string|null}
   */
  getCurrentModeId() {
    return this._currentModeId;
  }

  // =========================================================================
  // Mode Switching
  // =========================================================================

  /**
   * Switch to a different mode.
   *
   * @param {string} newModeId - Mode to switch to
   * @param {Object} [options] - Switch options
   * @param {boolean} [options.force] - Force switch even if same mode
   * @param {boolean} [options.skipSave] - Don't save after switch
   * @param {boolean} [options.skipRender] - Don't render after switch
   * @param {Object} [options.modeOptions] - Options to pass to new mode
   * @returns {Promise<boolean>} Whether switch succeeded
   */
  async switchTo(newModeId, options = {}) {
    // Check if already switching
    if (this._switching) {
      console.warn('ModeManager: Mode switch already in progress');
      return false;
    }

    // Check if same mode
    if (newModeId === this._currentModeId && !options.force) {
      return true;
    }

    // Verify mode is registered
    if (!this._modeClasses.has(newModeId)) {
      console.error(`ModeManager: Mode "${newModeId}" not registered`);
      return false;
    }

    this._switching = true;

    try {
      const fromModeId = this._currentModeId;
      const fromInstance = fromModeId ? this.getInstance(fromModeId) : null;
      const toInstance = this.getInstance(newModeId);

      if (!toInstance) {
        throw new Error(`Failed to create instance for mode "${newModeId}"`);
      }

      // Emit beforeChange event
      this._emit('beforeChange', {
        from: fromModeId,
        to: newModeId,
        fromInstance,
        toInstance
      });

      // Exit current mode
      if (fromInstance) {
        // Save positions before leaving
        fromInstance.savePositions();

        // Deactivate
        await fromInstance.onDeactivate();

        // Exit
        await fromInstance.onExit(newModeId);
      }

      // Update current mode
      const previousModeId = this._currentModeId;
      this._currentModeId = newModeId;

      // Update global state (for backward compatibility)
      state.currentMode = newModeId;

      // Enter new mode
      await toInstance.onEnter(previousModeId);

      // Activate
      await toInstance.onActivate();

      // Apply mode options if provided
      if (options.modeOptions) {
        toInstance.setViewState({ modeSpecific: options.modeOptions });
      }

      // Emit afterChange event
      this._emit('afterChange', {
        from: fromModeId,
        to: newModeId,
        fromInstance,
        toInstance
      });

      // Save and render
      if (!options.skipSave) {
        this._triggerSave();
      }
      if (!options.skipRender) {
        this._triggerRender();
      }

      console.log(`ModeManager: Switched from "${fromModeId || 'none'}" to "${newModeId}"`);
      return true;

    } catch (error) {
      console.error('ModeManager: Mode switch failed:', error);

      // Emit error event
      this._emit('error', {
        type: 'switchFailed',
        from: this._currentModeId,
        to: newModeId,
        error
      });

      return false;

    } finally {
      this._switching = false;
    }
  }

  /**
   * Initialize with a starting mode (called on app startup).
   *
   * @param {string} modeId - Initial mode ID
   * @returns {Promise<boolean>}
   */
  async initialize(modeId) {
    if (!this._modeClasses.has(modeId)) {
      console.error(`ModeManager: Cannot initialize with unregistered mode "${modeId}"`);
      return false;
    }

    // Set current mode without triggering exit (nothing to exit from)
    this._currentModeId = modeId;
    state.currentMode = modeId;

    const instance = this.getInstance(modeId);
    if (instance) {
      await instance.onEnter(null);
      await instance.onActivate();
    }

    this._emit('initialized', { mode: modeId });

    console.log(`ModeManager: Initialized with mode "${modeId}"`);
    return true;
  }

  // =========================================================================
  // Mode Delegation
  // =========================================================================

  /**
   * Get nodes from current mode.
   *
   * @returns {Array}
   */
  getNodes() {
    const mode = this.getCurrentMode();
    return mode ? mode.getNodes() : [];
  }

  /**
   * Get connections from current mode.
   *
   * @returns {Array}
   */
  getConnections() {
    const mode = this.getCurrentMode();
    return mode ? mode.getConnections() : [];
  }

  /**
   * Delegate node double-click to current mode.
   *
   * @param {Object} node - Clicked node
   * @param {Event} event - Click event
   */
  handleNodeDoubleClick(node, event) {
    const mode = this.getCurrentMode();
    if (mode) {
      mode.onNodeDoubleClick(node, event);
    }
  }

  /**
   * Delegate canvas double-click to current mode.
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Event} event - Click event
   */
  handleCanvasDoubleClick(x, y, event) {
    const mode = this.getCurrentMode();
    if (mode) {
      mode.onCanvasDoubleClick(x, y, event);
    }
  }

  /**
   * Delegate keyboard event to current mode.
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean} Whether event was handled
   */
  handleKeyDown(event) {
    const mode = this.getCurrentMode();
    return mode ? mode.onKeyDown(event) : false;
  }

  /**
   * Get controls from current mode.
   *
   * @returns {Array}
   */
  getControls() {
    const mode = this.getCurrentMode();
    return mode ? mode.getControls() : [];
  }

  /**
   * Delegate control action to current mode.
   *
   * @param {string} controlId - Control ID
   * @param {*} value - Control value
   */
  handleControlAction(controlId, value) {
    const mode = this.getCurrentMode();
    if (mode) {
      mode.onControlAction(controlId, value);
    }
  }

  /**
   * Apply layout using current mode.
   *
   * @param {Object} [options] - Layout options
   */
  applyLayout(options = {}) {
    const mode = this.getCurrentMode();
    if (mode) {
      mode.applyLayout(options);
      this._triggerRender();
    }
  }

  // =========================================================================
  // Callbacks
  // =========================================================================

  /**
   * Set render callback.
   *
   * @param {Function} callback - Render function
   */
  setRenderCallback(callback) {
    this._renderCallback = callback;
  }

  /**
   * Set save callback.
   *
   * @param {Function} callback - Save function
   */
  setSaveCallback(callback) {
    this._saveCallback = callback;
  }

  /**
   * Trigger render.
   * @private
   */
  _triggerRender() {
    if (this._renderCallback) {
      try {
        this._renderCallback();
      } catch (error) {
        console.error('ModeManager: Render callback error:', error);
      }
    }
  }

  /**
   * Trigger save.
   * @private
   */
  _triggerSave() {
    if (this._saveCallback) {
      try {
        this._saveCallback();
      } catch (error) {
        console.error('ModeManager: Save callback error:', error);
      }
    } else {
      // Fall back to global save
      save();
    }
  }

  // =========================================================================
  // Events
  // =========================================================================

  /**
   * Add event listener.
   *
   * Events:
   * - beforeChange: Before mode switch starts
   * - afterChange: After mode switch completes
   * - error: On mode switch error
   * - initialized: After initial mode is set
   *
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener.
   *
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event.
   *
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`ModeManager: Event "${event}" handler error:`, error);
        }
      }
    }
  }

  // =========================================================================
  // Position Cache Management
  // =========================================================================

  /**
   * Save positions for a mode from external nodes.
   *
   * @param {string} modeId - Mode ID
   * @param {Array} nodes - Nodes to save positions from
   * @param {Object} [positionProps] - Position property names
   */
  savePositionsFromNodes(modeId, nodes, positionProps = { x: 'x', y: 'y' }) {
    const cache = this._positionCache.get(modeId);
    if (!cache) return;

    const saveRecursive = (nodeList) => {
      for (const node of nodeList) {
        cache.set(node.id, {
          x: node[positionProps.x],
          y: node[positionProps.y]
        });
        if (node.children) {
          saveRecursive(node.children);
        }
      }
    };

    saveRecursive(nodes);
  }

  /**
   * Restore positions for a mode to external nodes.
   *
   * @param {string} modeId - Mode ID
   * @param {Array} nodes - Nodes to restore positions to
   * @param {Object} [positionProps] - Position property names
   */
  restorePositionsToNodes(modeId, nodes, positionProps = { x: 'x', y: 'y' }) {
    const cache = this._positionCache.get(modeId);
    if (!cache) return;

    const restoreRecursive = (nodeList) => {
      for (const node of nodeList) {
        const cached = cache.get(node.id);
        if (cached) {
          node[positionProps.x] = cached.x;
          node[positionProps.y] = cached.y;
        }
        if (node.children) {
          restoreRecursive(node.children);
        }
      }
    };

    restoreRecursive(nodes);
  }

  /**
   * Clear position cache for a mode.
   *
   * @param {string} modeId - Mode ID, or null for all modes
   */
  clearPositionCache(modeId = null) {
    if (modeId) {
      this._positionCache.get(modeId)?.clear();
    } else {
      for (const cache of this._positionCache.values()) {
        cache.clear();
      }
    }
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Destroy all mode instances and clear state.
   */
  destroy() {
    // Deactivate and exit current mode
    const currentMode = this.getCurrentMode();
    if (currentMode) {
      currentMode.onDeactivate();
      currentMode.onExit(null);
    }

    // Clear all instances
    this._modeInstances.clear();

    // Clear caches
    for (const cache of this._positionCache.values()) {
      cache.clear();
    }

    // Clear listeners
    this._listeners.clear();

    this._currentModeId = null;

    console.log('ModeManager: Destroyed');
  }
}

/**
 * Singleton ModeManager instance.
 * @type {ModeManager}
 */
export const modeManager = new ModeManager();
