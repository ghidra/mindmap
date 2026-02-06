/**
 * LocalStorage Adapter
 *
 * Storage adapter implementation using browser localStorage.
 * Provides persistent key-value storage with automatic JSON serialization.
 *
 * Limitations:
 * - ~5MB storage limit per origin
 * - Synchronous API (wrapped in async for interface compatibility)
 * - String-only storage (objects are JSON serialized)
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { StorageAdapter, StorageError } from './StorageAdapter.js';

/**
 * Internal storage entry structure.
 * @typedef {Object} StorageEntry
 * @property {*} data - Stored data
 * @property {number} savedAt - Save timestamp
 * @property {number} [expiresAt] - Expiration timestamp
 * @property {string} [type] - Data type hint
 * @property {number} size - Approximate size in bytes
 */

/**
 * LocalStorage adapter implementation.
 */
export class LocalStorageAdapter extends StorageAdapter {
  /**
   * Storage adapter identifier.
   * @type {string}
   */
  static id = 'localStorage';

  /**
   * Human-readable name.
   * @type {string}
   */
  static name = 'Local Storage';

  /**
   * Check if localStorage is available.
   * @returns {boolean} Availability
   */
  static isAvailable() {
    try {
      const test = '__storage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Create a new LocalStorage adapter.
   *
   * @param {Object} [options] - Adapter options
   * @param {string} [options.prefix='mindmap'] - Key prefix for namespacing
   */
  constructor(options = {}) {
    super({
      prefix: options.prefix || 'mindmap',
      ...options
    });

    if (!LocalStorageAdapter.isAvailable()) {
      throw new StorageError(
        'localStorage is not available',
        StorageError.UNAVAILABLE
      );
    }
  }

  /**
   * Initialize the adapter.
   * @returns {Promise<void>}
   */
  async initialize() {
    await super.initialize();

    // Prune expired entries on startup
    await this.prune();
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Save data with key.
   *
   * @param {string} key - Storage key
   * @param {*} data - Data to store
   * @param {import('./StorageAdapter.js').StorageOptions} [options] - Options
   * @returns {Promise<boolean>} Success
   */
  async save(key, data, options = {}) {
    await this._ensureInitialized();

    const fullKey = this._getKey(key);

    try {
      const serialized = JSON.stringify(data);
      const size = serialized.length * 2; // Approximate UTF-16 bytes

      /** @type {StorageEntry} */
      const entry = {
        data,
        savedAt: Date.now(),
        size,
        ...(options.expiresIn && { expiresAt: Date.now() + options.expiresIn }),
        ...(options.type && { type: options.type })
      };

      const entryStr = JSON.stringify(entry);
      window.localStorage.setItem(fullKey, entryStr);

      return true;
    } catch (error) {
      if (this._isQuotaError(error)) {
        throw new StorageError(
          `Storage quota exceeded while saving '${key}'`,
          StorageError.QUOTA_EXCEEDED,
          error
        );
      }
      throw new StorageError(
        `Failed to save '${key}': ${error.message}`,
        StorageError.UNKNOWN,
        error
      );
    }
  }

  /**
   * Load data by key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored data or null
   */
  async load(key) {
    await this._ensureInitialized();

    const fullKey = this._getKey(key);

    try {
      const entryStr = window.localStorage.getItem(fullKey);
      if (entryStr === null) {
        return null;
      }

      const entry = JSON.parse(entryStr);

      // Check expiration
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // Invalid JSON - try to return raw value for backwards compatibility
      const raw = window.localStorage.getItem(fullKey);
      if (raw !== null) {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return null;
    }
  }

  /**
   * Delete data by key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    await this._ensureInitialized();

    const fullKey = this._getKey(key);

    if (window.localStorage.getItem(fullKey) === null) {
      return false;
    }

    window.localStorage.removeItem(fullKey);
    return true;
  }

  /**
   * Check if key exists.
   *
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if exists
   */
  async exists(key) {
    await this._ensureInitialized();

    const fullKey = this._getKey(key);
    const entryStr = window.localStorage.getItem(fullKey);

    if (entryStr === null) {
      return false;
    }

    // Check if expired
    try {
      const entry = JSON.parse(entryStr);
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        // Clean up expired entry
        window.localStorage.removeItem(fullKey);
        return false;
      }
    } catch {
      // If parse fails, entry exists but is not in our format
    }

    return true;
  }

  // =========================================================================
  // Listing Operations
  // =========================================================================

  /**
   * List all keys with optional prefix filter.
   *
   * @param {string} [filterPrefix=''] - Additional prefix filter
   * @returns {Promise<string[]>} Array of keys
   */
  async list(filterPrefix = '') {
    await this._ensureInitialized();

    const keys = [];
    const fullPrefix = this._getKey(filterPrefix);

    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i);
      if (fullKey && fullKey.startsWith(this._getKey(''))) {
        // Remove adapter prefix
        const key = this._stripPrefix(fullKey);

        // Apply filter prefix
        if (filterPrefix === '' || key.startsWith(filterPrefix)) {
          keys.push(key);
        }
      }
    }

    return keys.sort();
  }

  /**
   * Get metadata for a key.
   *
   * @param {string} key - Storage key
   * @returns {Promise<import('./StorageAdapter.js').StorageMetadata|null>} Metadata
   */
  async getMetadata(key) {
    await this._ensureInitialized();

    const fullKey = this._getKey(key);
    const entryStr = window.localStorage.getItem(fullKey);

    if (entryStr === null) {
      return null;
    }

    try {
      const entry = JSON.parse(entryStr);

      return {
        key,
        size: entry.size || entryStr.length * 2,
        savedAt: entry.savedAt || 0,
        expiresAt: entry.expiresAt,
        type: entry.type
      };
    } catch {
      // Legacy entry without metadata
      return {
        key,
        size: entryStr.length * 2,
        savedAt: 0,
        type: undefined
      };
    }
  }

  // =========================================================================
  // Batch Operations (optimized)
  // =========================================================================

  /**
   * Save multiple items efficiently.
   *
   * @param {Object<string, *>} items - Key-value pairs
   * @param {import('./StorageAdapter.js').StorageOptions} [options] - Options
   * @returns {Promise<Object<string, boolean>>} Success map
   */
  async saveMany(items, options = {}) {
    await this._ensureInitialized();

    const results = {};
    const now = Date.now();

    for (const [key, data] of Object.entries(items)) {
      const fullKey = this._getKey(key);

      try {
        const serialized = JSON.stringify(data);
        const size = serialized.length * 2;

        const entry = {
          data,
          savedAt: now,
          size,
          ...(options.expiresIn && { expiresAt: now + options.expiresIn }),
          ...(options.type && { type: options.type })
        };

        window.localStorage.setItem(fullKey, JSON.stringify(entry));
        results[key] = true;
      } catch (error) {
        results[key] = false;
        if (this._isQuotaError(error)) {
          // Stop on quota error
          break;
        }
      }
    }

    return results;
  }

  // =========================================================================
  // Utility Operations
  // =========================================================================

  /**
   * Clear all data within namespace.
   *
   * @returns {Promise<number>} Number cleared
   */
  async clear() {
    await this._ensureInitialized();

    const prefix = this._getKey('');
    const keysToRemove = [];

    // Collect keys first to avoid mutation during iteration
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove collected keys
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }

    return keysToRemove.length;
  }

