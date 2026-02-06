/**
 * Base Parser
 *
 * Abstract base class for all language-specific parsers.
 * Parsers extract structured data from source code files.
 *
 * Each parser implementation handles specific file extensions and
 * produces a standardized ParsedFile result that can be used by
 * the visualization modes.
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

/**
 * Symbol type enumeration
 * @readonly
 * @enum {string}
 */
export const SymbolType = {
  CLASS: 'class',
  FUNCTION: 'function',
  METHOD: 'method',
  VARIABLE: 'variable',
  CONSTANT: 'constant',
  INTERFACE: 'interface',
  TYPE: 'type',
  ENUM: 'enum',
  PROPERTY: 'property',
  GETTER: 'getter',
  SETTER: 'setter',
  CONSTRUCTOR: 'constructor',
  ARROW_FUNCTION: 'arrow-function',
  GENERATOR: 'generator',
  ASYNC_FUNCTION: 'async-function'
};

/**
 * Import type enumeration
 * @readonly
 * @enum {string}
 */
export const ImportType = {
  DEFAULT: 'default',       // import Foo from './foo'
  NAMED: 'named',           // import { Foo, Bar } from './foo'
  NAMESPACE: 'namespace',   // import * as Foo from './foo'
  SIDE_EFFECT: 'side-effect', // import './foo'
  DYNAMIC: 'dynamic'        // import('./foo')
};

/**
 * Export type enumeration
 * @readonly
 * @enum {string}
 */
export const ExportType = {
  DEFAULT: 'default',       // export default Foo
  NAMED: 'named',           // export { Foo, Bar }
  DECLARATION: 'declaration', // export function foo() {}
  RE_EXPORT: 're-export',   // export { Foo } from './foo'
  ALL: 'all'                // export * from './foo'
};

/**
 * @typedef {Object} ParsedSymbol
 * @property {string} name - Symbol name
 * @property {string} type - Symbol type (from SymbolType enum)
 * @property {number} line - Line number where symbol is defined
 * @property {number} [column] - Column number (optional)
 * @property {number} [endLine] - End line number (optional)
 * @property {number} [endColumn] - End column number (optional)
 * @property {string[]} [params] - Function/method parameters
 * @property {string[]} [methods] - Class methods (for class symbols)
 * @property {string[]} [properties] - Class properties (for class symbols)
 * @property {boolean} [async] - Is async function
 * @property {boolean} [static] - Is static member
 * @property {boolean} [exported] - Is exported
 * @property {string} [visibility] - 'public' | 'private' | 'protected'
 * @property {string} [parentClass] - Parent class name (for extends)
 * @property {string[]} [implements] - Implemented interfaces (for classes)
 * @property {string} [returnType] - Return type annotation (if available)
 * @property {Object} [jsdoc] - JSDoc information
 */

/**
 * @typedef {Object} ParsedImport
 * @property {string} from - Module path
 * @property {string[]} symbols - Imported symbol names
 * @property {string} type - Import type (from ImportType enum)
 * @property {string} [alias] - Alias name (for namespace imports)
 * @property {number} line - Line number
 * @property {boolean} [isTypeOnly] - TypeScript type-only import
 */

/**
 * @typedef {Object} ParsedExport
 * @property {string} name - Exported symbol name
 * @property {string} type - Export type (from ExportType enum)
 * @property {string} [symbolType] - Type of the exported symbol (class, function, etc.)
 * @property {number} line - Line number
 * @property {string} [from] - Source module (for re-exports)
 * @property {boolean} [isTypeOnly] - TypeScript type-only export
 */

/**
 * @typedef {Object} ParsedReference
 * @property {string} name - Referenced symbol name
 * @property {string} type - Type of reference (class, function, etc.)
 * @property {string} [on] - Object/class the reference is on (e.g., method call on class)
 * @property {number[]} usages - Line numbers where symbol is used
 * @property {string} [source] - Source module if imported
 */

/**
 * @typedef {Object} ParsedFile
 * @property {string} path - File path (relative to project root)
 * @property {string} type - File type identifier (e.g., 'javascript', 'typescript')
 * @property {ParsedSymbol[]} symbols - All symbols defined in the file
 * @property {ParsedImport[]} imports - All imports
 * @property {ParsedExport[]} exports - All exports
 * @property {ParsedReference[]} references - References to other symbols
 * @property {Object} [metadata] - Additional parser-specific metadata
 * @property {string[]} [errors] - Any parsing errors encountered
 */

/**
 * Abstract base class for parsers.
 *
 * Subclasses must implement:
 * - static extensions (file extensions this parser handles)
 * - parse(content, filePath) - parse file content
 * - extractReferences(parsed, allFiles) - extract cross-file references
 *
 * @abstract
 */
export class BaseParser {
  /**
   * File extensions this parser can handle.
   * Override in subclasses.
   *
   * @type {string[]}
   * @example ['.js', '.mjs', '.jsx']
   */
  static extensions = [];

