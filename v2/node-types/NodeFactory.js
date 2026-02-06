/**
 * Node Factory
 *
 * Centralized factory for creating node instances consistently.
 * Works with the NodeTypeRegistry to create properly configured nodes.
 *
 * Features:
 * - Create nodes from type definitions
 * - Create nodes from parsed code data
 * - Create nodes from user actions (UI)
 * - Clone and duplicate nodes
 * - Batch node creation
 * - Default value management
 *
 * @see ARCHITECTURE_PLAN.md Module 2 for full documentation
 */

import { nodeTypeRegistry } from './NodeTypeRegistry.js';
import { BaseNodeType } from './BaseNodeType.js';

/**
 * @typedef {Object} NodeCreateOptions
 * @property {string} [id] - Custom node ID (auto-generated if not provided)
 * @property {string} [name] - Node name/title
 * @property {number} [x] - X position
 * @property {number} [y] - Y position
 * @property {number} [width] - Width
 * @property {number} [height] - Height
 * @property {string} [parentId] - Parent node ID
 * @property {Object[]} [children] - Child nodes
 * @property {Object} [style] - Style overrides
 * @property {Object[]} [attributes] - Node attributes
 * @property {*} [*] - Additional type-specific properties
 */

/**
 * @typedef {Object} ParsedSymbolData
 * @property {string} name - Symbol name
 * @property {string} type - Symbol type (class, function, etc.)
 * @property {number} [line] - Line number
 * @property {Object[]} [methods] - Methods (for classes)
 * @property {Object[]} [properties] - Properties (for classes)
 * @property {Object[]} [params] - Parameters (for functions)
 * @property {string} [returnType] - Return type
 * @property {boolean} [async] - Is async
 */

/**
 * Node Factory class.
 */
export class NodeFactory {
  /**
   * Create a new NodeFactory.
   *
   * @param {NodeTypeRegistry} [registry] - Node type registry
   */
  constructor(registry = nodeTypeRegistry) {
    /**
     * Node type registry.
     * @type {NodeTypeRegistry}
     */
    this.registry = registry;

    /**
     * Default position offset for new nodes.
     * @type {{x: number, y: number}}
     */
    this.defaultPosition = { x: 100, y: 100 };

    /**
     * Position offset increment for batch creation.
     * @type {{x: number, y: number}}
     */
    this.positionOffset = { x: 30, y: 30 };

    /**
     * Node ID counter for unique IDs.
     * @type {number}
     * @private
     */
    this._idCounter = 0;
  }

  // =========================================================================
  // Core Creation Methods
  // =========================================================================

  /**
   * Create a node of the specified type.
   *
   * @param {string} typeId - Node type ID
   * @param {NodeCreateOptions} [options] - Creation options
   * @returns {Object} Created node
   * @throws {Error} If type not found
   */
  create(typeId, options = {}) {
    const typeDef = this.registry.get(typeId);

    if (!typeDef) {
      throw new Error(`Unknown node type: ${typeId}`);
    }

    // Generate ID if not provided
    const id = options.id || this._generateId(typeId);

    // Get default style from type
    const defaultStyle = typeDef.defaultStyle || {};

    // Build node
    const node = {
      id,
      type: typeId,
      name: options.name || options.title || typeDef.name,
      x: options.x ?? options.position?.x ?? this.defaultPosition.x,
      y: options.y ?? options.position?.y ?? this.defaultPosition.y,
      width: options.width ?? defaultStyle.width ?? 180,
      height: options.height ?? defaultStyle.height ?? 100,
      collapsed: options.collapsed ?? false,
      expanded: options.expanded ?? true,
      parentId: options.parentId || null,
      style: {
        ...defaultStyle,
        ...options.style
      }
    };

    // Add feature-specific properties
    const features = typeDef.features || {};

    if (features.canHaveChildren) {
      node.children = options.children || [];
    }

    if (features.canHaveAttributes) {
      node.attributes = options.attributes || [];
    }

    if (features.canContainNodes) {
      node.containedNodes = options.containedNodes || [];
      node.containedIn = options.containedIn || null;
    }

    // Add port overrides if provided
    if (options.inputPorts) {
      node.inputPorts = options.inputPorts;
    }
    if (options.outputPorts) {
      node.outputPorts = options.outputPorts;
    }

    // Merge any additional properties
    const reservedKeys = [
      'id', 'type', 'name', 'title', 'x', 'y', 'width', 'height',
      'collapsed', 'expanded', 'parentId', 'children', 'style',
      'attributes', 'containedNodes', 'containedIn', 'inputPorts', 'outputPorts',
      'position'
    ];

    for (const [key, value] of Object.entries(options)) {
      if (!reservedKeys.includes(key) && value !== undefined) {
        node[key] = value;
      }
    }

    return node;
  }

