/**
 * Project Parser
 *
 * Orchestrates parsing of entire projects (multiple files).
 * Uses ParserRegistry to select appropriate parsers for each file type.
 * Builds cross-file reference graphs after all files are parsed.
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

import { parserRegistry } from './ParserRegistry.js';
import { astCache } from './ast/ASTCache.js';

/**
 * @typedef {Object} ProjectFile
 * @property {string} path - Relative path from project root
 * @property {string} content - File content
 * @property {File} [fileObject] - Original File object (if from browser)
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} from - Source file path
 * @property {string} to - Target file path
 * @property {string} type - Edge type ('imports', 'exports', 'references')
 * @property {string[]} [symbols] - Symbols involved in the relationship
 */

/**
 * @typedef {Object} ProjectGraph
 * @property {string[]} nodes - File paths
 * @property {GraphEdge[]} edges - Relationships between files
 */

/**
 * @typedef {Object} ProjectData
 * @property {string} id - Unique project ID
 * @property {string} name - Project name
 * @property {string} rootPath - Root path of the project
 * @property {string} parsedAt - ISO timestamp of parsing
 * @property {Map<string, import('./BaseParser.js').ParsedFile>} files - Parsed files
 * @property {ProjectGraph} graph - Pre-computed relationship graph
 * @property {Object} stats - Parsing statistics
 * @property {string[]} errors - Any errors encountered
 */

/**
 * Project Parser class.
 *
 * Parses entire projects and builds cross-file relationship graphs.
 */
export class ProjectParser {
  constructor() {
    /**
     * Parsed files cache.
     * @type {Map<string, import('./BaseParser.js').ParsedFile>}
     */
    this._parsedFiles = new Map();

    /**
     * Project metadata.
     * @type {Object|null}
     */
    this._projectMeta = null;

    /**
     * Parsing errors.
     * @type {string[]}
     */
    this._errors = [];
  }

  /**
   * Parse a project from an array of files.
   *
   * @param {ProjectFile[]} files - Array of files to parse
   * @param {Object} options - Parsing options
   * @param {string} [options.name] - Project name (defaults to root directory name)
   * @param {string} [options.rootPath] - Root path (defaults to common prefix)
   * @param {Function} [options.onProgress] - Progress callback (current, total, file)
   * @param {Function} [options.onError] - Error callback (file, error)
   * @param {string[]} [options.excludePatterns] - Patterns to exclude
   * @param {boolean} [options.useCache=true] - Use AST cache for unchanged files
   * @returns {Promise<ProjectData>} Parsed project data
   */
  async parseProject(files, options = {}) {
    this._reset();

    // Default to using cache
    const useCache = options.useCache !== false;

    const startTime = Date.now();

    // Filter files that can be parsed
    const parseableFiles = files.filter(f => {
      // Check exclude patterns
      if (options.excludePatterns) {
        for (const pattern of options.excludePatterns) {
          if (this._matchesPattern(f.path, pattern)) {
            return false;
          }
        }
      }
      return parserRegistry.canParse(f.path);
    });

    // Determine project metadata
    const projectName = options.name || this._extractProjectName(files);
    const rootPath = options.rootPath || this._extractRootPath(files);

    this._projectMeta = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: projectName,
      rootPath: rootPath
    };

    // Parse each file
    let parsed = 0;
    let cacheHits = 0;
    for (const file of parseableFiles) {
      try {
        const wasCached = await this._parseFile(file, useCache);
        if (wasCached) cacheHits++;
        parsed++;

        if (options.onProgress) {
          options.onProgress(parsed, parseableFiles.length, file.path);
        }
      } catch (error) {
        const errorMsg = `Error parsing ${file.path}: ${error.message}`;
        this._errors.push(errorMsg);

        if (options.onError) {
          options.onError(file.path, error);
        }
      }
    }

    // Extract cross-file references
    this._extractAllReferences();

    // Build relationship graph
    const graph = this._buildGraph();

    // Collect statistics
    const stats = this._collectStats(parseableFiles.length, Date.now() - startTime, cacheHits);

