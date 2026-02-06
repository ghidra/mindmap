/**
 * JavaScript Parser
 *
 * Parses JavaScript and JSX files using regex-based extraction.
 * Extracts classes, functions, methods, variables, imports, and exports.
 *
 * Supports:
 * - Standard class declarations: class ClassName { }
 * - Property assignment class expressions: namespace.ClassName = class { }
 * - Regular functions and arrow functions
 * - ES6 imports and exports
 * - File-level variables
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

import { BaseParser, SymbolType, ImportType, ExportType } from '../BaseParser.js';
import { referenceExtractor } from '../ast/ReferenceExtractor.js';

/**
 * JavaScript parser implementation.
 */
export class JavaScriptParser extends BaseParser {
  /**
   * File extensions this parser handles.
   * @type {string[]}
   */
  static extensions = ['.js', '.mjs', '.jsx'];

  /**
   * Human-readable name for this parser.
   * @type {string}
   */
  static parserName = 'JavaScript Parser';

  /**
   * File type identifier used in ParsedFile.type
   * @type {string}
   */
  static fileType = 'javascript';

  /**
   * Parse JavaScript file content into structured data.
   *
   * @param {string} content - File content
   * @param {string} filePath - Path to the file
   * @returns {import('../BaseParser.js').ParsedFile} Parsed file data
   */
  parse(content, filePath) {
    const result = this._createEmptyResult(filePath);

    // Store content for later reference extraction
    result.metadata._content = content;

    // Track positions of classes and functions to avoid detecting nested items
    const classPositions = [];
    const functionPositions = [];

    try {
      // Parse imports first
      this._parseImports(content, result);

      // Parse exports
      this._parseExports(content, result);

      // Parse standard class declarations
      this._parseStandardClasses(content, result, classPositions);

      // Parse property assignment class expressions
      this._parseClassExpressions(content, result, classPositions);

      // Parse functions (excluding those inside classes)
      this._parseFunctions(content, result, classPositions, functionPositions);

      // Parse arrow functions
      this._parseArrowFunctions(content, result, classPositions, functionPositions);

      // Parse file-level variables
      this._parseVariables(content, result, classPositions, functionPositions);

    } catch (error) {
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Extract references to symbols from other files.
   *
   * Uses ReferenceExtractor to find actual symbol usages (function calls,
   * class instantiations, property accesses) in addition to import statements.
   *
   * @param {import('../BaseParser.js').ParsedFile} parsed - The parsed file
   * @param {Map<string, import('../BaseParser.js').ParsedFile>} allFiles - All parsed files
   * @returns {import('../BaseParser.js').ParsedReference[]} References to other files
   */
  extractReferences(parsed, allFiles) {
    // Get stored content from metadata
    const content = parsed.metadata?._content;

    if (!content) {
      // Fallback to basic import-based references if content not available
      return this._extractBasicReferences(parsed, allFiles);
    }

    // Use ReferenceExtractor for comprehensive reference extraction
    const extractedRefs = referenceExtractor.extract(content, parsed, allFiles);

    // Convert to ParsedReference format
    const references = [];
    for (const ref of extractedRefs) {
      references.push(this._createReference(
        ref.name,
        ref.type,
        ref.usages,
        {
          source: ref.source,
          details: ref.details,
          importedAs: ref.importedAs
        }
      ));
    }

    // Clean up content from metadata (no longer needed)
    delete parsed.metadata._content;

    return references;
  }

  /**
   * Extract basic references from imports only (fallback).
   *
   * @param {import('../BaseParser.js').ParsedFile} parsed - Parsed file
   * @param {Map<string, import('../BaseParser.js').ParsedFile>} allFiles - All files
   * @returns {import('../BaseParser.js').ParsedReference[]} Basic references
   * @private
   */
  _extractBasicReferences(parsed, allFiles) {
    const references = [];

    for (const imp of parsed.imports) {
      const resolvedPath = this._normalizePath(parsed.path, imp.from);

      // Find matching file
      let targetFile = null;
      for (const [filePath] of allFiles) {
        const normalizedTarget = this._addExtensionIfMissing(resolvedPath);
        if (filePath === normalizedTarget || filePath === resolvedPath) {
          targetFile = filePath;
          break;
        }
      }

      if (!targetFile) continue;

      for (const symbolName of imp.symbols) {
        references.push(this._createReference(
          symbolName,
          'import',
          [imp.line],
          { source: targetFile }
        ));
      }
    }

    return references;
  }

  /**
   * Parse ES6 imports.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @private
   */
  _parseImports(content, result) {
    // Match various import patterns:
    // import { a, b } from 'module'
    // import defaultExport from 'module'
    // import * as name from 'module'
    // import 'module' (side effect)
    // import defaultExport, { a, b } from 'module'
    const importRegex = /import\s+(?:(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\}|\*\s+as\s+(\w+))?\s*from\s+)?['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const defaultImport = match[1];
      const namedImports = match[2] ? match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()) : [];
      const namespaceImport = match[3];
      const modulePath = match[4];
      const line = this._getLineNumber(content, match.index);

      // Determine import type
      let importType;
      const symbols = [];

      if (namespaceImport) {
        importType = ImportType.NAMESPACE;
        symbols.push(namespaceImport);
      } else if (defaultImport && namedImports.length === 0) {
        importType = ImportType.DEFAULT;
        symbols.push(defaultImport);
      } else if (namedImports.length > 0) {
        importType = ImportType.NAMED;
        if (defaultImport) symbols.push(defaultImport);
        symbols.push(...namedImports.filter(s => s));
      } else {
        importType = ImportType.SIDE_EFFECT;
      }

      result.imports.push(this._createImport(
        modulePath,
        symbols,
        importType,
        line,
        namespaceImport ? { alias: namespaceImport } : {}
      ));
    }

    // Also detect dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const line = this._getLineNumber(content, match.index);
      result.imports.push(this._createImport(
        match[1],
        [],
        ImportType.DYNAMIC,
        line
      ));
    }
  }

  /**
   * Parse ES6 exports.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @private
   */
  _parseExports(content, result) {
    // Export default
    const defaultExportRegex = /export\s+default\s+(?:class\s+(\w+)|function\s+(\w+)|(\w+))/g;
    let match;

    while ((match = defaultExportRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      const line = this._getLineNumber(content, match.index);
      const symbolType = match[1] ? 'class' : (match[2] ? 'function' : 'variable');

      result.exports.push(this._createExport(
        name,
        ExportType.DEFAULT,
        line,
        { symbolType }
      ));
    }

    // Named exports: export { a, b, c }
    const namedExportRegex = /export\s+\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?/g;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
      const fromModule = match[2];
      const line = this._getLineNumber(content, match.index);
      const exportType = fromModule ? ExportType.RE_EXPORT : ExportType.NAMED;

      names.forEach(name => {
        if (name) {
          result.exports.push(this._createExport(
            name,
            exportType,
            line,
            fromModule ? { from: fromModule } : {}
          ));
        }
      });
    }

    // Export declarations: export function foo() {}, export class Bar {}, export const x = ...
    const declExportRegex = /export\s+(async\s+)?(function|class|const|let|var)\s+(\w+)/g;
    while ((match = declExportRegex.exec(content)) !== null) {
      const symbolType = match[2];
      const name = match[3];
      const line = this._getLineNumber(content, match.index);

      result.exports.push(this._createExport(
        name,
        ExportType.DECLARATION,
        line,
        { symbolType }
      ));
    }

    // Re-export all: export * from 'module'
    const reExportAllRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = reExportAllRegex.exec(content)) !== null) {
      const line = this._getLineNumber(content, match.index);
      result.exports.push(this._createExport(
        '*',
        ExportType.ALL,
        line,
        { from: match[1] }
      ));
    }
  }

  /**
   * Parse standard class declarations.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @param {Array<{start: number, end: number}>} classPositions - Tracks class positions
   * @private
   */
  _parseStandardClasses(content, result, classPositions) {
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2] || null;
      const implementsList = match[3] ? match[3].split(',').map(s => s.trim()) : [];
      const line = this._getLineNumber(content, match.index);

      // Find the end of the class
      const classEnd = this._findMatchingBrace(content, match.index + match[0].length - 1);
      classPositions.push({ start: match.index, end: classEnd });

      // Extract methods and properties
      const { methods, properties } = this._extractClassMembers(content, match.index, classEnd);

      // Check if exported
      const beforeClass = content.substring(Math.max(0, match.index - 20), match.index);
      const isExported = /export\s+(default\s+)?$/.test(beforeClass);

      result.symbols.push(this._createSymbol(
        className,
        SymbolType.CLASS,
        line,
        {
          endLine: this._getLineNumber(content, classEnd),
          parentClass: extendsClass,
          implements: implementsList,
          methods: methods.map(m => m.name),
          properties: properties.map(p => p.name),
          exported: isExported
        }
      ));

      // Add methods as separate symbols
      methods.forEach(method => {
        result.symbols.push(this._createSymbol(
          method.name,
          method.name === 'constructor' ? SymbolType.CONSTRUCTOR : SymbolType.METHOD,
          method.line,
          {
            params: method.parameters,
            async: method.isAsync,
            static: method.isStatic,
            visibility: method.visibility || 'public'
          }
        ));
      });

      // Add properties as separate symbols
      properties.forEach(prop => {
        result.symbols.push(this._createSymbol(
          prop.name,
          SymbolType.PROPERTY,
          prop.line || line,
          { static: prop.isStatic }
        ));
      });
    }
  }

  /**
   * Parse property assignment class expressions.
   * Matches patterns like: namespace.ClassName = class { }
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @param {Array<{start: number, end: number}>} classPositions - Tracks class positions
   * @private
   */
  _parseClassExpressions(content, result, classPositions) {
    const classExprRegex = /([\w.]+)\s*=\s*class(?:\s+extends\s+([\w.]+))?\s*\{/g;
    let match;

    while ((match = classExprRegex.exec(content)) !== null) {
      // Skip if this overlaps with an already detected standard class
      if (this._isInsideRange(match.index, classPositions)) continue;

      const fullName = match[1];
      const extendsClass = match[2] || null;
      const line = this._getLineNumber(content, match.index);

      // Extract just the class name (last part after dot)
      const className = fullName.includes('.') ? fullName.split('.').pop() : fullName;

      // Find the end of the class
      const classEnd = this._findMatchingBrace(content, match.index + match[0].length - 1);
      classPositions.push({ start: match.index, end: classEnd });

      // Extract methods and properties
      const { methods, properties } = this._extractClassMembers(content, match.index, classEnd);

      result.symbols.push(this._createSymbol(
        className,
        SymbolType.CLASS,
        line,
        {
          endLine: this._getLineNumber(content, classEnd),
          parentClass: extendsClass,
          methods: methods.map(m => m.name),
          properties: properties.map(p => p.name)
        }
      ));

      // Add methods and properties as symbols (same as standard classes)
      methods.forEach(method => {
        result.symbols.push(this._createSymbol(
          method.name,
          method.name === 'constructor' ? SymbolType.CONSTRUCTOR : SymbolType.METHOD,
          method.line,
          {
            params: method.parameters,
            async: method.isAsync,
            static: method.isStatic
          }
        ));
      });

      properties.forEach(prop => {
        result.symbols.push(this._createSymbol(
          prop.name,
          SymbolType.PROPERTY,
          prop.line || line
        ));
      });
    }
  }

  /**
   * Parse function declarations.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @param {Array<{start: number, end: number}>} classPositions - Class positions to skip
   * @param {Array<{start: number, end: number}>} functionPositions - Tracks function positions
   * @private
   */
  _parseFunctions(content, result, classPositions, functionPositions) {
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      // Skip if inside a class
      if (this._isInsideRange(match.index, classPositions)) continue;

      const line = this._getLineNumber(content, match.index);
      const beforeFn = content.substring(Math.max(0, match.index - 15), match.index);
      const isExported = beforeFn.includes('export');
      const isAsync = beforeFn.includes('async') || match[0].includes('async');
      const isGenerator = match[0].includes('*');

      const fnEnd = this._findMatchingBrace(content, match.index + match[0].length - 1);
      functionPositions.push({ start: match.index, end: fnEnd });

      const params = match[2].split(',').map(p => p.trim()).filter(Boolean);

      let symbolType = SymbolType.FUNCTION;
      if (isGenerator) symbolType = SymbolType.GENERATOR;
      else if (isAsync) symbolType = SymbolType.ASYNC_FUNCTION;

      result.symbols.push(this._createSymbol(
        match[1],
        symbolType,
        line,
        {
          endLine: this._getLineNumber(content, fnEnd),
          params,
          async: isAsync,
          exported: isExported
        }
      ));
    }
  }

  /**
   * Parse arrow function declarations.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @param {Array<{start: number, end: number}>} classPositions - Class positions to skip
   * @param {Array<{start: number, end: number}>} functionPositions - Function positions to skip
   * @private
   */
  _parseArrowFunctions(content, result, classPositions, functionPositions) {
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>/g;
    let match;

    while ((match = arrowRegex.exec(content)) !== null) {
      // Skip if inside a class or function
      if (this._isInsideRange(match.index, [...classPositions, ...functionPositions])) continue;

      const line = this._getLineNumber(content, match.index);
      const beforeFn = content.substring(Math.max(0, match.index - 10), match.index);
      const isExported = beforeFn.includes('export');
      const isAsync = !!match[2];

      const params = match[3].split(',').map(p => p.trim()).filter(Boolean);

      result.symbols.push(this._createSymbol(
        match[1],
        SymbolType.ARROW_FUNCTION,
        line,
        {
          params,
          async: isAsync,
          exported: isExported
        }
      ));
    }
  }

  /**
   * Parse file-level variable declarations.
   *
   * @param {string} content - File content
   * @param {import('../BaseParser.js').ParsedFile} result - Result object to populate
   * @param {Array<{start: number, end: number}>} classPositions - Class positions to skip
   * @param {Array<{start: number, end: number}>} functionPositions - Function positions to skip
   * @private
   */
  _parseVariables(content, result, classPositions, functionPositions) {
    const varRegex = /(?:export\s+)?(const|let|var)\s+(\w+)\s*=\s*([^;=>\n]+)/g;
    let match;

    while ((match = varRegex.exec(content)) !== null) {
      // Skip if inside a class or function
      if (this._isInsideRange(match.index, [...classPositions, ...functionPositions])) continue;

      const value = match[3].trim();

      // Skip arrow functions (already handled)
      if (value.startsWith('(') || value.includes('=>')) continue;
      // Skip function expressions
      if (value.startsWith('function')) continue;
      // Skip class expressions
      if (value.startsWith('class')) continue;

      const line = this._getLineNumber(content, match.index);
      const kind = match[1];
      const isConst = kind === 'const';

      const beforeVar = content.substring(Math.max(0, match.index - 10), match.index);
      const isExported = beforeVar.includes('export');

      result.symbols.push(this._createSymbol(
        match[2],
        isConst ? SymbolType.CONSTANT : SymbolType.VARIABLE,
        line,
        {
          exported: isExported
        }
      ));
    }
  }

  /**
   * Extract class members (methods and properties).
   *
   * @param {string} content - Full file content
   * @param {number} classStart - Start position of class
   * @param {number} classEnd - End position of class
   * @returns {{methods: Array, properties: Array}} Extracted members
   * @private
   */
  _extractClassMembers(content, classStart, classEnd) {
    const methods = [];
    const properties = [];
    const classCode = content.substring(classStart, classEnd);

    // Find the class body start (opening brace)
    const openBrace = classCode.indexOf('{');
    if (openBrace === -1) return { methods, properties };

    // Keywords to exclude from method detection
    const controlFlowKeywords = ['if', 'for', 'while', 'switch', 'catch', 'with', 'function'];

    // Property detection: this.x = ... in constructor
    const propRegex = /this\.(\w+)\s*=\s*([^;}\n]+)/g;
    let match;
    const seenProps = new Set();

    while ((match = propRegex.exec(classCode)) !== null) {
      if (match.index > openBrace && !seenProps.has(match[1])) {
        seenProps.add(match[1]);
        const propLine = this._getLineNumber(content, classStart + match.index);
        properties.push({
          name: match[1],
          value: match[2].trim().substring(0, 30),
          line: propLine
        });
      }
    }

    // Method detection: newline + optional whitespace + optional async/static + method name + params + brace
    const methodRegex = /(?:^|[\n\r])[\t ]*(?:(async)\s+)?(?:(static)\s+)?(?:(get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;

    while ((match = methodRegex.exec(classCode)) !== null) {
      const isAsync = match[1] === 'async';
      const isStatic = match[2] === 'static';
      const accessor = match[3]; // 'get' or 'set' or undefined
      const methodName = match[4];
      const params = match[5];

      // Skip control flow keywords
      if (controlFlowKeywords.includes(methodName)) continue;

      // Only accept methods inside the class body
      if (match.index > openBrace) {
        const methodLine = this._getLineNumber(content, classStart + match.index);

        let symbolType = SymbolType.METHOD;
        if (accessor === 'get') symbolType = SymbolType.GETTER;
        else if (accessor === 'set') symbolType = SymbolType.SETTER;

        methods.push({
          name: methodName,
          isAsync,
          isStatic,
          type: symbolType,
          parameters: params.split(',').map(p => p.trim()).filter(Boolean),
          visibility: 'public',
          line: methodLine
        });
      }
    }

    return { methods, properties };
  }

  /**
   * Find the matching closing brace for an opening brace.
   *
   * @param {string} content - Content to search
   * @param {number} openIndex - Index of opening brace
   * @returns {number} Index of closing brace or end of content
   * @private
   */
  _findMatchingBrace(content, openIndex) {
    let depth = 1;
    for (let i = openIndex + 1; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      if (depth === 0) return i;
    }
    return content.length;
  }

  /**
   * Check if a position is inside any of the given ranges.
   *
   * @param {number} pos - Position to check
   * @param {Array<{start: number, end: number}>} ranges - Ranges to check against
   * @returns {boolean} True if inside a range
   * @private
   */
  _isInsideRange(pos, ranges) {
    return ranges.some(r => pos >= r.start && pos <= r.end);
  }

  /**
   * Get line number for a position in content.
   *
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} Line number (1-based)
   * @private
   */
  _getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }
}
