/**
 * IndexedDB Adapter
 *
 * Storage adapter implementation using browser IndexedDB.
 * Provides persistent storage for larger data that exceeds localStorage limits.
 *
 * Advantages over localStorage:
 * - Much larger storage quota (typically hundreds of MB)
 * - Asynchronous API (non-blocking)
 * - Supports binary data (Blobs, ArrayBuffers)
 * - Transactional operations
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { StorageAdapter, StorageError } from './StorageAdapter.js';

/**
 * IndexedDB storage entry.
 * @typedef {Object} IDBEntry
 * @property {string} key - Storage key
 * @property {*} data - Stored data
 * @property {number} savedAt - Save timestamp
 * @property {number} [expiresAt] - Expiration timestamp
 * @property {string} [type] - Data type hint
 * @property {number} size - Approximate size in bytes
 */

/**
 * Database configuration.
 */
const DB_NAME = 'mindmap-storage';
const DB_VERSION = 1;
const STORE_NAME = 'data';

/**
 * IndexedDB adapter implementation.
 */
export class IndexedDBAdapter extends StorageAdapter {
  /**
   * Storage adapter identifier.
   * @type {string}
   */
  static id = 'indexedDB';

  /**
   * Human-readable name.
   * @type {string}
   */
  static name = 'IndexedDB Storage';

  /**
   * Check if IndexedDB is available.
   * @returns {boolean} Availability
   */
  static isAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Create a new IndexedDB adapter.
   *
   * @param {Object} [options] - Adapter options
   * @param {string} [options.prefix=''] - Key prefix for namespacing
   * @param {string} [options.dbName] - Custom database name
   * @param {number} [options.dbVersion] - Custom database version
   */
  constructor(options = {}) {
    super({
      prefix: options.prefix || '',
      ...options
    });

    if (!IndexedDBAdapter.isAvailable()) {
      throw new StorageError(
        'IndexedDB is not available',
        StorageError.UNAVAILABLE
      );
    }

    /**
     * Database name.
     * @type {string}
     * @private
     */
    this._dbName = options.dbName || DB_NAME;

    /**
     * Database version.
     * @type {number}
     * @private
     */
    this._dbVersion = options.dbVersion || DB_VERSION;

    /**
     * Database connection.
     * @type {IDBDatabase|null}
     * @private
     */
    this._db = null;
  }

  /**
   * Initialize the adapter and open database connection.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized && this._db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, this._dbVersion);

      request.onerror = () => {
        reject(new StorageError(
          `Failed to open IndexedDB: ${request.error?.message}`,
          StorageError.UNAVAILABLE,
          request.error
        ));
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._initialized = true;

        // Handle connection close
        this._db.onclose = () => {
          this._db = null;
          this._initialized = false;
        };

        // Prune expired entries
        this.prune().then(resolve).catch(resolve);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });

          // Create indexes for efficient queries
          store.createIndex('savedAt', 'savedAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  /**
   * Get a transaction and object store.
   *
   * @param {IDBTransactionMode} mode - 'readonly' or 'readwrite'
   * @returns {IDBObjectStore} Object store
   * @private
   */
  _getStore(mode) {
    if (!this._db) {
      throw new StorageError(
        'Database not initialized',
        StorageError.UNAVAILABLE
      );
    }

    const transaction = this._db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  }

  /**
   * Wrap IDBRequest in a Promise.
   *
   * @param {IDBRequest} request - IndexedDB request
   * @returns {Promise<*>} Result
   * @private
   */
  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
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
      // Estimate size (rough approximation)
      const serialized = JSON.stringify(data);
      const size = serialized.length * 2;

      /** @type {IDBEntry} */
      const entry = {
        key: fullKey,
        data,
        savedAt: Date.now(),
        size,
        ...(options.expiresIn && { expiresAt: Date.now() + options.expiresIn }),
        ...(options.type && { type: options.type })
      };

