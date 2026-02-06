/**
 * Project Store
 *
 * Domain store for managing parsed project data.
 * Handles loading, saving, and accessing project information.
 *
 * Responsibilities:
 * - Store and retrieve parsed project data (from ProjectParser)
 * - Manage project metadata (name, path, timestamps)
 * - Persist projects to storage (localStorage or IndexedDB)
 * - Provide query methods for project data
 * - Emit events on project changes via StateManager
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { stateManager } from '../StateManager.js';
import { localStorageAdapter } from '../io/LocalStorageAdapter.js';
import { indexedDBAdapter, IndexedDBAdapter } from '../io/IndexedDBAdapter.js';

/**
 * @typedef {Object} ProjectMetadata
 * @property {string} id - Project ID
 * @property {string} name - Project name
 * @property {string} rootPath - Root path of project
 * @property {number} parsedAt - Parse timestamp
 * @property {number} savedAt - Last save timestamp
 * @property {number} fileCount - Number of files
 * @property {number} symbolCount - Number of symbols
 * @property {number} size - Approximate size in bytes
 */

/**
 * Storage key prefixes.
 */
const STORAGE_KEYS = {
  PROJECT_PREFIX: 'projects',
  PROJECT_INDEX: 'projects/_index',
  CURRENT_PROJECT: 'projects/_current'
};

/**
 * Size threshold for using IndexedDB vs localStorage (500KB).
 * @type {number}
 */
const INDEXEDDB_THRESHOLD = 500 * 1024;

/**
 * Project Store class.
 *
 * Manages parsed project data with persistence.
 */
export class ProjectStore {
  /**
   * Create a new ProjectStore.
   *
   * @param {Object} [options] - Options
   * @param {boolean} [options.preferIndexedDB=true] - Prefer IndexedDB for large projects
   */
  constructor(options = {}) {
    /**
     * Whether to prefer IndexedDB for large projects.
     * @type {boolean}
     */
    this.preferIndexedDB = options.preferIndexedDB !== false;

    /**
     * Project index cache (id -> metadata).
     * @type {Map<string, ProjectMetadata>}
     * @private
     */
    this._projectIndex = new Map();

    /**
     * Whether store is initialized.
     * @type {boolean}
     * @private
     */
    this._initialized = false;
  }

  /**
   * Initialize the store.
   * Loads project index from storage.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Initialize storage adapters
      await localStorageAdapter.initialize();

      if (this.preferIndexedDB && IndexedDBAdapter.isAvailable()) {
        await indexedDBAdapter.initialize();
      }

      // Load project index
      await this._loadProjectIndex();

      this._initialized = true;
    } catch (error) {
      console.error('ProjectStore: Initialization failed:', error);
      this._initialized = true; // Continue anyway
    }
  }

  /**
   * Ensure store is initialized.
   * @private
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  // =========================================================================
  // Project CRUD Operations
  // =========================================================================

  /**
   * Load a project by ID.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<import('../../parser/ProjectParser.js').ProjectData|null>} Project data
   */
  async loadProject(projectId) {
    await this._ensureInitialized();

    const key = `${STORAGE_KEYS.PROJECT_PREFIX}/${projectId}`;

    // Try IndexedDB first for large projects
    if (this.preferIndexedDB && IndexedDBAdapter.isAvailable()) {
      const data = await indexedDBAdapter.load(key);
      if (data) {
        this._setCurrentProject(data);
        return data;
      }
    }

    // Fall back to localStorage
    const data = await localStorageAdapter.load(key);
    if (data) {
      this._setCurrentProject(data);
      return data;
    }

    return null;
  }

  /**
   * Save a project.
   *
   * @param {import('../../parser/ProjectParser.js').ProjectData} projectData - Project data
   * @param {Object} [options] - Options
   * @param {boolean} [options.setAsCurrent=true] - Set as current project
   * @returns {Promise<boolean>} Success
   */
  async saveProject(projectData, options = {}) {
    await this._ensureInitialized();

    const setAsCurrent = options.setAsCurrent !== false;

    if (!projectData || !projectData.id) {
      console.error('ProjectStore: Cannot save project without ID');
      return false;
    }

    const key = `${STORAGE_KEYS.PROJECT_PREFIX}/${projectData.id}`;

    // Estimate size
    const serialized = JSON.stringify(projectData);
    const size = serialized.length * 2;

    // Choose storage adapter based on size
    const useIndexedDB = this.preferIndexedDB &&
      IndexedDBAdapter.isAvailable() &&
      size > INDEXEDDB_THRESHOLD;

    try {
      const adapter = useIndexedDB ? indexedDBAdapter : localStorageAdapter;
      const success = await adapter.save(key, projectData, {
        type: 'project'
      });

      if (success) {
        // Update index
        await this._updateProjectIndex(projectData, size);

        // Set as current
        if (setAsCurrent) {
          this._setCurrentProject(projectData);
          await this._saveCurrentProjectId(projectData.id);
        }
      }

      return success;
    } catch (error) {
      console.error('ProjectStore: Failed to save project:', error);

      // Try alternate storage on quota error
      if (error.code === 'QUOTA_EXCEEDED' && !useIndexedDB && IndexedDBAdapter.isAvailable()) {
        try {
          const success = await indexedDBAdapter.save(key, projectData, {
            type: 'project'
          });
          if (success) {
            await this._updateProjectIndex(projectData, size);
            if (setAsCurrent) {
              this._setCurrentProject(projectData);
              await this._saveCurrentProjectId(projectData.id);
            }
          }
          return success;
        } catch (e) {
          console.error('ProjectStore: IndexedDB fallback also failed:', e);
        }
      }

      return false;
    }
  }