  /**
   * Get storage statistics.
   *
   * @returns {Promise<import('./StorageAdapter.js').StorageStats>} Stats
   */
  async getStats() {
    await this._ensureInitialized();

    const prefix = this._getKey('');
    let totalSize = 0;
    let totalKeys = 0;

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = window.localStorage.getItem(key);
        if (value) {
          totalSize += (key.length + value.length) * 2;
          totalKeys++;
        }
      }
    }

    // localStorage quota is typically 5MB per origin
    const quota = 5 * 1024 * 1024;

    return {
      totalKeys,
      totalSize,
      quota,
      available: Math.max(0, quota - totalSize)
    };
  }

  /**
   * Remove expired items.
   *
   * @returns {Promise<number>} Number removed
   */
  async prune() {
    await this._ensureInitialized();

    const prefix = this._getKey('');
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const entry = JSON.parse(window.localStorage.getItem(key));
          if (entry.expiresAt && entry.expiresAt <= now) {
            keysToRemove.push(key);
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }

    return keysToRemove.length;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Check if error is a quota exceeded error.
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if quota error
   * @private
   */
  _isQuotaError(error) {
    return (
      error instanceof DOMException &&
      (error.code === 22 || // Legacy
        error.code === 1014 || // Firefox
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    );
  }
}

/**
 * Default LocalStorage adapter instance with 'mindmap' prefix.
 * @type {LocalStorageAdapter}
 */
export const localStorageAdapter = new LocalStorageAdapter();