  /**
   * Create a node with automatic positioning.
   *
   * @param {string} typeId - Node type ID
   * @param {NodeCreateOptions} [options] - Creation options
   * @param {Object} [context] - Context for positioning
   * @param {Object[]} [context.existingNodes] - Existing nodes to avoid overlap
   * @param {Object} [context.viewport] - Current viewport
   * @returns {Object} Created node
   */
  createWithAutoPosition(typeId, options = {}, context = {}) {
    // Calculate position if not provided
    if (options.x === undefined || options.y === undefined) {
      const position = this._calculatePosition(typeId, context);
      options = { ...options, ...position };
    }

    return this.create(typeId, options);
  }

  // =========================================================================
  // Code Node Creation (from parsed data)
  // =========================================================================

  /**
   * Create a file node from parsed file data.
   *
   * @param {Object} parsedFile - Parsed file data
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} File node
   */
  createFileNode(parsedFile, options = {}) {
    const node = this.create('file', {
      name: this._getFileName(parsedFile.path),
      filePath: parsedFile.path,
      path: parsedFile.path,
      language: parsedFile.language || this._detectLanguage(parsedFile.path),
      ...options
    });

    // Create child nodes for symbols
    if (parsedFile.symbols && parsedFile.symbols.length > 0) {
      node.children = parsedFile.symbols.map((symbol, index) =>
        this.createSymbolNode(symbol, {
          parentId: node.id,
          x: 50,
          y: 50 + index * 80
        })
      );
    }

    return node;
  }

  /**
   * Create a directory node.
   *
   * @param {string} path - Directory path
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} Directory node
   */
  createDirectoryNode(path, options = {}) {
    return this.create('directory', {
      name: this._getFileName(path),
      path: path,
      expanded: options.expanded ?? true,
      children: options.children || [],
      ...options
    });
  }

  /**
   * Create a node from a parsed symbol (class, function, etc.).
   *
   * @param {ParsedSymbolData} symbol - Parsed symbol data
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} Symbol node
   */
  createSymbolNode(symbol, options = {}) {
    // Map symbol type to node type
    const typeMap = {
      'class': 'class',
      'function': 'function',
      'method': 'method',
      'variable': 'file', // Variables don't have their own type yet
      'constant': 'file'
    };

    const nodeType = typeMap[symbol.type] || 'file';

    const node = this.create(nodeType, {
      name: symbol.name,
      ...options
    });

    // Add type-specific properties
    switch (symbol.type) {
      case 'class':
        node.methods = symbol.methods || [];
        node.properties = symbol.properties || [];
        node.extends = symbol.extends;
        node.implements = symbol.implements;
        break;

      case 'function':
      case 'method':
        node.params = symbol.params || [];
        node.returnType = symbol.returnType;
        node.async = symbol.async || false;
        node.static = symbol.static || false;
        node.visibility = symbol.visibility || 'public';
        break;
    }

    // Add line number if available
    if (symbol.line !== undefined) {
      node.line = symbol.line;
    }

    return node;
  }

  /**
   * Create a class node.
   *
   * @param {string} name - Class name
   * @param {Object} [data] - Class data
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} Class node
   */
  createClassNode(name, data = {}, options = {}) {
    return this.create('class', {
      name,
      methods: data.methods || [],
      properties: data.properties || [],
      extends: data.extends,
      implements: data.implements,
      ...options
    });
  }

  /**
   * Create a function node.
   *
   * @param {string} name - Function name
   * @param {Object} [data] - Function data
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} Function node
   */
  createFunctionNode(name, data = {}, options = {}) {
    return this.create('function', {
      name,
      params: data.params || [],
      returnType: data.returnType,
      async: data.async || false,
      ...options
    });
  }

  /**
   * Create a method node.
   *
   * @param {string} name - Method name
   * @param {Object} [data] - Method data
   * @param {NodeCreateOptions} [options] - Additional options
   * @returns {Object} Method node
   */
  createMethodNode(name, data = {}, options = {}) {
    // Use function type if method type doesn't exist
    const typeId = this.registry.has('method') ? 'method' : 'function';

    return this.create(typeId, {
      name,
      params: data.params || [],
      returnType: data.returnType,
      async: data.async || false,
      static: data.static || false,
      visibility: data.visibility || 'public',
      isMethod: true,
      ...options
    });
  }

  // =========================================================================
  // Organization Node Creation
  // =========================================================================

