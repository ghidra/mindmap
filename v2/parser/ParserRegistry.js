/**
 * Parser Registry
 *
 * Central registry for language-specific parsers.
 * Maps file extensions to parser implementations.
 *
 * Usage:
 *   import { parserRegistry } from './ParserRegistry.js';
 *   import { JavaScriptParser } from './parsers/JavaScriptParser.js';
 *
 *   // Register a parser
 *   parserRegistry.register(JavaScriptParser);
 *
 *   // Get parser for a file
 *   const parser = parserRegistry.getParser('src/app.js');
 *   const result = parser.parse(content, 'src/app.js');
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

/**
 * Parser Registry class.
 *
 * Manages parser registration and lookup by file extension.
 * Each parser class is registered once and instantiated on demand.
 */
class ParserRegistry {
  constructor() {
    /**
     * Map of file extension to parser class.
     * @type {Map<string, typeof import('./BaseParser.js').BaseParser>}
     */
    this._parsersByExtension = new Map();

    /**
     * Map of parser ID to parser class.
     * @type {Map<string, typeof import('./BaseParser.js').BaseParser>}
     */
    this._parsersById = new Map();

    /**
     * Cached parser instances.
     * @type {Map<string, import('./BaseParser.js').BaseParser>}
     */
    this._instances = new Map();
  }

  /**
   * Register a parser class.
   *
   * The parser class must have:
   * - static extensions: string[] - file extensions it handles
   * - static parserName: string - human-readable name
   * - static fileType: string - identifier for ParsedFile.type
   *
   * @param {typeof import('./BaseParser.js').BaseParser} ParserClass - Parser class to register
   * @throws {Error} If parser has no extensions defined
   * @returns {ParserRegistry} this (for chaining)
   */
  register(ParserClass) {
    const extensions = ParserClass.extensions;

    if (!extensions || extensions.length === 0) {
      throw new Error(`Parser ${ParserClass.parserName || ParserClass.name} has no extensions defined`);
    }

    // Register by each extension
    for (const ext of extensions) {
      const normalizedExt = ext.toLowerCase();

      // Warn if overwriting existing parser
      if (this._parsersByExtension.has(normalizedExt)) {
        const existing = this._parsersByExtension.get(normalizedExt);
        console.warn(
          `ParserRegistry: Overwriting parser for ${normalizedExt} ` +
          `(${existing.parserName} -> ${ParserClass.parserName})`
        );
      }

      this._parsersByExtension.set(normalizedExt, ParserClass);
    }

    // Register by ID (using fileType as ID)
    const id = ParserClass.fileType || ParserClass.name;
    this._parsersById.set(id, ParserClass);

    return this;
  }

  /**
   * Unregister a parser class.
   *
   * @param {typeof import('./BaseParser.js').BaseParser} ParserClass - Parser class to unregister
   * @returns {boolean} True if parser was registered and removed
   */
  unregister(ParserClass) {
    const extensions = ParserClass.extensions || [];
    let removed = false;

    for (const ext of extensions) {
      const normalizedExt = ext.toLowerCase();
      if (this._parsersByExtension.get(normalizedExt) === ParserClass) {
        this._parsersByExtension.delete(normalizedExt);
        removed = true;
      }
    }

    // Remove from ID map
    const id = ParserClass.fileType || ParserClass.name;
    if (this._parsersById.get(id) === ParserClass) {
      this._parsersById.delete(id);
    }

    // Clear cached instance
    this._instances.delete(id);

    return removed;
  }

  /**
   * Get parser instance for a file path.
   *
   * @param {string} filePath - Path to the file
   * @returns {import('./BaseParser.js').BaseParser|null} Parser instance or null if no parser found
   */
  getParser(filePath) {
    const ParserClass = this.getParserClass(filePath);
    if (!ParserClass) {
      return null;
    }

    return this._getInstance(ParserClass);
  }

  /**
   * Get parser class for a file path.
   *
   * @param {string} filePath - Path to the file
   * @returns {typeof import('./BaseParser.js').BaseParser|null} Parser class or null
   */
  getParserClass(filePath) {
    const ext = this._getExtension(filePath);
    return this._parsersByExtension.get(ext) || null;
  }

  /**
   * Get parser instance by ID (fileType).
   *
   * @param {string} id - Parser ID (fileType)
   * @returns {import('./BaseParser.js').BaseParser|null} Parser instance or null
   */
  getParserById(id) {
    const ParserClass = this._parsersById.get(id);
    if (!ParserClass) {
      return null;
    }

    return this._getInstance(ParserClass);
  }

  /**
   * Check if a parser exists for a file.
   *
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if a parser is registered for this file type
   */
  canParse(filePath) {
    const ext = this._getExtension(filePath);
    return this._parsersByExtension.has(ext);
  }

  /**
   * Get all registered file extensions.
   *
   * @returns {string[]} Array of registered extensions
   */
  getRegisteredExtensions() {
    return Array.from(this._parsersByExtension.keys());
  }

  /**
   * Get all registered parser classes.
   *
   * @returns {Array<typeof import('./BaseParser.js').BaseParser>} Array of unique parser classes
   */
  getRegisteredParsers() {
    return Array.from(new Set(this._parsersByExtension.values()));
  }

  /**
   * Get parser info for all registered parsers.
   *
   * @returns {Array<{id: string, name: string, extensions: string[]}>} Parser info
   */
  getParserInfo() {
    const parsers = this.getRegisteredParsers();
    return parsers.map(ParserClass => ({
      id: ParserClass.fileType || ParserClass.name,
      name: ParserClass.parserName || ParserClass.name,
      extensions: ParserClass.extensions || []
    }));
  }

  /**
   * Clear all registered parsers.
   */
  clear() {
    this._parsersByExtension.clear();
    this._parsersById.clear();
    this._instances.clear();
  }

  /**
   * Get or create parser instance.
   *
   * @param {typeof import('./BaseParser.js').BaseParser} ParserClass - Parser class
   * @returns {import('./BaseParser.js').BaseParser} Parser instance
   * @private
   */
  _getInstance(ParserClass) {
    const id = ParserClass.fileType || ParserClass.name;

    if (!this._instances.has(id)) {
      this._instances.set(id, new ParserClass());
    }

    return this._instances.get(id);
  }

  /**
   * Extract file extension from path.
   *
   * @param {string} filePath - File path
   * @returns {string} Lowercase extension including dot (e.g., '.js')
   * @private
   */
  _getExtension(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) {
      return '';
    }
    return filePath.substring(lastDot).toLowerCase();
  }
}

/**
 * Singleton parser registry instance.
 * @type {ParserRegistry}
 */
export const parserRegistry = new ParserRegistry();

/**
 * Export the class for testing or custom instances.
 */
export { ParserRegistry };
