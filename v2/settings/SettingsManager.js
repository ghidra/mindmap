/**
 * Settings Manager
 *
 * Centralized settings management with localStorage persistence.
 * Provides getters, setters, and change notifications.
 *
 * @see ARCHITECTURE_PLAN.md Module 8.1 for full documentation
 */

/**
 * LocalStorage key for settings.
 * @type {string}
 */
const STORAGE_KEY = 'mindmap-settings';

/**
 * Settings version for migration.
 * @type {number}
 */
const SETTINGS_VERSION = 1;

/**
 * Default settings.
 * @type {Object}
 */
const DEFAULT_SETTINGS = {
  // Version for migration
  version: SETTINGS_VERSION,

  // Appearance
  theme: 'system',              // 'light' | 'dark' | 'system'
  nodeDefaultWidth: 180,
  nodeDefaultHeight: 100,
  connectionStyle: 'bezier',    // 'bezier' | 'straight' | 'step'
  animateConnections: false,
  showPortLabels: true,
  showConnectionLabels: true,

  // Behavior
  autoSave: true,
  autoSaveInterval: 30000,      // ms
  snapToGrid: false,
  gridSize: 20,
  confirmDelete: true,
  doubleClickToEdit: true,

  // Editor
  showMinimap: true,
  minimapPosition: 'bottom-right',  // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  panSensitivity: 1.0,
  zoomSensitivity: 1.0,
  minZoom: 0.3,
  maxZoom: 3.0,

  // Parser
  excludePatterns: ['node_modules', '.git', 'dist', 'build'],
  maxFileSize: 1024 * 1024,     // 1MB
  parseOnLoad: true,

  // Recent projects
  recentProjects: [],
  maxRecentProjects: 10
};

/**
 * Settings Manager class.
 */
