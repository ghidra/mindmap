/**
 * Project Serializer
 *
 * Handles serialization and deserialization of ProjectData.
 * Converts between runtime objects (with Maps) and JSON-serializable format.
 * Supports versioning for forward compatibility.
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

/**
 * Current serialization format version.
 * Increment when making breaking changes to the format.
 * @type {number}
 */
const FORMAT_VERSION = 1;

/**
 * @typedef {Object} SerializedProjectData
 * @property {number} version - Format version
 * @property {string} id - Project ID
 * @property {string} name - Project name
 * @property {string} rootPath - Root path
 * @property {string} parsedAt - ISO timestamp
 * @property {string} serializedAt - ISO timestamp of serialization
 * @property {Object<string, import('./BaseParser.js').ParsedFile>} files - Files as object (not Map)
 * @property {import('./ProjectParser.js').ProjectGraph} graph - Relationship graph
 * @property {Object} stats - Parsing statistics
 * @property {string[]} errors - Parsing errors
 */

/**
 * Project Serializer class.
 *
 * Provides methods to serialize ProjectData to JSON and deserialize back.
 */
export class ProjectSerializer {
  /**
   * Serialize ProjectData to a JSON-compatible object.
   *
   * @param {import('./ProjectParser.js').ProjectData} projectData - Project data to serialize
   * @param {Object} options - Serialization options
   * @param {boolean} [options.includeFileObjects=false] - Include File object references (not serializable)
   * @param {boolean} [options.compact=false] - Minimize output size
   * @returns {SerializedProjectData} Serialized project data
   */
  serialize(projectData, options = {}) {
    const { includeFileObjects = false, compact = false } = options;

    // Convert files Map to object
    const files = {};
    for (const [path, parsedFile] of projectData.files) {
      files[path] = this._serializeParsedFile(parsedFile, { includeFileObjects, compact });
    }

    const serialized = {
      version: FORMAT_VERSION,
      id: projectData.id,
      name: projectData.name,
      rootPath: projectData.rootPath,
      parsedAt: projectData.parsedAt,
      serializedAt: new Date().toISOString(),
      files,
      graph: projectData.graph,
      stats: projectData.stats,
      errors: projectData.errors || []
    };

    return serialized;
  }

  /**
   * Serialize ProjectData to a JSON string.
   *
   * @param {import('./ProjectParser.js').ProjectData} projectData - Project data
   * @param {Object} options - Serialization options
   * @param {boolean} [options.pretty=false] - Pretty print JSON
   * @param {boolean} [options.compact=false] - Minimize output size
   * @returns {string} JSON string
   */
  toJSON(projectData, options = {}) {
    const serialized = this.serialize(projectData, options);
    return options.pretty
      ? JSON.stringify(serialized, null, 2)
      : JSON.stringify(serialized);
  }

  /**
   * Deserialize JSON object back to ProjectData.
   *
   * @param {SerializedProjectData} data - Serialized data
   * @returns {import('./ProjectParser.js').ProjectData} Project data
   * @throws {Error} If version is incompatible
   */
  deserialize(data) {
    // Version check
    if (data.version > FORMAT_VERSION) {
      throw new Error(
        `Incompatible format version: ${data.version}. ` +
        `This parser supports version ${FORMAT_VERSION} or lower.`
      );
    }

    // Apply migrations if needed
    const migrated = this._migrate(data);

    // Convert files object to Map
    const files = new Map();
    for (const [path, fileData] of Object.entries(migrated.files)) {
      files.set(path, this._deserializeParsedFile(fileData));
    }

    return {
      id: migrated.id,
      name: migrated.name,
      rootPath: migrated.rootPath,
      parsedAt: migrated.parsedAt,
      files,
      graph: migrated.graph,
      stats: migrated.stats,
      errors: migrated.errors || []
    };
  }

