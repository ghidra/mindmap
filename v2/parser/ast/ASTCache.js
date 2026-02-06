/**
 * AST Cache
 *
 * Caches parsed file results to avoid re-parsing unchanged files.
 * Uses content hashing to detect changes and supports optional
 * persistence to localStorage.
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

/**
 * @typedef {Object} CacheEntry
 * @property {string} hash - Content hash
 * @property {import('../BaseParser.js').ParsedFile} data - Parsed data
 * @property {number} timestamp - When entry was created
 * @property {number} accessCount - Number of times accessed
 * @property {number} lastAccess - Last access timestamp
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} hits - Cache hits
 * @property {number} misses - Cache misses
 * @property {number} entries - Current entry count
 * @property {number} size - Approximate size in bytes
 * @property {number} evictions - Number of evictions
 */

/**
 * AST Cache class.
 *
 * Provides caching for parsed file results with content-based invalidation.
 */
export class ASTCache {
  /**
   * Create a new AST cache.
   *
   * @param {Object} options - Cache options
   * @param {number} [options.maxEntries=500] - Maximum cache entries
   * @param {number} [options.maxAge=3600000] - Max entry age in ms (default 1 hour)
   * @param {boolean} [options.persist=false] - Persist to localStorage
   * @param {string} [options.storageKey='ast-cache'] - localStorage key
   */
  constructor(options = {}) {
    /**
     * Maximum number of cache entries.
     * @type {number}
     */
    this._maxEntries = options.maxEntries || 500;

    /**
     * Maximum age for cache entries in milliseconds.
     * @type {number}
     */
    this._maxAge = options.maxAge || 3600000; // 1 hour

    /**
     * Whether to persist cache to localStorage.
     * @type {boolean}
     */
    this._persist = options.persist || false;

    /**
     * localStorage key for persistence.
     * @type {string}
     */
    this._storageKey = options.storageKey || 'ast-cache';

    /**
     * Cache storage.
     * @type {Map<string, CacheEntry>}
     */
    this._cache = new Map();

    /**
     * Cache statistics.
     * @type {CacheStats}
     */
    this._stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      size: 0,
      evictions: 0
    };

