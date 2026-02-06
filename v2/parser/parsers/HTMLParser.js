/**
 * HTML Parser
 *
 * Parses HTML files to extract script references, stylesheets, and metadata.
 * Primarily used for entry point detection in web applications.
 *
 * Extracts:
 * - Script tags (src and inline)
 * - Link/style tags for CSS
 * - Meta tags
 * - Title
 * - Module vs classic script detection
 *
 * @see ARCHITECTURE_PLAN.md Module 1 for full documentation
 */

import { BaseParser, SymbolType, ImportType, ExportType } from '../BaseParser.js';

/**
 * @typedef {Object} ScriptInfo
 * @property {string} [src] - Script source path (external scripts)
 * @property {string} [content] - Inline script content
 * @property {boolean} isModule - Whether script is type="module"
 * @property {boolean} isAsync - Has async attribute
 * @property {boolean} isDefer - Has defer attribute
 * @property {number} line - Line number in HTML
 * @property {number} order - Order of appearance
 */

/**
 * @typedef {Object} StyleInfo
 * @property {string} [href] - Stylesheet href (external)
 * @property {string} [content] - Inline style content
 * @property {number} line - Line number
 */

/**
 * HTML parser implementation.
 */
export class HTMLParser extends BaseParser {
  /**
   * File extensions this parser handles.
   * @type {string[]}
   */
  static extensions = ['.html', '.htm'];

  /**
   * Human-readable name for this parser.
   * @type {string}
   */
  static parserName = 'HTML Parser';

  /**
   * File type identifier.
   * @type {string}
   */
  static fileType = 'html';