  /**
   * Deserialize from JSON string.
   *
   * @param {string} json - JSON string
   * @returns {import('./ProjectParser.js').ProjectData} Project data
   */
  fromJSON(json) {
    const data = JSON.parse(json);
    return this.deserialize(data);
  }

  /**
   * Save ProjectData to localStorage.
   *
   * @param {import('./ProjectParser.js').ProjectData} projectData - Project data
   * @param {string} [key] - Storage key (defaults to project ID)
   * @returns {boolean} Success
   */
  saveToLocalStorage(projectData, key) {
    if (typeof localStorage === 'undefined') {
      console.warn('ProjectSerializer: localStorage not available');
      return false;
    }

    const storageKey = key || `project-${projectData.id}`;

    try {
      const json = this.toJSON(projectData, { compact: true });
      localStorage.setItem(storageKey, json);

      // Update project index
      this._updateProjectIndex(projectData.id, projectData.name, storageKey);

      return true;
    } catch (error) {
      console.error('ProjectSerializer: Failed to save to localStorage:', error.message);
      return false;
    }
  }

  /**
   * Load ProjectData from localStorage.
   *
   * @param {string} key - Storage key or project ID
   * @returns {import('./ProjectParser.js').ProjectData|null} Project data or null
   */
  loadFromLocalStorage(key) {
    if (typeof localStorage === 'undefined') {
      console.warn('ProjectSerializer: localStorage not available');
      return null;
    }

    // Try direct key first, then with project- prefix
    let json = localStorage.getItem(key);
    if (!json && !key.startsWith('project-')) {
      json = localStorage.getItem(`project-${key}`);
    }

    if (!json) {
      return null;
    }

    try {
      return this.fromJSON(json);
    } catch (error) {
      console.error('ProjectSerializer: Failed to load from localStorage:', error.message);
      return null;
    }
  }

  /**
   * Delete ProjectData from localStorage.
   *
   * @param {string} key - Storage key or project ID
   * @returns {boolean} Success
   */
  deleteFromLocalStorage(key) {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    const storageKey = key.startsWith('project-') ? key : `project-${key}`;
    localStorage.removeItem(storageKey);

    // Update project index
    this._removeFromProjectIndex(key);

    return true;
  }

  /**
   * List all saved projects.
   *
   * @returns {Array<{id: string, name: string, key: string, savedAt: string}>} Project list
   */
  listSavedProjects() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const indexJson = localStorage.getItem('project-index');
      if (!indexJson) return [];

