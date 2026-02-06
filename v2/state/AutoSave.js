/**
 * Auto-Save Manager
 *
 * Automatically saves application state with debouncing to prevent
 * excessive writes during rapid changes (e.g., dragging nodes).
 *
 * Features:
 * - Debounced saves (configurable delay)
 * - Dirty tracking (only save when changes exist)
 * - Selective saving (project, views, notes, UI)
 * - Save indicators for UI feedback
 * - Error handling with retry
 * - Manual save/flush capability
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { stateManager } from './StateManager.js';
import { projectStore } from './stores/ProjectStore.js';
import { viewStore } from './stores/ViewStore.js';

/**
 * @typedef {Object} AutoSaveOptions
 * @property {number} [debounceDelay=2000] - Debounce delay in ms
 * @property {number} [maxDelay=30000] - Maximum delay before forced save
 * @property {boolean} [saveProject=true] - Auto-save project data
 * @property {boolean} [saveViews=true] - Auto-save view states
 * @property {boolean} [saveNotes=true] - Auto-save notes
 * @property {boolean} [saveUI=true] - Auto-save UI state
 * @property {Function} [onSaveStart] - Callback when save starts
 * @property {Function} [onSaveComplete] - Callback when save completes
 * @property {Function} [onSaveError] - Callback when save fails
 */

/**
 * @typedef {Object} SaveStatus
 * @property {boolean} saving - Currently saving
 * @property {boolean} dirty - Has unsaved changes
 * @property {number|null} lastSaved - Last save timestamp
 * @property {string|null} lastError - Last error message
 * @property {number} pendingSaves - Number of pending save operations
 */

/**
 * Auto-Save Manager class.
 */
export class AutoSaveManager {
  /**
   * Create a new AutoSaveManager.
   *
   * @param {AutoSaveOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    /**
     * Debounce delay in milliseconds.
     * @type {number}
     */
    this.debounceDelay = options.debounceDelay ?? 2000;

    /**
     * Maximum delay before forced save.
     * @type {number}
     */
    this.maxDelay = options.maxDelay ?? 30000;

    /**
     * Whether to auto-save project data.
     * @type {boolean}
     */
    this.saveProject = options.saveProject !== false;

    /**
     * Whether to auto-save view states.
     * @type {boolean}
     */
    this.saveViews = options.saveViews !== false;

    /**
     * Whether to auto-save notes.
     * @type {boolean}
     */
    this.saveNotes = options.saveNotes !== false;

    /**
     * Whether to auto-save UI state.
     * @type {boolean}
     */
    this.saveUI = options.saveUI !== false;

    /**
     * Callback when save starts.
     * @type {Function|null}
     */
    this.onSaveStart = options.onSaveStart || null;

    /**
     * Callback when save completes.
     * @type {Function|null}
     */
    this.onSaveComplete = options.onSaveComplete || null;

    /**
     * Callback when save fails.
     * @type {Function|null}
     */
    this.onSaveError = options.onSaveError || null;

    /**
     * Debounce timer ID.
     * @type {number|null}
     * @private
     */
    this._debounceTimer = null;

    /**
     * Max delay timer ID.
     * @type {number|null}
     * @private
     */
    this._maxDelayTimer = null;

    /**
     * First change timestamp (for max delay).
     * @type {number|null}
     * @private
     */
    this._firstChangeTime = null;

    /**
     * Whether auto-save is enabled.
     * @type {boolean}
     * @private
     */
    this._enabled = false;

    /**
     * Currently saving flag.
     * @type {boolean}
     * @private
     */
    this._saving = false;

    /**
     * Dirty flags by category.
     * @type {Object<string, boolean>}
     * @private
     */
    this._dirty = {
      project: false,
      hierarchical: false,
      flow: false,
      notes: false,
      ui: false
    };

    /**
     * Last save timestamp.
     * @type {number|null}
     * @private
     */
    this._lastSaved = null;

    /**
     * Last error message.
     * @type {string|null}
     * @private
     */
    this._lastError = null;

    /**
     * State subscription ID.
     * @type {string|null}
     * @private
     */
    this._subscriptionId = null;