      const store = this._getStore('readwrite');
      await this._promisify(store.put(entry));

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
      const store = this._getStore('readonly');
      const entry = await this._promisify(store.get(fullKey));

      if (!entry) {
        return null;
      }

      // Check expiration
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      throw new StorageError(
        `Failed to load '${key}': ${error.message}`,
        StorageError.UNKNOWN,
        error
      );
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

    try {
      // Check if exists first
      const store = this._getStore('readonly');
      const exists = await this._promisify(store.get(fullKey));

      if (!exists) {
        return false;
      }

      // Delete
      const writeStore = this._getStore('readwrite');
      await this._promisify(writeStore.delete(fullKey));

      return true;
    } catch (error) {
      throw new StorageError(
        `Failed to delete '${key}': ${error.message}`,
        StorageError.UNKNOWN,
        error
      );
    }
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

    try {
      const store = this._getStore('readonly');
      const entry = await this._promisify(store.get(fullKey));

      if (!entry) {
        return false;
      }

      // Check if expired
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        // Clean up expired entry (async, don't wait)
        this.delete(key).catch(() => {});
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
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

    const adapterPrefix = this._getKey('');
    const fullFilterPrefix = this._getKey(filterPrefix);

    return new Promise((resolve, reject) => {
      const keys = [];
      const store = this._getStore('readonly');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = cursor.value.key;

          // Filter by adapter prefix
          if (key.startsWith(adapterPrefix)) {
            // Apply filter prefix
            if (key.startsWith(fullFilterPrefix)) {
              // Strip adapter prefix
              keys.push(this._stripPrefix(key));
            }
          }

          cursor.continue();
        } else {
          resolve(keys.sort());
        }
      };

      request.onerror = () => {
        reject(new StorageError(
          `Failed to list keys: ${request.error?.message}`,
          StorageError.UNKNOWN,
          request.error
        ));
      };
    });
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

    try {
      const store = this._getStore('readonly');
      const entry = await this._promisify(store.get(fullKey));

      if (!entry) {
        return null;
      }

      return {
        key,
        size: entry.size || 0,
        savedAt: entry.savedAt || 0,
        expiresAt: entry.expiresAt,
        type: entry.type
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get metadata for all keys matching prefix.
   *
   * @param {string} [filterPrefix=''] - Prefix filter
   * @returns {Promise<import('./StorageAdapter.js').StorageMetadata[]>} Metadata array
   */
  async listWithMetadata(filterPrefix = '') {
    await this._ensureInitialized();

    const adapterPrefix = this._getKey('');
    const fullFilterPrefix = this._getKey(filterPrefix);

    return new Promise((resolve, reject) => {
      const metadata = [];
      const store = this._getStore('readonly');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          const key = entry.key;

          // Filter by adapter prefix
          if (key.startsWith(adapterPrefix) && key.startsWith(fullFilterPrefix)) {
            metadata.push({
              key: this._stripPrefix(key),
              size: entry.size || 0,
              savedAt: entry.savedAt || 0,
              expiresAt: entry.expiresAt,
              type: entry.type
            });
          }

          cursor.continue();
        } else {
          resolve(metadata);
        }
      };

      request.onerror = () => {
        reject(new StorageError(
          `Failed to list metadata: ${request.error?.message}`,
          StorageError.UNKNOWN,
          request.error
        ));
      };
    });
  }

  // =========================================================================
  // Batch Operations (optimized using transactions)
  // =========================================================================

  /**
   * Save multiple items in a single transaction.
   *
   * @param {Object<string, *>} items - Key-value pairs
   * @param {import('./StorageAdapter.js').StorageOptions} [options] - Options
   * @returns {Promise<Object<string, boolean>>} Success map
   */
  async saveMany(items, options = {}) {
    await this._ensureInitialized();

    const now = Date.now();
    const results = {};

    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => {
        resolve(results);
      };

      transaction.onerror = () => {
        // Return partial results
        resolve(results);
      };

      for (const [key, data] of Object.entries(items)) {
        const fullKey = this._getKey(key);

        try {
          const serialized = JSON.stringify(data);
          const size = serialized.length * 2;

          const entry = {
            key: fullKey,
            data,
            savedAt: now,
            size,
            ...(options.expiresIn && { expiresAt: now + options.expiresIn }),
            ...(options.type && { type: options.type })
          };

          const request = store.put(entry);
          request.onsuccess = () => { results[key] = true; };
          request.onerror = () => { results[key] = false; };
        } catch (error) {
          results[key] = false;
        }
      }
    });
  }

  /**
   * Load multiple items in a single transaction.
   *
   * @param {string[]} keys - Keys to load
   * @returns {Promise<Object<string, *>>} Key-value map
   */
  async loadMany(keys) {
    await this._ensureInitialized();

    const results = {};
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      let pending = keys.length;

      if (pending === 0) {
        resolve(results);
        return;
      }

      transaction.oncomplete = () => {
        resolve(results);
      };

      transaction.onerror = () => {
        resolve(results);
      };

      for (const key of keys) {
        const fullKey = this._getKey(key);
        const request = store.get(fullKey);

        request.onsuccess = () => {
          const entry = request.result;
          if (entry && (!entry.expiresAt || entry.expiresAt > now)) {
            results[key] = entry.data;
          }
          pending--;
        };

        request.onerror = () => {
          pending--;
        };
      }
    });
  }

  /**
   * Delete multiple items in a single transaction.
   *
   * @param {string[]} keys - Keys to delete
   * @returns {Promise<Object<string, boolean>>} Success map
   */
  async deleteMany(keys) {
    await this._ensureInitialized();

    const results = {};

    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => {
        resolve(results);
      };

      transaction.onerror = () => {
        resolve(results);
      };

      for (const key of keys) {
        const fullKey = this._getKey(key);
        const request = store.delete(fullKey);
        request.onsuccess = () => { results[key] = true; };
        request.onerror = () => { results[key] = false; };
      }
    });
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

    const keys = await this.list();
    const results = await this.deleteMany(keys);

    return Object.values(results).filter(Boolean).length;
  }

  /**
   * Get storage statistics.
   *
   * @returns {Promise<import('./StorageAdapter.js').StorageStats>} Stats
   */
  async getStats() {
    await this._ensureInitialized();

    const metadata = await this.listWithMetadata();

    let totalSize = 0;
    for (const meta of metadata) {
      totalSize += meta.size || 0;
    }

    // Estimate quota (IndexedDB doesn't have a standard API for this)
    // Use storage estimate if available
    let quota = 100 * 1024 * 1024; // Default 100MB estimate
    let available = quota - totalSize;

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota || quota;
        available = (estimate.quota - estimate.usage) || available;
      } catch {
        // Use defaults
      }
    }

    return {
      totalKeys: metadata.length,
      totalSize,
      quota,
      available: Math.max(0, available)
    };
  }

  /**
   * Remove expired items.
   *
   * @returns {Promise<number>} Number removed
   */
  async prune() {
    await this._ensureInitialized();

    const now = Date.now();
    const keysToDelete = [];

    return new Promise((resolve, reject) => {
      const store = this._getStore('readonly');
      const index = store.index('expiresAt');

      // Get all entries with expiresAt set
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          // Double-check expiration
          if (entry.expiresAt && entry.expiresAt <= now) {
            keysToDelete.push(this._stripPrefix(entry.key));
          }
          cursor.continue();
        } else {
          // Delete expired entries
          if (keysToDelete.length > 0) {
            await this.deleteMany(keysToDelete);
          }
          resolve(keysToDelete.length);
        }
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Close database connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._initialized = false;
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
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.message.includes('quota'))
    );
  }
}

/**
 * Default IndexedDB adapter instance.
 * @type {IndexedDBAdapter}
 */
export const indexedDBAdapter = new IndexedDBAdapter();