      const index = JSON.parse(indexJson);
      return index.projects || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Export ProjectData to a downloadable file.
   *
   * @param {import('./ProjectParser.js').ProjectData} projectData - Project data
   * @param {string} [filename] - Filename (defaults to project name)
   */
  exportToFile(projectData, filename) {
    const json = this.toJSON(projectData, { pretty: true });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${projectData.name}-parsed.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import ProjectData from a file.
   *
   * @param {File} file - File object
   * @returns {Promise<import('./ProjectParser.js').ProjectData>} Project data
   */
  async importFromFile(file) {
    const json = await file.text();
    return this.fromJSON(json);
  }

  /**
   * Calculate approximate size of serialized data.
   *
   * @param {import('./ProjectParser.js').ProjectData} projectData - Project data
   * @returns {number} Size in bytes
   */
  calculateSize(projectData) {
    const json = this.toJSON(projectData, { compact: true });
    return new Blob([json]).size;
  }

  /**
   * Validate serialized data structure.
   *
   * @param {Object} data - Data to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(data) {
    const errors = [];

    if (!data) {
      errors.push('Data is null or undefined');
      return { valid: false, errors };
    }

    if (typeof data.version !== 'number') {
      errors.push('Missing or invalid version');
    }

    if (!data.id) {
      errors.push('Missing project ID');
    }

    if (!data.name) {
      errors.push('Missing project name');
    }

    if (!data.files || typeof data.files !== 'object') {
      errors.push('Missing or invalid files object');
    }

    if (!data.graph || !Array.isArray(data.graph.nodes) || !Array.isArray(data.graph.edges)) {
      errors.push('Missing or invalid graph structure');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Serialize a single ParsedFile.
   *
   * @param {import('./BaseParser.js').ParsedFile} parsedFile - Parsed file
   * @param {Object} options - Options
   * @returns {Object} Serialized file
   * @private
   */
  _serializeParsedFile(parsedFile, options = {}) {
    const { includeFileObjects = false, compact = false } = options;

    const serialized = {
      path: parsedFile.path,
      type: parsedFile.type,
      symbols: parsedFile.symbols,
      imports: parsedFile.imports,
      exports: parsedFile.exports,
      references: parsedFile.references || [],
      errors: parsedFile.errors || []
    };

    // Handle metadata
    if (parsedFile.metadata) {
      serialized.metadata = { ...parsedFile.metadata };

      // Remove non-serializable fileObject unless explicitly included
      if (!includeFileObjects) {
        delete serialized.metadata.fileObject;
      }

      // Remove empty metadata
      if (compact && Object.keys(serialized.metadata).length === 0) {
        delete serialized.metadata;
      }
    }

    // Remove empty arrays in compact mode
    if (compact) {
      if (serialized.references.length === 0) delete serialized.references;
      if (serialized.errors.length === 0) delete serialized.errors;
    }

    return serialized;
  }

  /**
   * Deserialize a single ParsedFile.
   *
   * @param {Object} data - Serialized file data
   * @returns {import('./BaseParser.js').ParsedFile} Parsed file
   * @private
   */
  _deserializeParsedFile(data) {
    return {
      path: data.path,
      type: data.type,
      symbols: data.symbols || [],
      imports: data.imports || [],
      exports: data.exports || [],
      references: data.references || [],
      metadata: data.metadata || {},
      errors: data.errors || []
    };
  }

  /**
   * Apply migrations for older format versions.
   *
   * @param {Object} data - Data to migrate
   * @returns {Object} Migrated data
   * @private
   */
  _migrate(data) {
    let current = { ...data };

    // Migration from version 0 (hypothetical) to version 1
    // if (current.version < 1) {
    //   // Apply migration logic
    //   current.version = 1;
    // }

    return current;
  }

  /**
   * Update project index in localStorage.
   *
   * @param {string} id - Project ID
   * @param {string} name - Project name
   * @param {string} key - Storage key
   * @private
   */
  _updateProjectIndex(id, name, key) {
    if (typeof localStorage === 'undefined') return;

    try {
      const indexJson = localStorage.getItem('project-index');
      const index = indexJson ? JSON.parse(indexJson) : { projects: [] };

      // Remove existing entry for this ID
      index.projects = index.projects.filter(p => p.id !== id);

      // Add new entry
      index.projects.push({
        id,
        name,
        key,
        savedAt: new Date().toISOString()
      });

      localStorage.setItem('project-index', JSON.stringify(index));
    } catch (error) {
      console.warn('ProjectSerializer: Failed to update project index:', error.message);
    }
  }

  /**
   * Remove project from index.
   *
   * @param {string} idOrKey - Project ID or storage key
   * @private
   */
  _removeFromProjectIndex(idOrKey) {
    if (typeof localStorage === 'undefined') return;

    try {
      const indexJson = localStorage.getItem('project-index');
      if (!indexJson) return;

      const index = JSON.parse(indexJson);
      index.projects = index.projects.filter(p => p.id !== idOrKey && p.key !== idOrKey);

      localStorage.setItem('project-index', JSON.stringify(index));
    } catch (error) {
      console.warn('ProjectSerializer: Failed to update project index:', error.message);
    }
  }
}

/**
 * Singleton project serializer instance.
 * @type {ProjectSerializer}
 */
export const projectSerializer = new ProjectSerializer();

/**
 * Export format version for external use.
 */
export { FORMAT_VERSION };
