/**
 * Reference Extractor
 *
 * Extracts symbol usage references from JavaScript code.
 * Finds where imported symbols are actually used (function calls,
 * class instantiations, property accesses, etc.)
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

/**
 * @typedef {Object} SymbolUsage
 * @property {string} name - Symbol name
 * @property {string} type - Usage type: 'call', 'new', 'access', 'reference', 'extends', 'typeof'
 * @property {number} line - Line number
 * @property {number} [column] - Column number
 * @property {string} [context] - Surrounding context (e.g., "obj.method()")
 * @property {string} [on] - Object/class the reference is on (for method calls)
 */

/**
 * @typedef {Object} ExtractedReference
 * @property {string} name - Symbol name
 * @property {string} type - Primary type of the symbol (class, function, etc.)
 * @property {number[]} usages - Line numbers where used
 * @property {SymbolUsage[]} details - Detailed usage information
 * @property {string} [source] - Source file if imported
 * @property {string} [importedAs] - Local alias if renamed on import
 */

/**
 * Reference Extractor class.
 *
 * Analyzes JavaScript code to find where symbols are used.
 */
export class ReferenceExtractor {
  /**
   * Extract all symbol references from code.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} parsedFile - Parsed file data
   * @param {Map<string, import('../BaseParser.js').ParsedFile>} [allFiles] - All parsed files for context
   * @returns {ExtractedReference[]} Array of references
   */
  extract(content, parsedFile, allFiles = new Map()) {
    const references = new Map(); // symbolName -> ExtractedReference

    // Build import map: localName -> { source, originalName }
    const importMap = this._buildImportMap(parsedFile.imports);

    // Build set of locally defined symbols (to exclude from references)
    const localSymbols = new Set(parsedFile.symbols.map(s => s.name));

    // Extract different types of usages
    this._extractFunctionCalls(content, references, importMap, localSymbols);
    this._extractClassInstantiations(content, references, importMap, localSymbols);
    this._extractPropertyAccesses(content, references, importMap, localSymbols);
    this._extractTypeReferences(content, references, importMap, localSymbols);
    this._extractExtendsReferences(content, references, importMap, localSymbols);
    this._extractIdentifierReferences(content, references, importMap, localSymbols);

    // Convert Map to array and enrich with source info
    return this._finalizeReferences(references, importMap, allFiles, parsedFile.path);
  }

  /**
   * Extract references for a specific imported symbol.
   *
   * @param {string} content - File content
   * @param {string} symbolName - Symbol to find
   * @returns {SymbolUsage[]} Usages of the symbol
   */
  extractForSymbol(content, symbolName) {
    const usages = [];

    // Escape special regex characters in symbol name
    const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Function calls: symbolName(...)
    const callRegex = new RegExp(`\\b${escaped}\\s*\\(`, 'g');
    let match;
    while ((match = callRegex.exec(content)) !== null) {
      usages.push({
        name: symbolName,
        type: 'call',
        line: this._getLineNumber(content, match.index),
        context: this._getContext(content, match.index)
      });
    }

    // Class instantiation: new SymbolName(...)
    const newRegex = new RegExp(`\\bnew\\s+${escaped}\\s*\\(`, 'g');
    while ((match = newRegex.exec(content)) !== null) {
      usages.push({
        name: symbolName,
        type: 'new',
        line: this._getLineNumber(content, match.index),
        context: this._getContext(content, match.index)
      });
    }

    // Property access: symbolName.something
    const accessRegex = new RegExp(`\\b${escaped}\\s*\\.\\s*(\\w+)`, 'g');
    while ((match = accessRegex.exec(content)) !== null) {
      usages.push({
        name: symbolName,
        type: 'access',
        line: this._getLineNumber(content, match.index),
        context: this._getContext(content, match.index),
        on: match[1]
      });
    }

    // Extends: class X extends SymbolName
    const extendsRegex = new RegExp(`\\bextends\\s+${escaped}\\b`, 'g');
    while ((match = extendsRegex.exec(content)) !== null) {
      usages.push({
        name: symbolName,
        type: 'extends',
        line: this._getLineNumber(content, match.index),
        context: this._getContext(content, match.index)
      });
    }

    return usages;
  }

  /**
   * Build a map of imports: localName -> { source, originalName, type }
   *
   * @param {import('../BaseParser.js').ParsedImport[]} imports - Imports
   * @returns {Map<string, Object>} Import map
   * @private
   */
  _buildImportMap(imports) {
    const map = new Map();

    for (const imp of imports) {
      for (const symbol of imp.symbols) {
        // Handle "import { Foo as Bar }" - symbol would be "Foo" but local name is "Bar"
        // For now, treat symbol as both original and local name
        map.set(symbol, {
          source: imp.from,
          originalName: symbol,
          type: imp.type
        });
      }

      // Handle namespace imports: import * as ns from 'module'
      if (imp.alias) {
        map.set(imp.alias, {
          source: imp.from,
          originalName: '*',
          type: 'namespace'
        });
      }
    }

    return map;
  }