    // Load from localStorage if persistence is enabled
    if (this._persist) {
      this._loadFromStorage();
    }
  }

  /**
   * Get cached parse result for a file.
   *
   * @param {string} filePath - File path
   * @param {string} content - Current file content (for hash comparison)
   * @returns {import('../BaseParser.js').ParsedFile|null} Cached result or null
   */
  get(filePath, content) {
    const entry = this._cache.get(filePath);

    if (!entry) {
      this._stats.misses++;
      return null;
    }

    // Check if content has changed
    const currentHash = this._hash(content);
    if (entry.hash !== currentHash) {
      this._stats.misses++;
      this._cache.delete(filePath);
      this._stats.entries--;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this._maxAge) {
      this._stats.misses++;
      this._cache.delete(filePath);
      this._stats.entries--;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();

    this._stats.hits++;
    return entry.data;
  }

  /**
   * Store parsed result in cache.
   *
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} data - Parsed data
   */
  set(filePath, content, data) {
    // Evict if at capacity
    if (this._cache.size >= this._maxEntries && !this._cache.has(filePath)) {
      this._evictLRU();
    }

    const hash = this._hash(content);
    const entry = {
      hash,
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now()
    };

    const isNew = !this._cache.has(filePath);
    this._cache.set(filePath, entry);

    if (isNew) {
      this._stats.entries++;
    }

    // Update size estimate
    this._updateSizeEstimate();

    // Persist if enabled
    if (this._persist) {
      this._saveToStorage();
    }
  }

  /**
   * Check if a file is cached and valid.
   *
   * @param {string} filePath - File path
   * @param {string} content - Current file content
   * @returns {boolean} True if cached and valid
   */
  has(filePath, content) {
    const entry = this._cache.get(filePath);
    if (!entry) return false;

    const currentHash = this._hash(content);
    if (entry.hash !== currentHash) return false;

    if (Date.now() - entry.timestamp > this._maxAge) return false;

    return true;
  }

  /**
   * Invalidate cache entry for a file.
   *
   * @param {string} filePath - File path
   * @returns {boolean} True if entry existed and was removed
   */
  invalidate(filePath) {
    const existed = this._cache.has(filePath);
    if (existed) {
      this._cache.delete(filePath);
      this._stats.entries--;

      if (this._persist) {
        this._saveToStorage();
      }
    }
    return existed;
  }

  /**
   * Invalidate all entries matching a pattern.
   *
   * @param {string|RegExp} pattern - Pattern to match file paths
   * @returns {number} Number of entries invalidated
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const filePath of this._cache.keys()) {
      if (regex.test(filePath)) {
        this._cache.delete(filePath);
        count++;
      }
    }

    this._stats.entries -= count;

    if (count > 0 && this._persist) {
      this._saveToStorage();
    }

    return count;
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    this._cache.clear();
    this._stats.entries = 0;
    this._stats.size = 0;

    if (this._persist) {
      this._removeFromStorage();
    }
  }

  /**
   * Get cache statistics.
   *
   * @returns {CacheStats} Cache statistics
   */
  getStats() {
    return {
      ...this._stats,
      hitRate: this._stats.hits + this._stats.misses > 0
        ? this._stats.hits / (this._stats.hits + this._stats.misses)
        : 0
    };
  }

  /**
   * Reset statistics (keeps cache entries).
   */
  resetStats() {
    this._stats.hits = 0;
    this._stats.misses = 0;
    this._stats.evictions = 0;
  }

  /**
   * Get all cached file paths.
   *
   * @returns {string[]} Cached file paths
   */
  getCachedPaths() {
    return Array.from(this._cache.keys());
  }

  /**
   * Prune expired entries.
   *
   * @returns {number} Number of entries pruned
   */
  prune() {
    const now = Date.now();
    let pruned = 0;

    for (const [filePath, entry] of this._cache) {
      if (now - entry.timestamp > this._maxAge) {
        this._cache.delete(filePath);
        pruned++;
      }
    }

    this._stats.entries -= pruned;
    this._stats.evictions += pruned;

    if (pruned > 0 && this._persist) {
      this._saveToStorage();
    }

    return pruned;
  }

  /**
   * Compute a simple hash for content.
   *
   * @param {string} content - Content to hash
   * @returns {string} Hash string
   * @private
   */
  _hash(content) {
    // Simple but fast hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Include length to reduce collisions
    return `${hash.toString(36)}-${content.length}`;
  }

  /**
   * Evict least recently used entry.
   *
   * @private
   */
  _evictLRU() {
    let oldestPath = null;
    let oldestAccess = Infinity;

    for (const [filePath, entry] of this._cache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestPath = filePath;
      }
    }

    if (oldestPath) {
      this._cache.delete(oldestPath);
      this._stats.entries--;
      this._stats.evictions++;
    }
  }

  /**
   * Update size estimate.
   *
   * @private
   */
  _updateSizeEstimate() {
    let size = 0;
    for (const [, entry] of this._cache) {
      // Rough estimate: JSON stringify the data
      size += JSON.stringify(entry.data).length * 2; // UTF-16
    }
    this._stats.size = size;
  }

  /**
   * Save cache to localStorage.
   *
   * @private
   */
  _saveToStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      // Convert Map to array for serialization
      const data = {
        version: 1,
        entries: Array.from(this._cache.entries()).map(([path, entry]) => ({
          path,
          hash: entry.hash,
          data: entry.data,
          timestamp: entry.timestamp,
          accessCount: entry.accessCount,
          lastAccess: entry.lastAccess
        }))
      };

      localStorage.setItem(this._storageKey, JSON.stringify(data));
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn('ASTCache: Failed to save to localStorage:', error.message);
    }
  }

  /**
   * Load cache from localStorage.
   *
   * @private
   */
  _loadFromStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this._storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      if (data.version !== 1) return;

      const now = Date.now();
      for (const entry of data.entries) {
        // Skip expired entries
        if (now - entry.timestamp > this._maxAge) continue;

        this._cache.set(entry.path, {
          hash: entry.hash,
          data: entry.data,
          timestamp: entry.timestamp,
          accessCount: entry.accessCount,
          lastAccess: entry.lastAccess
        });
      }

      this._stats.entries = this._cache.size;
      this._updateSizeEstimate();
    } catch (error) {
      console.warn('ASTCache: Failed to load from localStorage:', error.message);
    }
  }

  /**
   * Remove cache from localStorage.
   *
   * @private
   */
  _removeFromStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this._storageKey);
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Singleton AST cache instance.
 * @type {ASTCache}
 */
export const astCache = new ASTCache({
  maxEntries: 500,
  maxAge: 3600000, // 1 hour
  persist: true,
  storageKey: 'mindmap-ast-cache'
});