  /**
   * Delete a project.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} Success
   */
  async deleteProject(projectId) {
    await this._ensureInitialized();

    const key = `${STORAGE_KEYS.PROJECT_PREFIX}/${projectId}`;

    // Delete from both storages
    const deletedLS = await localStorageAdapter.delete(key);
    const deletedIDB = IndexedDBAdapter.isAvailable()
      ? await indexedDBAdapter.delete(key)
      : false;

    if (deletedLS || deletedIDB) {
      // Remove from index
      this._projectIndex.delete(projectId);
      await this._saveProjectIndex();

      // Clear current if this was current
      const currentId = stateManager.get('project.id');
      if (currentId === projectId) {
        stateManager.set('project', {
          id: null,
          name: null,
          data: null,
          loadedAt: null
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Check if a project exists.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} True if exists
   */
  async projectExists(projectId) {
    await this._ensureInitialized();
    return this._projectIndex.has(projectId);
  }

  // =========================================================================
  // Project Listing
  // =========================================================================

  /**
   * List all saved projects.
   *
   * @returns {Promise<ProjectMetadata[]>} Project metadata list
   */
  async listProjects() {
    await this._ensureInitialized();
    return Array.from(this._projectIndex.values())
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  /**
   * Get metadata for a project.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<ProjectMetadata|null>} Metadata
   */
  async getProjectMetadata(projectId) {
    await this._ensureInitialized();
    return this._projectIndex.get(projectId) || null;
  }

  // =========================================================================
  // Current Project
  // =========================================================================

  /**
   * Get the current project data.
   *
   * @returns {import('../../parser/ProjectParser.js').ProjectData|null} Current project
   */
  getCurrentProject() {
    return stateManager.get('project.data');
  }

  /**
   * Get the current project ID.
   *
   * @returns {string|null} Project ID
   */
  getCurrentProjectId() {
    return stateManager.get('project.id');
  }

  /**
   * Load the last active project (from previous session).
   *
   * @returns {Promise<import('../../parser/ProjectParser.js').ProjectData|null>} Project data
   */
  async loadLastProject() {
    await this._ensureInitialized();

    const lastProjectId = await localStorageAdapter.load(STORAGE_KEYS.CURRENT_PROJECT);
    if (lastProjectId) {
      return this.loadProject(lastProjectId);
    }

    return null;
  }

  /**
   * Clear the current project.
   */
  clearCurrentProject() {
    stateManager.set('project', {
      id: null,
      name: null,
      data: null,
      loadedAt: null
    });
  }

  // =========================================================================
  // Project Data Queries
  // =========================================================================

  /**
   * Get a file from the current project.
   *
   * @param {string} filePath - File path
   * @returns {import('../../parser/BaseParser.js').ParsedFile|null} Parsed file
   */
  getFile(filePath) {
    const projectData = this.getCurrentProject();
    if (!projectData || !projectData.files) return null;

    // Handle both Map and Object
    if (projectData.files instanceof Map) {
      return projectData.files.get(filePath) || null;
    }
    return projectData.files[filePath] || null;
  }

  /**
   * Get all files from the current project.
   *
   * @returns {import('../../parser/BaseParser.js').ParsedFile[]} All files
   */
  getAllFiles() {
    const projectData = this.getCurrentProject();
    if (!projectData || !projectData.files) return [];

    if (projectData.files instanceof Map) {
      return Array.from(projectData.files.values());
    }
    return Object.values(projectData.files);
  }

  /**
   * Get file paths from the current project.
   *
   * @returns {string[]} File paths
   */
  getFilePaths() {
    const projectData = this.getCurrentProject();
    if (!projectData || !projectData.files) return [];

    if (projectData.files instanceof Map) {
      return Array.from(projectData.files.keys());
    }
    return Object.keys(projectData.files);
  }

  /**
   * Find files that import a given file.
   *
   * @param {string} targetPath - Target file path
   * @returns {string[]} Importing file paths
   */
  findImporters(targetPath) {
    const projectData = this.getCurrentProject();
    if (!projectData || !projectData.graph) return [];

    const importers = [];
    for (const edge of projectData.graph.edges || []) {
      if (edge.to === targetPath && edge.type === 'imports') {
        importers.push(edge.from);
      }
    }
    return importers;
  }

  /**
   * Find files imported by a given file.
   *
   * @param {string} sourcePath - Source file path
   * @returns {string[]} Imported file paths
   */
  findImports(sourcePath) {
    const projectData = this.getCurrentProject();
    if (!projectData || !projectData.graph) return [];

    const imports = [];
    for (const edge of projectData.graph.edges || []) {
      if (edge.from === sourcePath && edge.type === 'imports') {
        imports.push(edge.to);
      }
    }
    return imports;
  }

  /**
   * Find a symbol across all files.
   *
   * @param {string} name - Symbol name
   * @param {string} [type] - Symbol type filter
   * @returns {{file: string, symbol: import('../../parser/BaseParser.js').ParsedSymbol}[]} Matches
   */
  findSymbol(name, type) {
    const results = [];

    for (const file of this.getAllFiles()) {
      for (const symbol of file.symbols || []) {
        if (symbol.name === name && (!type || symbol.type === type)) {
          results.push({ file: file.path, symbol });
        }
      }
    }

    return results;
  }

  /**
   * Get all symbols of a given type.
   *
   * @param {string} type - Symbol type
   * @returns {{file: string, symbol: import('../../parser/BaseParser.js').ParsedSymbol}[]} Symbols
   */
  getSymbolsByType(type) {
    const results = [];

    for (const file of this.getAllFiles()) {
      for (const symbol of file.symbols || []) {
        if (symbol.type === type) {
          results.push({ file: file.path, symbol });
        }
      }
    }

    return results;
  }

  /**
   * Get project statistics.
   *
   * @returns {Object} Stats
   */
  getStats() {
    const projectData = this.getCurrentProject();
    if (!projectData) {
      return { files: 0, symbols: 0, imports: 0, exports: 0 };
    }

    return projectData.stats || { files: 0, symbols: 0, imports: 0, exports: 0 };
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Set current project in state.
   *
   * @param {import('../../parser/ProjectParser.js').ProjectData} projectData - Project data
   * @private
   */
  _setCurrentProject(projectData) {
    stateManager.set('project', {
      id: projectData.id,
      name: projectData.name,
      data: projectData,
      loadedAt: Date.now()
    });
  }

  /**
   * Save current project ID.
   *
   * @param {string} projectId - Project ID
   * @private
   */
  async _saveCurrentProjectId(projectId) {
    await localStorageAdapter.save(STORAGE_KEYS.CURRENT_PROJECT, projectId);
  }

  /**
   * Load project index from storage.
   * @private
   */
  async _loadProjectIndex() {
    try {
      const index = await localStorageAdapter.load(STORAGE_KEYS.PROJECT_INDEX);
      if (index && Array.isArray(index)) {
        this._projectIndex.clear();
        for (const meta of index) {
          if (meta && meta.id) {
            this._projectIndex.set(meta.id, meta);
          }
        }
      }
    } catch (error) {
      console.error('ProjectStore: Failed to load project index:', error);
    }
  }

  /**
   * Save project index to storage.
   * @private
   */
  async _saveProjectIndex() {
    try {
      const index = Array.from(this._projectIndex.values());
      await localStorageAdapter.save(STORAGE_KEYS.PROJECT_INDEX, index);
    } catch (error) {
      console.error('ProjectStore: Failed to save project index:', error);
    }
  }

  /**
   * Update project index with metadata.
   *
   * @param {import('../../parser/ProjectParser.js').ProjectData} projectData - Project data
   * @param {number} size - Size in bytes
   * @private
   */
  async _updateProjectIndex(projectData, size) {
    const metadata = {
      id: projectData.id,
      name: projectData.name,
      rootPath: projectData.rootPath,
      parsedAt: projectData.parsedAt,
      savedAt: Date.now(),
      fileCount: projectData.stats?.totalFiles || 0,
      symbolCount: projectData.stats?.symbols || 0,
      size
    };

    this._projectIndex.set(projectData.id, metadata);
    await this._saveProjectIndex();
  }

  /**
   * Generate a project ID.
   *
   * @param {string} name - Project name
   * @returns {string} Project ID
   */
  static generateId(name) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
    return `${safeName}-${timestamp}-${random}`;
  }
}

/**
 * Singleton ProjectStore instance.
 * @type {ProjectStore}
 */
export const projectStore = new ProjectStore();