    return {
      id: this._projectMeta.id,
      name: this._projectMeta.name,
      rootPath: this._projectMeta.rootPath,
      parsedAt: new Date().toISOString(),
      files: this._parsedFiles,
      graph,
      stats,
      errors: this._errors
    };
  }

  /**
   * Parse a project from browser File objects (from directory picker).
   *
   * @param {File[]} fileObjects - Array of File objects
   * @param {Object} options - Parsing options
   * @returns {Promise<ProjectData>} Parsed project data
   */
  async parseFromFileObjects(fileObjects, options = {}) {
    // Convert File objects to ProjectFile format
    const files = await Promise.all(
      fileObjects.map(async (fileObj) => {
        const content = await fileObj.text();
        return {
          path: fileObj.webkitRelativePath || fileObj.name,
          content,
          fileObject: fileObj
        };
      })
    );

    return this.parseProject(files, options);
  }

  /**
   * Parse a single file and add to project.
   *
   * @param {ProjectFile} file - File to parse
   * @param {boolean} [useCache=true] - Whether to use cache
   * @returns {Promise<boolean>} True if result was from cache
   */
  async _parseFile(file, useCache = true) {
    const parser = parserRegistry.getParser(file.path);
    if (!parser) {
      return false;
    }

    let result;
    let fromCache = false;

    // Try to get from cache first
    if (useCache) {
      const cached = astCache.get(file.path, file.content);
      if (cached) {
        result = cached;
        fromCache = true;
      }
    }

    // Parse if not cached
    if (!result) {
      result = parser.parse(file.content, file.path);

      // Store in cache
      if (useCache) {
        astCache.set(file.path, file.content, result);
      }
    }

    // Store file object reference if available
    if (file.fileObject) {
      result.metadata = result.metadata || {};
      result.metadata.fileObject = file.fileObject;
    }

    this._parsedFiles.set(file.path, result);
    return fromCache;
  }

  /**
   * Extract cross-file references for all parsed files.
   * Must be called after all files are parsed.
   *
   * @private
   */
  _extractAllReferences() {
    for (const [filePath, parsedFile] of this._parsedFiles) {
      const parser = parserRegistry.getParser(filePath);
      if (parser && typeof parser.extractReferences === 'function') {
        try {
          const references = parser.extractReferences(parsedFile, this._parsedFiles);
          parsedFile.references = references;
        } catch (error) {
          this._errors.push(`Error extracting references from ${filePath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Build the project relationship graph.
   *
   * @returns {ProjectGraph} Relationship graph
   * @private
   */
  _buildGraph() {
    const nodes = Array.from(this._parsedFiles.keys());
    const edges = [];
    const edgeSet = new Set(); // For deduplication

    for (const [filePath, parsedFile] of this._parsedFiles) {
      // Create edges from imports
      for (const imp of parsedFile.imports) {
        const targetPath = this._resolveImportPath(filePath, imp.from);

        // Only create edge if target exists in project
        if (this._parsedFiles.has(targetPath)) {
          const edgeKey = `${filePath}|${targetPath}|imports`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              from: filePath,
              to: targetPath,
              type: 'imports',
              symbols: imp.symbols
            });
          }
        }
      }

      // Create edges from references
      for (const ref of parsedFile.references || []) {
        if (ref.source && this._parsedFiles.has(ref.source)) {
          const edgeKey = `${filePath}|${ref.source}|references`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              from: filePath,
              to: ref.source,
              type: 'references',
              symbols: [ref.name]
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Resolve an import path relative to the importing file.
   *
   * @param {string} fromPath - Path of the importing file
   * @param {string} importPath - Import path (may be relative)
   * @returns {string} Resolved path
   * @private
   */
  _resolveImportPath(fromPath, importPath) {
    // Non-relative imports (npm packages, aliases)
    if (!importPath.startsWith('.')) {
      return importPath;
    }

    // Get directory of importing file
    const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/')) || '.';

    // Resolve relative path
    const parts = importPath.split('/');
    const resultParts = fromDir.split('/').filter(p => p && p !== '.');

    for (const part of parts) {
      if (part === '..') {
        resultParts.pop();
      } else if (part !== '.') {
        resultParts.push(part);
      }
    }

    let resolved = resultParts.join('/');

    // Try to match with known files (with extension resolution)
    const extensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx', ''];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this._parsedFiles.has(withExt)) {
        return withExt;
      }
      // Also try /index.js pattern
      const indexPath = resolved + '/index' + ext;
      if (this._parsedFiles.has(indexPath)) {
        return indexPath;
      }
    }

    return resolved;
  }

  /**
   * Collect parsing statistics.
   *
   * @param {number} totalFiles - Total files attempted
   * @param {number} duration - Parsing duration in ms
   * @param {number} [cacheHits=0] - Number of cache hits
   * @returns {Object} Statistics
   * @private
   */
  _collectStats(totalFiles, duration, cacheHits = 0) {
    let totalSymbols = 0;
    let totalImports = 0;
    let totalExports = 0;
    let totalReferences = 0;
    const filesByType = {};

    for (const [, parsedFile] of this._parsedFiles) {
      totalSymbols += parsedFile.symbols.length;
      totalImports += parsedFile.imports.length;
      totalExports += parsedFile.exports.length;
      totalReferences += (parsedFile.references || []).length;

      const type = parsedFile.type;
      filesByType[type] = (filesByType[type] || 0) + 1;
    }

    // Get cache stats
    const cacheStats = astCache.getStats();

    return {
      totalFiles,
      parsedFiles: this._parsedFiles.size,
      failedFiles: totalFiles - this._parsedFiles.size,
      totalSymbols,
      totalImports,
      totalExports,
      totalReferences,
      filesByType,
      duration,
      errorsCount: this._errors.length,
      cache: {
        hits: cacheHits,
        misses: this._parsedFiles.size - cacheHits,
        hitRate: this._parsedFiles.size > 0 ? cacheHits / this._parsedFiles.size : 0,
        totalCacheEntries: cacheStats.entries,
        cacheSize: cacheStats.size
      }
    };
  }

  /**
   * Extract project name from files.
   *
   * @param {ProjectFile[]} files - Files
   * @returns {string} Project name
   * @private
   */
  _extractProjectName(files) {
    if (files.length === 0) return 'Unknown Project';

    // Try to get from first file path
    const firstPath = files[0].path;
    const parts = firstPath.split('/').filter(p => p);

    // Return first directory component
    return parts[0] || 'Project';
  }

  /**
   * Extract common root path from files.
   *
   * @param {ProjectFile[]} files - Files
   * @returns {string} Root path
   * @private
   */
  _extractRootPath(files) {
    if (files.length === 0) return '';

    // Find common prefix
    const paths = files.map(f => f.path.split('/'));
    const minLength = Math.min(...paths.map(p => p.length));

    const commonParts = [];
    for (let i = 0; i < minLength - 1; i++) {
      const part = paths[0][i];
      if (paths.every(p => p[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }

    return commonParts.join('/');
  }

  /**
   * Check if a path matches a pattern.
   *
   * @param {string} path - File path
   * @param {string} pattern - Pattern to match (supports * and **)
   * @returns {boolean} True if matches
   * @private
   */
  _matchesPattern(path, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');

    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Reset parser state.
   *
   * @private
   */
  _reset() {
    this._parsedFiles = new Map();
    this._projectMeta = null;
    this._errors = [];
  }

  /**
   * Get a parsed file by path.
   *
   * @param {string} path - File path
   * @returns {import('./BaseParser.js').ParsedFile|undefined} Parsed file
   */
  getFile(path) {
    return this._parsedFiles.get(path);
  }

  /**
   * Get all parsed files.
   *
   * @returns {Map<string, import('./BaseParser.js').ParsedFile>} All parsed files
   */
  getAllFiles() {
    return this._parsedFiles;
  }

  /**
   * Find files that import a specific file.
   *
   * @param {string} targetPath - Path of the target file
   * @returns {string[]} Paths of files that import the target
   */
  findImporters(targetPath) {
    const importers = [];

    for (const [filePath, parsedFile] of this._parsedFiles) {
      for (const imp of parsedFile.imports) {
        const resolved = this._resolveImportPath(filePath, imp.from);
        if (resolved === targetPath) {
          importers.push(filePath);
          break;
        }
      }
    }

    return importers;
  }

  /**
   * Find files that a specific file imports.
   *
   * @param {string} sourcePath - Path of the source file
   * @returns {string[]} Paths of files imported by source
   */
  findImports(sourcePath) {
    const parsedFile = this._parsedFiles.get(sourcePath);
    if (!parsedFile) return [];

    const imports = [];
    for (const imp of parsedFile.imports) {
      const resolved = this._resolveImportPath(sourcePath, imp.from);
      if (this._parsedFiles.has(resolved)) {
        imports.push(resolved);
      }
    }

    return imports;
  }

  /**
   * Find a symbol across all files.
   *
   * @param {string} symbolName - Symbol name to find
   * @param {string} [symbolType] - Optional symbol type filter
   * @returns {Array<{file: string, symbol: import('./BaseParser.js').ParsedSymbol}>} Found symbols
   */
  findSymbol(symbolName, symbolType) {
    const results = [];

    for (const [filePath, parsedFile] of this._parsedFiles) {
      for (const symbol of parsedFile.symbols) {
        if (symbol.name === symbolName) {
          if (!symbolType || symbol.type === symbolType) {
            results.push({ file: filePath, symbol });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get all symbols of a specific type.
   *
   * @param {string} symbolType - Symbol type to find
   * @returns {Array<{file: string, symbol: import('./BaseParser.js').ParsedSymbol}>} Found symbols
   */
  getSymbolsByType(symbolType) {
    const results = [];

    for (const [filePath, parsedFile] of this._parsedFiles) {
      for (const symbol of parsedFile.symbols) {
        if (symbol.type === symbolType) {
          results.push({ file: filePath, symbol });
        }
      }
    }

    return results;
  }
}

/**
 * Singleton project parser instance.
 * @type {ProjectParser}
 */
export const projectParser = new ProjectParser();