  /**
   * Create a note node.
   *
   * @param {NodeCreateOptions} [options] - Creation options
   * @returns {Object} Note node
   */
  createNoteNode(options = {}) {
    return this.create('note', {
      name: options.name || 'New Note',
      description: options.description || '',
      color: options.color || '#ffffff',
      showDescription: options.showDescription ?? false,
      titleFontSize: options.titleFontSize || 14,
      descriptionFontSize: options.descriptionFontSize || 14,
      titleColor: options.titleColor || '#000000',
      descriptionColor: options.descriptionColor || '#000000',
      ...options
    });
  }

  /**
   * Create a group node.
   *
   * @param {NodeCreateOptions} [options] - Creation options
   * @returns {Object} Group node
   */
  createGroupNode(options = {}) {
    return this.create('group', {
      name: options.name || 'Group',
      containedNodes: options.containedNodes || [],
      ...options
    });
  }

  /**
   * Create a text node.
   *
   * @param {string} [text] - Text content
   * @param {NodeCreateOptions} [options] - Creation options
   * @returns {Object} Text node
   */
  createTextNode(text = '', options = {}) {
    return this.create('text', {
      name: text || 'Text',
      content: text,
      ...options
    });
  }

  // =========================================================================
  // Cloning and Duplication
  // =========================================================================

  /**
   * Clone a node with a new ID.
   *
   * @param {Object} node - Node to clone
   * @param {Object} [overrides] - Property overrides
   * @returns {Object} Cloned node
   */
  clone(node, overrides = {}) {
    // Deep clone the node
    const cloned = JSON.parse(JSON.stringify(node));

    // Generate new ID
    cloned.id = this._generateId(node.type);

    // Apply overrides
    Object.assign(cloned, overrides);

    // Recursively clone children with new IDs
    if (cloned.children && Array.isArray(cloned.children)) {
      cloned.children = cloned.children.map(child =>
        this.clone(child, { parentId: cloned.id })
      );
    }

    return cloned;
  }

  /**
   * Duplicate a node with offset position.
   *
   * @param {Object} node - Node to duplicate
   * @param {Object} [offset] - Position offset
   * @returns {Object} Duplicated node
   */
  duplicate(node, offset = { x: 30, y: 30 }) {
    return this.clone(node, {
      x: (node.x || 0) + offset.x,
      y: (node.y || 0) + offset.y
    });
  }

  /**
   * Duplicate multiple nodes maintaining relative positions.
   *
   * @param {Object[]} nodes - Nodes to duplicate
   * @param {Object} [offset] - Base offset
   * @returns {Object[]} Duplicated nodes
   */
  duplicateMany(nodes, offset = { x: 30, y: 30 }) {
    // Create ID mapping for updating parent references
    const idMap = new Map();

    // First pass: clone all nodes with new IDs
    const cloned = nodes.map(node => {
      const newNode = this.clone(node, {
        x: (node.x || 0) + offset.x,
        y: (node.y || 0) + offset.y
      });
      idMap.set(node.id, newNode.id);
      return newNode;
    });

    // Second pass: update parent references
    for (const node of cloned) {
      if (node.parentId && idMap.has(node.parentId)) {
        node.parentId = idMap.get(node.parentId);
      }
    }

    return cloned;
  }

  // =========================================================================
  // Batch Creation
  // =========================================================================

  /**
   * Create multiple nodes of the same type.
   *
   * @param {string} typeId - Node type ID
   * @param {number} count - Number of nodes to create
   * @param {NodeCreateOptions} [baseOptions] - Base options for all nodes
   * @returns {Object[]} Created nodes
   */
  createMany(typeId, count, baseOptions = {}) {
    const nodes = [];
    const baseX = baseOptions.x ?? this.defaultPosition.x;
    const baseY = baseOptions.y ?? this.defaultPosition.y;

    for (let i = 0; i < count; i++) {
      const options = {
        ...baseOptions,
        x: baseX + i * this.positionOffset.x,
        y: baseY + i * this.positionOffset.y
      };
      delete options.id; // Generate unique IDs
      nodes.push(this.create(typeId, options));
    }

    return nodes;
  }

