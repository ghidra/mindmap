/**
 * State Serializer
 *
 * Handles serialization and deserialization of application state
 * with versioning support for backwards compatibility and migrations.
 *
 * Responsibilities:
 * - Serialize complete application state to JSON
 * - Deserialize state with version migration
 * - Validate state structure
 * - Handle Map/Set conversion for JSON compatibility
 * - Compress/decompress state (optional)
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

/**
 * Current serialization format version.
 * Increment when making breaking changes to the state structure.
 * @type {number}
 */
export const FORMAT_VERSION = 1;

/**
 * @typedef {Object} SerializedState
 * @property {number} version - Format version
 * @property {number} timestamp - Serialization timestamp
 * @property {Object} project - Project data
 * @property {Object} views - View states
 * @property {Object} ui - UI state
 * @property {Object} preferences - User preferences
 */

/**
 * @typedef {Object} SerializerOptions
 * @property {boolean} [includeProject=true] - Include project data
 * @property {boolean} [includeViews=true] - Include view states
 * @property {boolean} [includeUI=true] - Include UI state
 * @property {boolean} [includePreferences=true] - Include preferences
 * @property {boolean} [compress=false] - Compress output
 * @property {boolean} [pretty=false] - Pretty-print JSON
 */

/**
 * State Serializer class.
 */
export class Serializer {
  /**
   * Serialize state to a JSON-compatible object.
   *
   * @param {Object} state - State object from StateManager
   * @param {SerializerOptions} [options] - Serialization options
   * @returns {SerializedState} Serialized state
   */
  serialize(state, options = {}) {
    const {
      includeProject = true,
      includeViews = true,
      includeUI = true,
      includePreferences = true
    } = options;

    const serialized = {
      version: FORMAT_VERSION,
      timestamp: Date.now()
    };

    if (includeProject && state.project) {
      serialized.project = this._serializeProject(state.project);
    }

    if (includeViews && state.views) {
      serialized.views = this._serializeViews(state.views);
    }

    if (includeUI && state.ui) {
      serialized.ui = this._serializeUI(state.ui);
    }

    if (includePreferences && state.preferences) {
      serialized.preferences = { ...state.preferences };
    }

    return serialized;
  }