  /**
   * Human-readable name for this parser.
   * @type {string}
   */
  static parserName = 'Base Parser';

  /**
   * File type identifier used in ParsedFile.type
   * @type {string}
   */
  static fileType = 'unknown';

  /**
   * Check if this parser can handle a given file.
   *
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if this parser handles the file
   */
  static canParse(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return this.extensions.includes(ext);
  }

  /**
   * Parse file content into structured data.
   *
   * Must be implemented by subclasses.
   *
   * @param {string} content - File content
   * @param {string} filePath - Path to the file (for error reporting)
   * @returns {ParsedFile} Parsed file data
   * @throws {Error} If not implemented
   */
  parse(content, filePath) {
    throw new Error(`${this.constructor.name}.parse() not implemented`);
  }

  /**
   * Extract references to symbols from other files.
   *
   * This is called after all files are parsed to resolve cross-file references.
   *
   * @param {ParsedFile} parsed - The parsed file
   * @param {Map<string, ParsedFile>} allFiles - Map of all parsed files (path -> ParsedFile)
   * @returns {ParsedReference[]} Array of references to other files
   */
  extractReferences(parsed, allFiles) {
    throw new Error(`${this.constructor.name}.extractReferences() not implemented`);
  }

  /**
   * Create an empty ParsedFile structure.
   *
   * Helper method for subclasses.
   *
   * @param {string} filePath - File path
   * @returns {ParsedFile} Empty parsed file structure
   * @protected
   */
  _createEmptyResult(filePath) {
    return {
      path: filePath,
      type: this.constructor.fileType,
      symbols: [],
      imports: [],
      exports: [],
      references: [],
      metadata: {},
      errors: []
    };
  }

  /**
   * Create a symbol object.
   *
   * Helper method for subclasses.
   *
   * @param {string} name - Symbol name
   * @param {string} type - Symbol type (from SymbolType)
   * @param {number} line - Line number
   * @param {Object} [extra] - Additional properties
   * @returns {ParsedSymbol} Symbol object
   * @protected
   */
  _createSymbol(name, type, line, extra = {}) {
    return {
      name,
      type,
      line,
      ...extra
    };
  }

  /**
   * Create an import object.
   *
   * Helper method for subclasses.
   *
   * @param {string} from - Module path
   * @param {string[]} symbols - Imported symbols
   * @param {string} type - Import type (from ImportType)
   * @param {number} line - Line number
   * @param {Object} [extra] - Additional properties
   * @returns {ParsedImport} Import object
   * @protected
   */
  _createImport(from, symbols, type, line, extra = {}) {
    return {
      from,
      symbols,
      type,
      line,
      ...extra
    };
  }

  /**
   * Create an export object.
   *
   * Helper method for subclasses.
   *
   * @param {string} name - Exported name
   * @param {string} type - Export type (from ExportType)
   * @param {number} line - Line number
   * @param {Object} [extra] - Additional properties
   * @returns {ParsedExport} Export object
   * @protected
   */
  _createExport(name, type, line, extra = {}) {
    return {
      name,
      type,
      line,
      ...extra
    };
  }

  /**
   * Create a reference object.
   *
   * Helper method for subclasses.
   *
   * @param {string} name - Referenced symbol name
   * @param {string} type - Reference type
   * @param {number[]} usages - Line numbers of usages
   * @param {Object} [extra] - Additional properties
   * @returns {ParsedReference} Reference object
   * @protected
   */
  _createReference(name, type, usages, extra = {}) {
    return {
      name,
      type,
      usages,
      ...extra
    };
  }

  /**
   * Normalize a module path (resolve relative paths, etc.)
   *
   * Helper method for subclasses.
   *
   * @param {string} fromPath - Current file path
   * @param {string} importPath - Import path (may be relative)
   * @returns {string} Normalized path
   * @protected
   */
  _normalizePath(fromPath, importPath) {
    // Don't normalize non-relative paths (npm packages, aliases)
    if (!importPath.startsWith('.')) {
      return importPath;
    }

    // Get directory of current file
    const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));

    // Resolve relative path
    const parts = importPath.split('/');
    const resultParts = fromDir.split('/').filter(p => p);

    for (const part of parts) {
      if (part === '..') {
        resultParts.pop();
      } else if (part !== '.') {
        resultParts.push(part);
      }
    }

    return resultParts.join('/');
  }

  /**
   * Add a file extension if missing.
   *
   * Helper method for subclasses.
   *
   * @param {string} path - File path
   * @param {string[]} [extensions] - Extensions to try (defaults to parser's extensions)
   * @returns {string} Path with extension
   * @protected
   */
  _addExtensionIfMissing(path, extensions = null) {
    const exts = extensions || this.constructor.extensions;

    // Check if already has a recognized extension
    for (const ext of exts) {
      if (path.endsWith(ext)) {
        return path;
      }
    }

    // Return first extension as default
    return path + (exts[0] || '.js');
  }
}