export class SettingsManager {
  /**
   * Create a new SettingsManager instance.
   */
  constructor() {
    /**
     * Current settings.
     * @type {Object}
     * @private
     */
    this._settings = { ...DEFAULT_SETTINGS };

    /**
     * Change listeners.
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._listeners = new Map();

    /**
     * Global listeners (called for any change).
     * @type {Set<Function>}
     * @private
     */
    this._globalListeners = new Set();

    /**
     * Whether settings have been loaded.
     * @type {boolean}
     * @private
     */
    this._loaded = false;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the settings manager.
   * Loads settings from localStorage.
   */
  init() {
    this.load();
    this._loaded = true;
    console.log('SettingsManager initialized');
  }

  /**
   * Load settings from localStorage.
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Migrate if needed
        const migrated = this._migrate(parsed);

        // Merge with defaults (to get any new settings)
        this._settings = { ...DEFAULT_SETTINGS, ...migrated };
      }
    } catch (error) {
      console.warn('SettingsManager: Failed to load settings:', error);
      this._settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to localStorage.
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
    } catch (error) {
      console.error('SettingsManager: Failed to save settings:', error);
    }
  }

  /**
   * Migrate settings from older versions.
   *
   * @param {Object} settings - Settings to migrate
   * @returns {Object} Migrated settings
   * @private
   */
  _migrate(settings) {
    const version = settings.version || 0;

    // Migration from v0 to v1
    if (version < 1) {
      // Example migration: rename old keys
      if (settings.darkMode !== undefined) {
        settings.theme = settings.darkMode ? 'dark' : 'light';
        delete settings.darkMode;
      }
      settings.version = 1;
    }

    // Future migrations would go here...

    return settings;
  }

  // =========================================================================
  // Getters
  // =========================================================================

  /**
   * Get a setting value.
   *
   * @param {string} key - Setting key (supports dot notation: 'appearance.theme')
   * @param {*} [defaultValue] - Default value if setting doesn't exist
   * @returns {*} Setting value
   */
  get(key, defaultValue = undefined) {
    const value = this._getNestedValue(this._settings, key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Get all settings.
   *
   * @returns {Object} Copy of all settings
   */
  getAll() {
    return { ...this._settings };
  }

  /**
   * Get a nested value from an object.
   *
   * @param {Object} obj - Object to get value from
   * @param {string} path - Dot-notation path
   * @returns {*} Value at path
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => {
      return curr && curr[key] !== undefined ? curr[key] : undefined;
    }, obj);
  }

  // =========================================================================
  // Setters
  // =========================================================================

  /**
   * Set a setting value.
   *
   * @param {string} key - Setting key
   * @param {*} value - Value to set
   * @param {boolean} [save=true] - Whether to save to localStorage
   */
  set(key, value, save = true) {
    const oldValue = this.get(key);

    if (oldValue === value) return;

    this._setNestedValue(this._settings, key, value);

    if (save) {
      this.save();
    }

    this._notifyListeners(key, value, oldValue);
  }

  /**
   * Set multiple settings at once.
   *
   * @param {Object} settings - Settings to set
   * @param {boolean} [save=true] - Whether to save to localStorage
   */
  setMultiple(settings, save = true) {
    const changes = [];

    for (const [key, value] of Object.entries(settings)) {
      const oldValue = this.get(key);
      if (oldValue !== value) {
        this._setNestedValue(this._settings, key, value);
        changes.push({ key, value, oldValue });
      }
    }

    if (save) {
      this.save();
    }

    // Notify listeners for each change
    for (const { key, value, oldValue } of changes) {
      this._notifyListeners(key, value, oldValue);
    }
  }

  /**
   * Set a nested value in an object.
   *
   * @param {Object} obj - Object to set value in
   * @param {string} path - Dot-notation path
   * @param {*} value - Value to set
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((curr, key) => {
      if (curr[key] === undefined) {
        curr[key] = {};
      }
      return curr[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Reset a setting to its default value.
   *
   * @param {string} key - Setting key
   */
  reset(key) {
    const defaultValue = this._getNestedValue(DEFAULT_SETTINGS, key);
    this.set(key, defaultValue);
  }

  /**
   * Reset all settings to defaults.
   */
  resetAll() {
    const changes = [];

    for (const key of Object.keys(this._settings)) {
      if (key === 'version') continue;
      const oldValue = this._settings[key];
      const newValue = DEFAULT_SETTINGS[key];
      if (oldValue !== newValue) {
        changes.push({ key, value: newValue, oldValue });
      }
    }

    this._settings = { ...DEFAULT_SETTINGS };
    this.save();

    // Notify listeners
    for (const { key, value, oldValue } of changes) {
      this._notifyListeners(key, value, oldValue);
    }
  }

  // =========================================================================
  // Listeners
  // =========================================================================

  /**
   * Add a listener for setting changes.
   *
   * @param {string|null} key - Setting key to watch, or null for all changes
   * @param {Function} callback - Called with (key, newValue, oldValue)
   * @returns {Function} Unsubscribe function
   */
  onChange(key, callback) {
    if (key === null) {
      this._globalListeners.add(callback);
      return () => this._globalListeners.delete(callback);
    }

    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Notify listeners of a change.
   *
   * @param {string} key - Changed key
   * @param {*} newValue - New value
   * @param {*} oldValue - Old value
   * @private
   */
  _notifyListeners(key, newValue, oldValue) {
    // Notify key-specific listeners
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(key, newValue, oldValue);
        } catch (error) {
          console.error('SettingsManager: Listener error:', error);
        }
      });
    }

    // Notify global listeners
    this._globalListeners.forEach(callback => {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error('SettingsManager: Global listener error:', error);
      }
    });
  }

  // =========================================================================
  // Convenience Methods
  // =========================================================================

  /**
   * Check if a boolean setting is enabled.
   *
   * @param {string} key - Setting key
   * @returns {boolean}
   */
  isEnabled(key) {
    return this.get(key) === true;
  }

  /**
   * Toggle a boolean setting.
   *
   * @param {string} key - Setting key
   * @returns {boolean} New value
   */
  toggle(key) {
    const current = this.get(key);
    const newValue = !current;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Get the default value for a setting.
   *
   * @param {string} key - Setting key
   * @returns {*} Default value
   */
  getDefault(key) {
    return this._getNestedValue(DEFAULT_SETTINGS, key);
  }

  /**
   * Check if a setting has been modified from default.
   *
   * @param {string} key - Setting key
   * @returns {boolean}
   */
  isModified(key) {
    return this.get(key) !== this.getDefault(key);
  }

  // =========================================================================
  // Recent Projects
  // =========================================================================

  /**
   * Add a project to recent projects.
   *
   * @param {string} path - Project path
   * @param {string} [name] - Project name
   */
  addRecentProject(path, name = null) {
    const recent = this.get('recentProjects') || [];

    // Remove if already exists
    const filtered = recent.filter(p => p.path !== path);

    // Add to front
    filtered.unshift({
      path,
      name: name || path.split('/').pop(),
      openedAt: new Date().toISOString()
    });

    // Trim to max
    const maxRecent = this.get('maxRecentProjects');
    const trimmed = filtered.slice(0, maxRecent);

    this.set('recentProjects', trimmed);
  }

  /**
   * Get recent projects.
   *
   * @returns {Array} Recent projects
   */
  getRecentProjects() {
    return this.get('recentProjects') || [];
  }

  /**
   * Clear recent projects.
   */
  clearRecentProjects() {
    this.set('recentProjects', []);
  }

  // =========================================================================
  // Export/Import
  // =========================================================================

  /**
   * Export settings to JSON.
   *
   * @returns {string} JSON string
   */
  export() {
    return JSON.stringify(this._settings, null, 2);
  }

  /**
   * Import settings from JSON.
   *
   * @param {string} json - JSON string
   */
  import(json) {
    try {
      const settings = JSON.parse(json);
      const migrated = this._migrate(settings);
      this._settings = { ...DEFAULT_SETTINGS, ...migrated };
      this.save();

      // Notify all listeners
      this._globalListeners.forEach(callback => {
        try {
          callback('*', this._settings, null);
        } catch (error) {
          console.error('SettingsManager: Import listener error:', error);
        }
      });
    } catch (error) {
      throw new Error('Invalid settings JSON: ' + error.message);
    }
  }
}

/**
 * Singleton settings manager instance.
 * @type {SettingsManager}
 */
export const settingsManager = new SettingsManager();

/**
 * Default settings export for reference.
 * @type {Object}
 */
export { DEFAULT_SETTINGS };