  /**
   * Create nodes from an array of configurations.
   *
   * @param {Array<{type: string, options: NodeCreateOptions}>} configs - Node configurations
   * @returns {Object[]} Created nodes
   */
  createFromConfigs(configs) {
    return configs.map(({ type, options }) => this.create(type, options));
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Generate a unique node ID.
   *
   * @param {string} [typeId='node'] - Node type for prefix
   * @returns {string} Unique ID
   * @private
   */
  _generateId(typeId = 'node') {
    this._idCounter++;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${typeId}-${timestamp}-${random}-${this._idCounter}`;
  }

  /**
   * Calculate position for a new node.
   *
   * @param {string} typeId - Node type ID
   * @param {Object} context - Positioning context
   * @returns {{x: number, y: number}} Position
   * @private
   */
  _calculatePosition(typeId, context = {}) {
    const { existingNodes = [], viewport = {} } = context;

    // If viewport provided, center in view
    if (viewport.x !== undefined && viewport.y !== undefined) {
      return {
        x: -viewport.x + 200,
        y: -viewport.y + 200
      };
    }

    // If existing nodes, find empty spot
    if (existingNodes.length > 0) {
      // Simple grid-based placement
      const cols = Math.ceil(Math.sqrt(existingNodes.length + 1));
      const row = Math.floor(existingNodes.length / cols);
      const col = existingNodes.length % cols;

      return {
        x: this.defaultPosition.x + col * 220,
        y: this.defaultPosition.y + row * 150
      };
    }

    return { ...this.defaultPosition };
  }

  /**
   * Get filename from path.
   *
   * @param {string} path - File path
   * @returns {string} Filename
   * @private
   */
  _getFileName(path) {
    if (!path) return 'Unknown';
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  /**
   * Detect language from file extension.
   *
   * @param {string} path - File path
   * @returns {string} Language
   * @private
   */
  _detectLanguage(path) {
    if (!path) return 'unknown';

    const ext = path.split('.').pop()?.toLowerCase();
    const langMap = {
      'js': 'javascript',
      'mjs': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'json': 'json',
      'md': 'markdown'
    };

    return langMap[ext] || 'unknown';
  }

  // =========================================================================
  // Normalization
  // =========================================================================

  /**
   * Normalize a node to the standard data structure.
   *
   * Use this to clean up nodes from external sources (storage, parsing, etc.)
   * to ensure they conform to the expected structure.
   *
   * @param {Object} node - Node to normalize
   * @returns {Object} Normalized node
   */
  normalize(node) {
    if (!node) return null;

    const typeDef = this.registry.get(node.type);
    const typeDefaults = typeDef ? {
      name: typeDef.name,
      defaultStyle: typeDef.defaultStyle
    } : {};

    return BaseNodeType.normalizeNode(node, typeDefaults);
  }

  /**
   * Normalize multiple nodes.
   *
   * @param {Object[]} nodes - Nodes to normalize
   * @returns {Object[]} Normalized nodes
   */
  normalizeMany(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(node => this.normalize(node));
  }

  /**
   * Normalize a node tree recursively, ensuring parent-child relationships.
   *
   * @param {Object} rootNode - Root node with children
   * @returns {Object} Normalized node tree
   */
  normalizeTree(rootNode) {
    if (!rootNode) return null;

    const normalized = this.normalize(rootNode);

    if (normalized.children && Array.isArray(normalized.children)) {
      normalized.children = normalized.children.map(child => {
        const normalizedChild = this.normalizeTree(child);
        if (normalizedChild) {
          normalizedChild.parentId = normalized.id;
        }
        return normalizedChild;
      }).filter(Boolean);
    }

    return normalized;
  }

  /**
   * Validate and normalize nodes loaded from storage.
   *
   * Returns valid normalized nodes and a list of any errors encountered.
   *
   * @param {Object[]} nodes - Nodes from storage
   * @returns {{nodes: Object[], errors: string[]}} Normalized nodes and errors
   */
  normalizeFromStorage(nodes) {
    const normalizedNodes = [];
    const errors = [];

    if (!Array.isArray(nodes)) {
      return { nodes: [], errors: ['Expected array of nodes'] };
    }

    for (const node of nodes) {
      const { node: normalized, errors: nodeErrors } = BaseNodeType.validateAndNormalize(node);

      if (normalized) {
        normalizedNodes.push(normalized);
      }

      if (nodeErrors.length > 0) {
        errors.push(...nodeErrors.map(e => `Node ${node?.id || 'unknown'}: ${e}`));
      }
    }

    return { nodes: normalizedNodes, errors };
  }

  /**
   * Get available node types.
   *
   * @returns {Object[]} Type definitions
   */
  getAvailableTypes() {
    return this.registry.getAll();
  }

  /**
   * Get types by category.
   *
   * @param {string} category - Category name
   * @returns {Object[]} Type definitions
   */
  getTypesByCategory(category) {
    return this.registry.getByCategory(category);
  }

  /**
   * Check if a type exists.
   *
   * @param {string} typeId - Type ID
   * @returns {boolean}
   */
  hasType(typeId) {
    return this.registry.has(typeId);
  }
}

/**
 * Singleton NodeFactory instance.
 * @type {NodeFactory}
 */
export const nodeFactory = new NodeFactory();