  /**
   * Extract function calls.
   *
   * @param {string} content - Content
   * @param {Map} references - References map to populate
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbol names to exclude
   * @private
   */
  _extractFunctionCalls(content, references, importMap, localSymbols) {
    // Match function calls: identifier(
    // Exclude: if(, while(, for(, switch(, catch(, function name(, etc.
    const keywords = ['if', 'while', 'for', 'switch', 'catch', 'function', 'return', 'typeof', 'new'];
    const callRegex = /\b(\w+)\s*\(/g;

    let match;
    while ((match = callRegex.exec(content)) !== null) {
      const name = match[1];

      // Skip keywords and local symbols
      if (keywords.includes(name)) continue;
      if (localSymbols.has(name) && !importMap.has(name)) continue;

      // Check if it's an imported symbol or potentially external
      if (importMap.has(name) || this._isPotentialExternalSymbol(name)) {
        this._addUsage(references, name, {
          name,
          type: 'call',
          line: this._getLineNumber(content, match.index),
          context: this._getContext(content, match.index)
        });
      }
    }
  }

  /**
   * Extract class instantiations (new X()).
   *
   * @param {string} content - Content
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbols
   * @private
   */
  _extractClassInstantiations(content, references, importMap, localSymbols) {
    const newRegex = /\bnew\s+(\w+)(?:\s*\.\s*(\w+))?\s*\(/g;

    let match;
    while ((match = newRegex.exec(content)) !== null) {
      const className = match[1];
      const subClass = match[2]; // For new ns.ClassName()

      // Skip local symbols unless imported
      if (localSymbols.has(className) && !importMap.has(className)) continue;

      if (importMap.has(className) || this._isPotentialExternalSymbol(className)) {
        this._addUsage(references, className, {
          name: className,
          type: 'new',
          line: this._getLineNumber(content, match.index),
          context: this._getContext(content, match.index),
          on: subClass || undefined
        });
      }
    }
  }

  /**
   * Extract property accesses on imported objects.
   *
   * @param {string} content - Content
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbols
   * @private
   */
  _extractPropertyAccesses(content, references, importMap, localSymbols) {
    // Match: identifier.property (not followed by ()
    const accessRegex = /\b(\w+)\s*\.\s*(\w+)(?!\s*\()/g;

    let match;
    while ((match = accessRegex.exec(content)) !== null) {
      const objName = match[1];
      const propName = match[2];

      // Only track if object is imported
      if (!importMap.has(objName)) continue;

      this._addUsage(references, objName, {
        name: objName,
        type: 'access',
        line: this._getLineNumber(content, match.index),
        context: this._getContext(content, match.index),
        on: propName
      });
    }
  }

  /**
   * Extract type references (typeof, instanceof).
   *
   * @param {string} content - Content
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbols
   * @private
   */
  _extractTypeReferences(content, references, importMap, localSymbols) {
    // instanceof checks
    const instanceofRegex = /\binstanceof\s+(\w+)/g;

    let match;
    while ((match = instanceofRegex.exec(content)) !== null) {
      const name = match[1];

      if (localSymbols.has(name) && !importMap.has(name)) continue;

      if (importMap.has(name) || this._isPotentialExternalSymbol(name)) {
        this._addUsage(references, name, {
          name,
          type: 'typeof',
          line: this._getLineNumber(content, match.index),
          context: this._getContext(content, match.index)
        });
      }
    }
  }

  /**
   * Extract extends references in class declarations.
   *
   * @param {string} content - Content
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbols
   * @private
   */
  _extractExtendsReferences(content, references, importMap, localSymbols) {
    const extendsRegex = /\bclass\s+\w+\s+extends\s+(\w+)/g;

    let match;
    while ((match = extendsRegex.exec(content)) !== null) {
      const parentClass = match[1];

      if (localSymbols.has(parentClass) && !importMap.has(parentClass)) continue;

      if (importMap.has(parentClass) || this._isPotentialExternalSymbol(parentClass)) {
        this._addUsage(references, parentClass, {
          name: parentClass,
          type: 'extends',
          line: this._getLineNumber(content, match.index),
          context: this._getContext(content, match.index)
        });
      }
    }
  }

  /**
   * Extract general identifier references.
   * Catches usages that aren't calls, instantiations, or property access.
   *
   * @param {string} content - Content
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Set} localSymbols - Local symbols
   * @private
   */
  _extractIdentifierReferences(content, references, importMap, localSymbols) {
    // Only track imported symbols as general references
    for (const [name] of importMap) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match identifier not followed by ( or preceded by . or new
      const refRegex = new RegExp(`(?<!\\.)\\b${escaped}\\b(?!\\s*[(.])`, 'g');

      let match;
      while ((match = refRegex.exec(content)) !== null) {
        // Skip if inside import statement
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const line = content.substring(lineStart, match.index + match[0].length + 50);
        if (/^\s*import\s/.test(line)) continue;

        this._addUsage(references, name, {
          name,
          type: 'reference',
          line: this._getLineNumber(content, match.index),
          context: this._getContext(content, match.index)
        });
      }
    }
  }

  /**
   * Add a usage to the references map.
   *
   * @param {Map} references - References map
   * @param {string} name - Symbol name
   * @param {SymbolUsage} usage - Usage details
   * @private
   */
  _addUsage(references, name, usage) {
    if (!references.has(name)) {
      references.set(name, {
        name,
        type: 'unknown',
        usages: [],
        details: []
      });
    }

    const ref = references.get(name);

    // Add line number to usages array (deduplicated)
    if (!ref.usages.includes(usage.line)) {
      ref.usages.push(usage.line);
    }

    // Add detailed usage
    ref.details.push(usage);
  }

  /**
   * Check if a name looks like an external symbol (starts with uppercase).
   *
   * @param {string} name - Symbol name
   * @returns {boolean} True if potentially external
   * @private
   */
  _isPotentialExternalSymbol(name) {
    // Classes typically start with uppercase
    return /^[A-Z]/.test(name);
  }

  /**
   * Finalize references with source information.
   *
   * @param {Map} references - References map
   * @param {Map} importMap - Import map
   * @param {Map} allFiles - All parsed files
   * @param {string} currentPath - Current file path
   * @returns {ExtractedReference[]} Final references
   * @private
   */
  _finalizeReferences(references, importMap, allFiles, currentPath) {
    const result = [];

    for (const [name, ref] of references) {
      // Sort usages
      ref.usages.sort((a, b) => a - b);

      // Add source info if imported
      if (importMap.has(name)) {
        const imp = importMap.get(name);
        ref.source = this._resolveImportPath(currentPath, imp.source, allFiles);
        if (imp.originalName !== name) {
          ref.importedAs = name;
        }

        // Try to determine type from source file
        if (allFiles.has(ref.source)) {
          const sourceFile = allFiles.get(ref.source);
          const exportedSymbol = sourceFile.symbols.find(s => s.name === (imp.originalName || name));
          if (exportedSymbol) {
            ref.type = exportedSymbol.type;
          }
        }
      }

      // Infer type from usage patterns if not set
      if (ref.type === 'unknown') {
        ref.type = this._inferTypeFromUsages(ref.details);
      }

      result.push(ref);
    }

    return result;
  }

  /**
   * Infer symbol type from how it's used.
   *
   * @param {SymbolUsage[]} usages - Usages
   * @returns {string} Inferred type
   * @private
   */
  _inferTypeFromUsages(usages) {
    const hasNew = usages.some(u => u.type === 'new');
    const hasExtends = usages.some(u => u.type === 'extends');
    const hasCall = usages.some(u => u.type === 'call');

    if (hasNew || hasExtends) return 'class';
    if (hasCall) return 'function';
    return 'variable';
  }

  /**
   * Resolve an import path relative to current file.
   *
   * @param {string} currentPath - Current file path
   * @param {string} importPath - Import path
   * @param {Map} allFiles - All files
   * @returns {string} Resolved path
   * @private
   */
  _resolveImportPath(currentPath, importPath, allFiles) {
    if (!importPath.startsWith('.')) {
      return importPath; // npm package
    }

    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/')) || '.';
    const parts = importPath.split('/');
    const resultParts = currentDir.split('/').filter(p => p && p !== '.');

    for (const part of parts) {
      if (part === '..') resultParts.pop();
      else if (part !== '.') resultParts.push(part);
    }

    let resolved = resultParts.join('/');

    // Try extensions
    const extensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx', ''];
    for (const ext of extensions) {
      if (allFiles.has(resolved + ext)) return resolved + ext;
      if (allFiles.has(resolved + '/index' + ext)) return resolved + '/index' + ext;
    }

    return resolved;
  }

  /**
   * Get line number for position.
   *
   * @param {string} content - Content
   * @param {number} index - Position
   * @returns {number} Line number (1-based)
   * @private
   */
  _getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Get surrounding context for a match.
   *
   * @param {string} content - Content
   * @param {number} index - Match position
   * @param {number} [length=50] - Context length
   * @returns {string} Context string
   * @private
   */
  _getContext(content, index, length = 50) {
    const start = Math.max(0, index - 10);
    const end = Math.min(content.length, index + length);
    let context = content.substring(start, end).trim();

    // Clean up newlines
    context = context.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    return context;
  }
}

/**
 * Singleton reference extractor instance.
 * @type {ReferenceExtractor}
 */
export const referenceExtractor = new ReferenceExtractor();