  /**
   * Deserialize state from a serialized object.
   *
   * @param {SerializedState} data - Serialized state
   * @returns {Object} Deserialized state
   * @throws {Error} If data is invalid
   */
  deserialize(data) {
    // Validate
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid state data: ${validation.errors.join(', ')}`);
    }

    // Migrate if needed
    let migrated = data;
    if (data.version < FORMAT_VERSION) {
      migrated = this._migrate(data);
    }

    // Deserialize
    const state = {};

    if (migrated.project) {
      state.project = this._deserializeProject(migrated.project);
    }

    if (migrated.views) {
      state.views = this._deserializeViews(migrated.views);
    }

    if (migrated.ui) {
      state.ui = this._deserializeUI(migrated.ui);
    }

    if (migrated.preferences) {
      state.preferences = { ...migrated.preferences };
    }

    return state;
  }

  /**
   * Serialize state to JSON string.
   *
   * @param {Object} state - State object
   * @param {SerializerOptions} [options] - Options
   * @returns {string} JSON string
   */
  toJSON(state, options = {}) {
    const serialized = this.serialize(state, options);
    const indent = options.pretty ? 2 : undefined;
    let json = JSON.stringify(serialized, null, indent);

    if (options.compress) {
      json = this._compress(json);
    }

    return json;
  }

  /**
   * Deserialize state from JSON string.
   *
   * @param {string} json - JSON string
   * @param {Object} [options] - Options
   * @returns {Object} Deserialized state
   */
  fromJSON(json, options = {}) {
    let data = json;

    if (options.compress || this._isCompressed(json)) {
      data = this._decompress(json);
    }

    const parsed = JSON.parse(data);
    return this.deserialize(parsed);
  }

  /**
   * Validate serialized state structure.
   *
   * @param {*} data - Data to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { valid: false, errors };
    }

    if (typeof data.version !== 'number') {
      errors.push('Missing or invalid version');
    } else if (data.version > FORMAT_VERSION) {
      errors.push(`Version ${data.version} is newer than supported ${FORMAT_VERSION}`);
    }

    if (data.project && typeof data.project !== 'object') {
      errors.push('Project must be an object');
    }

    if (data.views && typeof data.views !== 'object') {
      errors.push('Views must be an object');
    }

    if (data.ui && typeof data.ui !== 'object') {
      errors.push('UI must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate approximate size of serialized state.
   *
   * @param {Object} state - State object
   * @param {SerializerOptions} [options] - Options
   * @returns {number} Size in bytes
   */
  calculateSize(state, options = {}) {
    const json = this.toJSON(state, options);
    return json.length * 2; // UTF-16 bytes
  }

  /**
   * Create a partial state snapshot.
   *
   * @param {Object} state - State object
   * @param {string[]} paths - State paths to include
   * @returns {Object} Partial state
   */
  createSnapshot(state, paths) {
    const snapshot = {
      version: FORMAT_VERSION,
      timestamp: Date.now(),
      partial: true,
      paths
    };

    for (const path of paths) {
      const value = this._getPath(state, path);
      if (value !== undefined) {
        this._setPath(snapshot, path, this._serializeValue(value));
      }
    }

    return snapshot;
  }

  /**
   * Apply a partial snapshot to state.
   *
   * @param {Object} state - Target state object
   * @param {Object} snapshot - Partial snapshot
   * @returns {Object} Updated state
   */
  applySnapshot(state, snapshot) {
    if (!snapshot.partial || !snapshot.paths) {
      throw new Error('Not a partial snapshot');
    }

    const updated = { ...state };

    for (const path of snapshot.paths) {
      const value = this._getPath(snapshot, path);
      if (value !== undefined) {
        this._setPath(updated, path, this._deserializeValue(value));
      }
    }

    return updated;
  }

  // =========================================================================
  // Serialization Helpers
  // =========================================================================

  /**
   * Serialize project data.
   *
   * @param {Object} project - Project state
   * @returns {Object} Serialized project
   * @private
   */
  _serializeProject(project) {
    const serialized = {
      id: project.id,
      name: project.name,
      loadedAt: project.loadedAt
    };

    if (project.data) {
      serialized.data = this._serializeProjectData(project.data);
    }

    return serialized;
  }

  /**
   * Serialize project data (from parser).
   *
   * @param {Object} data - Project data
   * @returns {Object} Serialized data
   * @private
   */
  _serializeProjectData(data) {
    const serialized = {
      id: data.id,
      name: data.name,
      rootPath: data.rootPath,
      parsedAt: data.parsedAt,
      stats: data.stats ? { ...data.stats } : null,
      errors: data.errors ? [...data.errors] : []
    };

    // Convert files Map to object
    if (data.files) {
      if (data.files instanceof Map) {
        serialized.files = {};
        for (const [key, value] of data.files) {
          serialized.files[key] = value;
        }
      } else {
        serialized.files = { ...data.files };
      }
    }

    // Serialize graph
    if (data.graph) {
      serialized.graph = {
        nodes: data.graph.nodes ? [...data.graph.nodes] : [],
        edges: data.graph.edges ? [...data.graph.edges] : []
      };
    }

    return serialized;
  }

  /**
   * Serialize views state.
   *
   * @param {Object} views - Views state
   * @returns {Object} Serialized views
   * @private
   */
  _serializeViews(views) {
    const serialized = {};

    for (const [mode, viewState] of Object.entries(views)) {
      serialized[mode] = this._serializeViewState(viewState);
    }

    return serialized;
  }

  /**
   * Serialize a single view state.
   *
   * @param {Object} viewState - View state
   * @returns {Object} Serialized view state
   * @private
   */
  _serializeViewState(viewState) {
    const serialized = {};

    for (const [key, value] of Object.entries(viewState)) {
      serialized[key] = this._serializeValue(value);
    }

    return serialized;
  }

  /**
   * Serialize UI state.
   *
   * @param {Object} ui - UI state
   * @returns {Object} Serialized UI
   * @private
   */
  _serializeUI(ui) {
    return {
      currentMode: ui.currentMode,
      selectedNodes: ui.selectedNodes ? [...ui.selectedNodes] : [],
      activePanel: ui.activePanel,
      theme: ui.theme
    };
  }

  /**
   * Serialize a value (handle Maps, Sets, etc.).
   *
   * @param {*} value - Value to serialize
   * @returns {*} Serialized value
   * @private
   */
  _serializeValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Map) {
      return {
        __type: 'Map',
        data: Array.from(value.entries())
      };
    }

    if (value instanceof Set) {
      return {
        __type: 'Set',
        data: Array.from(value)
      };
    }

    if (value instanceof Date) {
      return {
        __type: 'Date',
        data: value.toISOString()
      };
    }

    if (Array.isArray(value)) {
      return value.map(v => this._serializeValue(v));
    }

    if (typeof value === 'object') {
      const serialized = {};
      for (const [k, v] of Object.entries(value)) {
        serialized[k] = this._serializeValue(v);
      }
      return serialized;
    }

    return value;
  }

  // =========================================================================
  // Deserialization Helpers
  // =========================================================================

  /**
   * Deserialize project data.
   *
   * @param {Object} data - Serialized project
   * @returns {Object} Deserialized project
   * @private
   */
  _deserializeProject(data) {
    const deserialized = {
      id: data.id,
      name: data.name,
      loadedAt: data.loadedAt,
      data: null
    };

    if (data.data) {
      deserialized.data = this._deserializeProjectData(data.data);
    }

    return deserialized;
  }

  /**
   * Deserialize project data (to parser format).
   *
   * @param {Object} data - Serialized project data
   * @returns {Object} Deserialized data
   * @private
   */
  _deserializeProjectData(data) {
    const deserialized = {
      id: data.id,
      name: data.name,
      rootPath: data.rootPath,
      parsedAt: data.parsedAt,
      stats: data.stats ? { ...data.stats } : null,
      errors: data.errors ? [...data.errors] : []
    };

    // Convert files object to Map
    if (data.files) {
      deserialized.files = new Map();
      for (const [key, value] of Object.entries(data.files)) {
        deserialized.files.set(key, value);
      }
    }

    // Deserialize graph
    if (data.graph) {
      deserialized.graph = {
        nodes: data.graph.nodes ? [...data.graph.nodes] : [],
        edges: data.graph.edges ? [...data.graph.edges] : []
      };
    }

    return deserialized;
  }

  /**
   * Deserialize views state.
   *
   * @param {Object} data - Serialized views
   * @returns {Object} Deserialized views
   * @private
   */
  _deserializeViews(data) {
    const deserialized = {};

    for (const [mode, viewState] of Object.entries(data)) {
      deserialized[mode] = this._deserializeViewState(viewState);
    }

    return deserialized;
  }

  /**
   * Deserialize a single view state.
   *
   * @param {Object} data - Serialized view state
   * @returns {Object} Deserialized view state
   * @private
   */
  _deserializeViewState(data) {
    const deserialized = {};

    for (const [key, value] of Object.entries(data)) {
      deserialized[key] = this._deserializeValue(value);
    }

    return deserialized;
  }

  /**
   * Deserialize UI state.
   *
   * @param {Object} data - Serialized UI
   * @returns {Object} Deserialized UI
   * @private
   */
  _deserializeUI(data) {
    return {
      currentMode: data.currentMode || 'hierarchical',
      selectedNodes: data.selectedNodes ? [...data.selectedNodes] : [],
      activePanel: data.activePanel || null,
      theme: data.theme || 'dark'
    };
  }

  /**
   * Deserialize a value (handle special types).
   *
   * @param {*} value - Serialized value
   * @returns {*} Deserialized value
   * @private
   */
  _deserializeValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object' && value.__type) {
      switch (value.__type) {
        case 'Map':
          return new Map(value.data);
        case 'Set':
          return new Set(value.data);
        case 'Date':
          return new Date(value.data);
      }
    }

    if (Array.isArray(value)) {
      return value.map(v => this._deserializeValue(v));
    }

    if (typeof value === 'object') {
      const deserialized = {};
      for (const [k, v] of Object.entries(value)) {
        deserialized[k] = this._deserializeValue(v);
      }
      return deserialized;
    }

    return value;
  }

  // =========================================================================
  // Migration
  // =========================================================================

  /**
   * Migrate state from older version to current.
   *
   * @param {Object} data - Serialized state
   * @returns {Object} Migrated state
   * @private
   */
  _migrate(data) {
    let migrated = { ...data };
    let version = data.version || 0;

    // Apply migrations sequentially
    while (version < FORMAT_VERSION) {
      const migration = this._getMigration(version, version + 1);
      if (migration) {
        migrated = migration(migrated);
      }
      version++;
    }

    migrated.version = FORMAT_VERSION;
    return migrated;
  }

  /**
   * Get migration function for a version transition.
   *
   * @param {number} fromVersion - Source version
   * @param {number} toVersion - Target version
   * @returns {Function|null} Migration function or null
   * @private
   */
  _getMigration(fromVersion, toVersion) {
    const migrations = {
      // Example migration from v0 to v1
      '0->1': (data) => {
        // Add default structure if missing
        return {
          ...data,
          views: data.views || {
            hierarchical: { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 }, path: [], selection: [] },
            flow: { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 }, focusedNode: null, navigationStack: [], executionGraph: null, flowType: 'entry-point' },
            notes: { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } }
          },
          ui: data.ui || { currentMode: 'hierarchical', selectedNodes: [], activePanel: null, theme: 'dark' },
          preferences: data.preferences || { autoSave: true, autoSaveInterval: 30000, shortcuts: {} }
        };
      }
      // Add more migrations as needed:
      // '1->2': (data) => { ... }
    };

    return migrations[`${fromVersion}->${toVersion}`] || null;
  }

  // =========================================================================
  // Compression (simple LZ-style)
  // =========================================================================

  /**
   * Compress a JSON string.
   *
   * @param {string} json - JSON string
   * @returns {string} Compressed string
   * @private
   */
  _compress(json) {
    // Simple compression using btoa (base64)
    // For real compression, use pako or similar
    try {
      const compressed = btoa(encodeURIComponent(json));
      return `__compressed__${compressed}`;
    } catch {
      return json;
    }
  }

  /**
   * Decompress a compressed string.
   *
   * @param {string} data - Compressed string
   * @returns {string} Decompressed JSON
   * @private
   */
  _decompress(data) {
    if (!this._isCompressed(data)) {
      return data;
    }

    try {
      const compressed = data.slice('__compressed__'.length);
      return decodeURIComponent(atob(compressed));
    } catch {
      return data;
    }
  }

  /**
   * Check if data is compressed.
   *
   * @param {string} data - Data to check
   * @returns {boolean} Is compressed
   * @private
   */
  _isCompressed(data) {
    return typeof data === 'string' && data.startsWith('__compressed__');
  }

  // =========================================================================
  // Path Utilities
  // =========================================================================

  /**
   * Get value at path.
   *
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @returns {*} Value
   * @private
   */
  _getPath(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set value at path.
   *
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @private
   */
  _setPath(obj, path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = obj;

    for (const part of parts) {
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }
}

/**
 * Singleton Serializer instance.
 * @type {Serializer}
 */
export const serializer = new Serializer();