  /**
   * Parse HTML file content.
   *
   * @param {string} content - File content
   * @param {string} filePath - Path to the file
   * @returns {import('../BaseParser.js').ParsedFile} Parsed file data
   */
  parse(content, filePath) {
    const result = this._createEmptyResult(filePath);

    try {
      // Extract scripts
      const scripts = this._extractScripts(content);

      // Extract styles
      const styles = this._extractStyles(content);

      // Extract metadata
      const metadata = this._extractMetadata(content);

      // Store in result metadata
      result.metadata = {
        ...result.metadata,
        scripts,
        styles,
        title: metadata.title,
        meta: metadata.meta,
        entryPoints: this._identifyEntryPoints(scripts, filePath)
      };

      // Create symbols for external scripts (as imports)
      scripts.forEach((script, index) => {
        if (script.src) {
          // Add as import
          result.imports.push(this._createImport(
            script.src,
            [],
            script.isModule ? ImportType.SIDE_EFFECT : ImportType.SIDE_EFFECT,
            script.line,
            {
              isModule: script.isModule,
              isAsync: script.isAsync,
              isDefer: script.isDefer,
              order: index
            }
          ));

          // Add as symbol reference
          result.symbols.push(this._createSymbol(
            this._getScriptName(script.src),
            SymbolType.VARIABLE,
            script.line,
            {
              scriptSrc: script.src,
              isModule: script.isModule,
              isEntryPoint: this._isLikelyEntryPoint(script.src)
            }
          ));
        } else if (script.content) {
          // Inline script - add as symbol
          result.symbols.push(this._createSymbol(
            `inline-script-${index + 1}`,
            SymbolType.FUNCTION,
            script.line,
            {
              inline: true,
              isModule: script.isModule,
              contentPreview: script.content.substring(0, 100)
            }
          ));
        }
      });

      // Create symbols for stylesheets
      styles.forEach((style, index) => {
        if (style.href) {
          result.imports.push(this._createImport(
            style.href,
            [],
            ImportType.SIDE_EFFECT,
            style.line,
            { type: 'stylesheet' }
          ));
        }
      });

    } catch (error) {
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Extract references - for HTML, this means finding JS files that are loaded.
   *
   * @param {import('../BaseParser.js').ParsedFile} parsed - Parsed file
   * @param {Map<string, import('../BaseParser.js').ParsedFile>} allFiles - All files
   * @returns {import('../BaseParser.js').ParsedReference[]} References
   */
  extractReferences(parsed, allFiles) {
    const references = [];

    // Create references for each script import
    for (const imp of parsed.imports) {
      const resolvedPath = this._resolveScriptPath(parsed.path, imp.from, allFiles);

      if (resolvedPath && allFiles.has(resolvedPath)) {
        references.push(this._createReference(
          this._getScriptName(imp.from),
          'script',
          [imp.line],
          { source: resolvedPath }
        ));
      }
    }

    return references;
  }

  /**
   * Extract script tags from HTML.
   *
   * @param {string} content - HTML content
   * @returns {ScriptInfo[]} Script information
   * @private
   */
  _extractScripts(content) {
    const scripts = [];

    // Match script tags (both self-closing style and with content)
    const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>|<script([^>]*)\/>/gi;

    let match;
    let order = 0;

    while ((match = scriptRegex.exec(content)) !== null) {
      const attributes = match[1] || match[3] || '';
      const inlineContent = match[2] || '';
      const line = this._getLineNumber(content, match.index);

      const script = {
        src: this._extractAttribute(attributes, 'src'),
        content: inlineContent.trim() || null,
        isModule: /type\s*=\s*["']module["']/i.test(attributes),
        isAsync: /\basync\b/i.test(attributes),
        isDefer: /\bdefer\b/i.test(attributes),
        line,
        order: order++
      };

      // Only add if has src or non-empty content
      if (script.src || script.content) {
        scripts.push(script);
      }
    }

    return scripts;
  }

  /**
   * Extract style/link tags from HTML.
   *
   * @param {string} content - HTML content
   * @returns {StyleInfo[]} Style information
   * @private
   */
  _extractStyles(content) {
    const styles = [];

    // Match link tags with rel="stylesheet"
    const linkRegex = /<link([^>]*rel\s*=\s*["']stylesheet["'][^>]*)>/gi;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const href = this._extractAttribute(match[1], 'href');
      if (href) {
        styles.push({
          href,
          line: this._getLineNumber(content, match.index)
        });
      }
    }

    // Match style tags
    const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
    while ((match = styleRegex.exec(content)) !== null) {
      const inlineContent = match[2].trim();
      if (inlineContent) {
        styles.push({
          content: inlineContent,
          line: this._getLineNumber(content, match.index)
        });
      }
    }

    return styles;
  }

  /**
   * Extract metadata from HTML.
   *
   * @param {string} content - HTML content
   * @returns {{title: string|null, meta: Object}} Metadata
   * @private
   */
  _extractMetadata(content) {
    const metadata = {
      title: null,
      meta: {}
    };

    // Extract title
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Extract meta tags
    const metaRegex = /<meta([^>]*)>/gi;
    let match;

    while ((match = metaRegex.exec(content)) !== null) {
      const name = this._extractAttribute(match[1], 'name') ||
                   this._extractAttribute(match[1], 'property');
      const metaContent = this._extractAttribute(match[1], 'content');

      if (name && metaContent) {
        metadata.meta[name] = metaContent;
      }

      // Handle charset
      const charset = this._extractAttribute(match[1], 'charset');
      if (charset) {
        metadata.meta.charset = charset;
      }
    }

    return metadata;
  }

  /**
   * Identify likely entry point scripts.
   *
   * @param {ScriptInfo[]} scripts - All scripts
   * @param {string} htmlPath - Path to HTML file
   * @returns {string[]} Entry point script paths
   * @private
   */
  _identifyEntryPoints(scripts, htmlPath) {
    const entryPoints = [];

    // Entry point indicators (in priority order)
    const entryPointPatterns = [
      /main\.m?js$/i,
      /index\.m?js$/i,
      /app\.m?js$/i,
      /bundle\.m?js$/i,
      /entry\.m?js$/i
    ];

    for (const script of scripts) {
      if (!script.src) continue;

      // Check against patterns
      for (const pattern of entryPointPatterns) {
        if (pattern.test(script.src)) {
          entryPoints.push(script.src);
          break;
        }
      }

      // Module scripts are often entry points
      if (script.isModule && !entryPoints.includes(script.src)) {
        entryPoints.push(script.src);
      }
    }

    // If no entry points found, use first script with src
    if (entryPoints.length === 0) {
      const firstExternal = scripts.find(s => s.src);
      if (firstExternal) {
        entryPoints.push(firstExternal.src);
      }
    }

    return entryPoints;
  }

  /**
   * Check if a script path looks like an entry point.
   *
   * @param {string} src - Script source path
   * @returns {boolean} True if likely entry point
   * @private
   */
  _isLikelyEntryPoint(src) {
    const patterns = [
      /main\.m?js$/i,
      /index\.m?js$/i,
      /app\.m?js$/i,
      /bundle\.m?js$/i,
      /entry\.m?js$/i
    ];
    return patterns.some(p => p.test(src));
  }

  /**
   * Extract an attribute value from an attribute string.
   *
   * @param {string} attributes - Attribute string
   * @param {string} name - Attribute name
   * @returns {string|null} Attribute value or null
   * @private
   */
  _extractAttribute(attributes, name) {
    // Match: name="value" or name='value' or name=value
    const regex = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']|${name}\\s*=\\s*(\\S+)`, 'i');
    const match = regex.exec(attributes);
    return match ? (match[1] || match[2]) : null;
  }

  /**
   * Get script name from path.
   *
   * @param {string} src - Script source path
   * @returns {string} Script name
   * @private
   */
  _getScriptName(src) {
    const parts = src.split('/');
    return parts[parts.length - 1].replace(/\.[^.]+$/, '');
  }

  /**
   * Resolve script path relative to HTML file.
   *
   * @param {string} htmlPath - HTML file path
   * @param {string} scriptSrc - Script src attribute
   * @param {Map} allFiles - All parsed files
   * @returns {string|null} Resolved path or null
   * @private
   */
  _resolveScriptPath(htmlPath, scriptSrc, allFiles) {
    // Absolute paths (starting with /) are relative to project root
    if (scriptSrc.startsWith('/')) {
      const withoutSlash = scriptSrc.substring(1);
      if (allFiles.has(withoutSlash)) return withoutSlash;
      return null;
    }

    // External URLs
    if (scriptSrc.startsWith('http://') || scriptSrc.startsWith('https://')) {
      return null;
    }

    // Relative paths
    const htmlDir = htmlPath.substring(0, htmlPath.lastIndexOf('/')) || '.';
    const resolved = this._normalizePath(htmlPath, scriptSrc);

    // Try with various extensions
    const extensions = ['', '.js', '.mjs'];
    for (const ext of extensions) {
      if (allFiles.has(resolved + ext)) return resolved + ext;
    }

    return null;
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
}
