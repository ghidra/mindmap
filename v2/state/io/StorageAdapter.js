/**
 * Storage Adapter
 *
 * Abstract interface for storage backends.
 * Implementations handle the actual persistence mechanism (localStorage, IndexedDB, API).
 *
 * All methods are async to support both synchronous and asynchronous backends.
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

/**
 * @typedef {Object} StorageMetadata
 * @property {string} key - Storage key
 * @property {number} size - Size in bytes (approximate)
 * @property {number} savedAt - Timestamp when saved
 * @property {number} [expiresAt] - Optional expiration timestamp
 * @property {string} [type] - Data type hint
 */

/**
 * @typedef {Object} StorageStats
 * @property {number} totalKeys - Total number of keys
 * @property {number} totalSize - Total size in bytes
 * @property {number} quota - Maximum storage quota
 * @property {number} available - Available space
 */

/**
 * @typedef {Object} StorageOptions
 * @property {number} [expiresIn] - Time-to-live in milliseconds
 * @property {string} [type] - Data type hint for later retrieval
 * @property {boolean} [compress] - Whether to compress data
 */

/**
 * Abstract storage adapter class.
 *
 * Subclasses must implement all methods.
 */
export class StorageAdapter {
  /**
   * Storage adapter identifier.
   * @type {string}
   */
  static id = 'abstract';

  /**
   * Human-readable name.
   * @type {string}
   */
  static name = 'Abstract Storage';

  /**
   * Whether this adapter is available in current environment.
   * @returns {boolean} Availability
   */
  static isAvailable() {
    return false;
  }

  /**
   * Create a new storage adapter instance.
   *
   * @param {Object} [options] - Adapter options
   * @param {string} [options.prefix=''] - Key prefix for namespacing
   */
  constructor(options = {}) {
    if (new.target === StorageAdapter) {
      throw new Error('StorageAdapter is abstract and cannot be instantiated directly');
    }

    /**
     * Key prefix for namespacing.
     * @type {string}
     */
    this.prefix = options.prefix || '';

    /**
     * Whether adapter is initialized.
     * @type {boolean}
     * @protected
     */
    this._initialized = false;
  }

  /**
   * Initialize the adapter.
   * Called automatically on first operation if not called explicitly.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this._initialized = true;
  }

  /**
   * Ensure adapter is initialized.
   *
   * @protected
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  /**
   * Get prefixed key.
   *
   * @param {string} key - Original key
   * @returns {string} Prefixed key
   * @protected
   */
  _getKey(key) {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  /**
   * Remove prefix from key.
   *
   * @param {string} prefixedKey - Prefixed key
   * @returns {string} Original key
   * @protected
   */
  _stripPrefix(prefixedKey) {
    if (this.prefix && prefixedKey.startsWith(`${this.prefix}/`)) {
      return prefixedKey.slice(this.prefix.length + 1);
    }
    return prefixedKey;
  }

  // =========================================================================
  // CRUD Operations (must be implemented by subclasses)
  // =========================================================================

  /**
   * Save data with key.
   *
   * @param {string} key - Storage key
   * @param {*} data - Data to store (will be serialized)
   * @param {StorageOptions} [options] - Storage options
   * @returns {Promise<boolean>} Success
   * @throws {Error} If storage fails
   */
  async save(key, data, options = {}) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Load data by key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored data or null if not found
   */
  async load(key) {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Delete data by key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(key) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Check if key exists.
   *
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if exists
   */
  async exists(key) {
    throw new Error('exists() must be implemented by subclass');
  }

  // =========================================================================
  // Listing Operations (must be implemented by subclasses)
  // =========================================================================

  /**
   * List all keys with optional prefix filter.
   *
   * @param {string} [filterPrefix=''] - Additional prefix filter
   * @returns {Promise<string[]>} Array of keys (without adapter prefix)
   */
  async list(filterPrefix = '') {
    throw new Error('list() must be implemented by subclass');
  }

  /**
   * Get metadata for a key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<StorageMetadata|null>} Metadata or null if not found
   */
  async getMetadata(key) {
    throw new Error('getMetadata() must be implemented by subclass');
  }

  /**
   * Get metadata for all keys matching prefix.
   *
   * @param {string} [filterPrefix=''] - Prefix filter
   * @returns {Promise<StorageMetadata[]>} Array of metadata
   */
  async listWithMetadata(filterPrefix = '') {
    const keys = await this.list(filterPrefix);
    const metadata = [];

    for (const key of keys) {
      const meta = await this.getMetadata(key);
      if (meta) {
        metadata.push(meta);
      }
    }

    return metadata;
  }

  // =========================================================================
  // Batch Operations (may be overridden for efficiency)
  // =========================================================================

  /**
   * Save multiple items.
   *
   * @param {Object<string, *>} items - Key-value pairs to save
   * @param {StorageOptions} [options] - Storage options
   * @returns {Promise<Object<string, boolean>>} Success map
   */
  async saveMany(items, options = {}) {
    const results = {};

    for (const [key, data] of Object.entries(items)) {
      try {
        results[key] = await this.save(key, data, options);
      } catch (error) {
        results[key] = false;
      }
    }

    return results;
  }

  /**
   * Load multiple items.
   *
   * @param {string[]} keys - Keys to load
   * @returns {Promise<Object<string, *>>} Key-value map (missing keys not included)
   */
  async loadMany(keys) {
    const results = {};

    for (const key of keys) {
      const data = await this.load(key);
      if (data !== null) {
        results[key] = data;
      }
    }

    return results;
  }

  /**
   * Delete multiple items.
   *
   * @param {string[]} keys - Keys to delete
   * @returns {Promise<Object<string, boolean>>} Success map
   */
  async deleteMany(keys) {
    const results = {};

    for (const key of keys) {
      results[key] = await this.delete(key);
    }

    return results;
  }

  // =========================================================================
  // Utility Operations
  // =========================================================================

  /**
   * Clear all data (within prefix namespace).
   *
   * @returns {Promise<number>} Number of items cleared
   */
  async clear() {
    const keys = await this.list();
    let count = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get storage statistics.
   *
   * @returns {Promise<StorageStats>} Storage statistics
   */
  async getStats() {
    throw new Error('getStats() must be implemented by subclass');
  }

  /**
   * Remove expired items.
   *
   * @returns {Promise<number>} Number of items removed
   */
  async prune() {
    const now = Date.now();
    const metadata = await this.listWithMetadata();
    let count = 0;

    for (const meta of metadata) {
      if (meta.expiresAt && meta.expiresAt <= now) {
        if (await this.delete(meta.key)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Close and cleanup adapter resources.
   *
   * @returns {Promise<void>}
   */
  async close() {
    this._initialized = false;
  }
}

/**
 * Storage error class for detailed error handling.
 */
export class StorageError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [cause] - Original error
   */
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }

  /**
   * Storage quota exceeded.
   * @type {string}
   */
  static QUOTA_EXCEEDED = 'QUOTA_EXCEEDED';

  /**
   * Key not found.
   * @type {string}
   */
  static NOT_FOUND = 'NOT_FOUND';

  /**
   * Data corrupted or invalid.
   * @type {string}
   */
  static INVALID_DATA = 'INVALID_DATA';

  /**
   * Storage not available.
   * @type {string}
   */
  static UNAVAILABLE = 'UNAVAILABLE';

  /**
   * Permission denied.
   * @type {string}
   */
  static PERMISSION_DENIED = 'PERMISSION_DENIED';

  /**
   * Unknown error.
   * @type {string}
   */
  static UNKNOWN = 'UNKNOWN';
}