    /**
     * Pending save count.
     * @type {number}
     * @private
     */
    this._pendingSaves = 0;
  }

  /**
   * Start auto-save monitoring.
   *
   * @returns {void}
   */
  start() {
    if (this._enabled) return;

    this._enabled = true;

    // Subscribe to all state changes
    this._subscriptionId = stateManager.subscribe('*', (event) => {
      this._handleStateChange(event);
    });

    console.log('AutoSave: Started monitoring');
  }

  /**
   * Stop auto-save monitoring.
   *
   * @param {Object} [options] - Options
   * @param {boolean} [options.flush=true] - Save pending changes before stopping
   * @returns {Promise<void>}
   */
  async stop(options = {}) {
    if (!this._enabled) return;

    const { flush = true } = options;

    // Flush pending changes
    if (flush && this.isDirty()) {
      await this.saveNow();
    }

    // Clear timers
    this._clearTimers();

    // Unsubscribe
    if (this._subscriptionId) {
      stateManager.unsubscribe(this._subscriptionId);
      this._subscriptionId = null;
    }

    this._enabled = false;
    console.log('AutoSave: Stopped monitoring');
  }

  /**
   * Check if auto-save is enabled.
   *
   * @returns {boolean} Enabled state
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Check if there are unsaved changes.
   *
   * @returns {boolean} Has unsaved changes
   */
  isDirty() {
    return Object.values(this._dirty).some(Boolean);
  }

  /**
   * Get detailed dirty status.
   *
   * @returns {Object<string, boolean>} Dirty flags by category
   */
  getDirtyStatus() {
    return { ...this._dirty };
  }

  /**
   * Get current save status.
   *
   * @returns {SaveStatus} Status
   */
  getStatus() {
    return {
      saving: this._saving,
      dirty: this.isDirty(),
      lastSaved: this._lastSaved,
      lastError: this._lastError,
      pendingSaves: this._pendingSaves
    };
  }

  /**
   * Mark a category as dirty (needs saving).
   *
   * @param {string} category - Category to mark dirty
   */
  markDirty(category) {
    if (category in this._dirty) {
      this._dirty[category] = true;
      this._scheduleSave();
    }
  }

  /**
   * Clear dirty flag for a category.
   *
   * @param {string} category - Category to clear
   */
  clearDirty(category) {
    if (category in this._dirty) {
      this._dirty[category] = false;
    }
  }

  /**
   * Clear all dirty flags.
   */
  clearAllDirty() {
    for (const key in this._dirty) {
      this._dirty[key] = false;
    }
  }

  /**
   * Save immediately (bypass debounce).
   *
   * @returns {Promise<boolean>} Success
   */
  async saveNow() {
    this._clearTimers();
    return this._performSave();
  }

  /**
   * Schedule a debounced save.
   * @private
   */
  _scheduleSave() {
    if (!this._enabled) return;

    // Record first change time for max delay
    if (!this._firstChangeTime) {
      this._firstChangeTime = Date.now();

      // Set max delay timer
      this._maxDelayTimer = setTimeout(() => {
        this._performSave();
      }, this.maxDelay);
    }

    // Clear existing debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    // Set new debounce timer
    this._debounceTimer = setTimeout(() => {
      this._performSave();
    }, this.debounceDelay);
  }

  /**
   * Clear all timers.
   * @private
   */
  _clearTimers() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._maxDelayTimer) {
      clearTimeout(this._maxDelayTimer);
      this._maxDelayTimer = null;
    }
    this._firstChangeTime = null;
  }

  /**
   * Handle state change event.
   *
   * @param {Object} event - State change event
   * @private
   */
  _handleStateChange(event) {
    const { path, action } = event;

    // Skip certain actions
    if (action === 'initial' || action === 'rollback') {
      return;
    }

    // Determine category from path
    if (path.startsWith('project')) {
      this._dirty.project = true;
    } else if (path.startsWith('views.hierarchical')) {
      this._dirty.hierarchical = true;
    } else if (path.startsWith('views.flow')) {
      this._dirty.flow = true;
    } else if (path.startsWith('views.notes')) {
      this._dirty.notes = true;
    } else if (path.startsWith('ui')) {
      this._dirty.ui = true;
    } else if (path === '*') {
      // Full state change - mark everything dirty
      this._dirty.project = true;
      this._dirty.hierarchical = true;
      this._dirty.flow = true;
      this._dirty.notes = true;
      this._dirty.ui = true;
    }

    // Schedule save if anything is dirty
    if (this.isDirty()) {
      this._scheduleSave();
    }
  }

  /**
   * Perform the actual save operation.
   *
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _performSave() {
    if (this._saving) {
      // Already saving - will be rescheduled if still dirty
      return false;
    }

    if (!this.isDirty()) {
      this._clearTimers();
      return true;
    }

    this._saving = true;
    this._pendingSaves++;
    this._lastError = null;

    // Notify start
    if (this.onSaveStart) {
      try {
        this.onSaveStart(this.getDirtyStatus());
      } catch (e) {
        console.warn('AutoSave: onSaveStart callback error:', e);
      }
    }

    const saveResults = {
      project: null,
      views: null,
      notes: null,
      ui: null
    };

    try {
      // Save project
      if (this.saveProject && this._dirty.project) {
        const projectData = projectStore.getCurrentProject();
        if (projectData) {
          saveResults.project = await projectStore.saveProject(projectData);
          if (saveResults.project) {
            this._dirty.project = false;
          }
        } else {
          this._dirty.project = false; // No project to save
        }
      }

      // Save view states
      if (this.saveViews && (this._dirty.hierarchical || this._dirty.flow)) {
        const projectId = projectStore.getCurrentProjectId();
        if (projectId) {
          saveResults.views = await viewStore.saveViewState(projectId);
          if (saveResults.views) {
            this._dirty.hierarchical = false;
            this._dirty.flow = false;
          }
        } else {
          // No project - clear dirty flags
          this._dirty.hierarchical = false;
          this._dirty.flow = false;
        }
      }

      // Save notes (global, not per-project)
      if (this.saveNotes && this._dirty.notes) {
        saveResults.notes = await viewStore.saveNotes();
        if (saveResults.notes) {
          this._dirty.notes = false;
        }
      }

      // Save UI state
      if (this.saveUI && this._dirty.ui) {
        saveResults.ui = await viewStore.saveUIState();
        if (saveResults.ui) {
          this._dirty.ui = false;
        }
      }

      this._lastSaved = Date.now();
      this._clearTimers();

      // Notify complete
      if (this.onSaveComplete) {
        try {
          this.onSaveComplete(saveResults, this._lastSaved);
        } catch (e) {
          console.warn('AutoSave: onSaveComplete callback error:', e);
        }
      }

      return true;
    } catch (error) {
      this._lastError = error.message;
      console.error('AutoSave: Save failed:', error);

      // Notify error
      if (this.onSaveError) {
        try {
          this.onSaveError(error);
        } catch (e) {
          console.warn('AutoSave: onSaveError callback error:', e);
        }
      }

      // Reschedule save on error
      this._scheduleSave();

      return false;
    } finally {
      this._saving = false;
      this._pendingSaves--;
    }
  }

  /**
   * Update configuration.
   *
   * @param {Partial<AutoSaveOptions>} options - Options to update
   */
  configure(options) {
    if (options.debounceDelay !== undefined) {
      this.debounceDelay = options.debounceDelay;
    }
    if (options.maxDelay !== undefined) {
      this.maxDelay = options.maxDelay;
    }
    if (options.saveProject !== undefined) {
      this.saveProject = options.saveProject;
    }
    if (options.saveViews !== undefined) {
      this.saveViews = options.saveViews;
    }
    if (options.saveNotes !== undefined) {
      this.saveNotes = options.saveNotes;
    }
    if (options.saveUI !== undefined) {
      this.saveUI = options.saveUI;
    }
    if (options.onSaveStart !== undefined) {
      this.onSaveStart = options.onSaveStart;
    }
    if (options.onSaveComplete !== undefined) {
      this.onSaveComplete = options.onSaveComplete;
    }
    if (options.onSaveError !== undefined) {
      this.onSaveError = options.onSaveError;
    }
  }

  /**
   * Get time since last save.
   *
   * @returns {number|null} Milliseconds since last save, or null if never saved
   */
  getTimeSinceLastSave() {
    if (!this._lastSaved) return null;
    return Date.now() - this._lastSaved;
  }

  /**
   * Format last saved time for display.
   *
   * @returns {string} Formatted time string
   */
  getLastSavedDisplay() {
    if (!this._lastSaved) {
      return 'Never saved';
    }

    const elapsed = this.getTimeSinceLastSave();

    if (elapsed < 5000) {
      return 'Just saved';
    } else if (elapsed < 60000) {
      const seconds = Math.floor(elapsed / 1000);
      return `Saved ${seconds}s ago`;
    } else if (elapsed < 3600000) {
      const minutes = Math.floor(elapsed / 60000);
      return `Saved ${minutes}m ago`;
    } else {
      const date = new Date(this._lastSaved);
      return `Saved at ${date.toLocaleTimeString()}`;
    }
  }
}

/**
 * Default AutoSaveManager instance.
 * @type {AutoSaveManager}
 */
export const autoSaveManager = new AutoSaveManager();

/**
 * Convenience function to start auto-save with default settings.
 *
 * @param {AutoSaveOptions} [options] - Options
 * @returns {AutoSaveManager} The manager instance
 */
export function startAutoSave(options = {}) {
  autoSaveManager.configure(options);
  autoSaveManager.start();
  return autoSaveManager;
}

/**
 * Convenience function to stop auto-save.
 *
 * @param {Object} [options] - Options
 * @returns {Promise<void>}
 */
export async function stopAutoSave(options = {}) {
  await autoSaveManager.stop(options);
}
