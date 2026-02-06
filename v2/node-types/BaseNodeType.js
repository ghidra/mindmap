/**
 * Base Node Type - Abstract base class for all node type definitions
 *
 * Provides common functionality and default implementations for:
 * - Node creation and validation
 * - Port configuration (static, dynamic, manual override)
 * - Content rendering
 * - Serialization/deserialization
 * - Connection validation
 * - Event handling (double-click, etc.)
 *
 * ## Port System
 *
 * Ports can be defined in three ways (in order of priority):
 *
 * 1. **Manual Override**: Set `node.inputPorts` and/or `node.outputPorts` arrays
 *    - Each entry can be a string (port name) or object {name, value, dataType}
 *    - Example: node.inputPorts = ['param1', {name: 'param2', value: '42'}]
 *
 * 2. **Dynamic Generation**: Define `getPorts(node)` on the type definition
 *    - Returns array of port definitions based on node data
 *    - Used by FunctionNode (parameters), ClassNode (properties), FileNode (variables)
 *
 * 3. **Static Defaults**: Define `defaultPorts` array on the type definition
 *    - Used as fallback when no dynamic ports are generated
 *
 * ## Data Type Colors
 *
 * Ports can have a `dataType` property that determines their color:
 * - number: Orange (#f39c12)
 * - string: Green (#27ae60)
 * - boolean: Purple (#9b59b6)
 * - array: Blue (#3498db)
 * - object: Red (#e74c3c)
 * - function: Teal (#1abc9c)
 * - unknown: Black (#000000)
 *
 * ## Usage
 *
 * Node types can be defined in two ways:
 *
 * 1. **Class-based** (recommended for complex types):
 * ```javascript
 * class MyNodeType extends BaseNodeType {
 *   static id = 'my-node';
 *   static displayName = 'My Node';
 *   static category = 'custom';
 *   static icon = '🎯';
 *
 *   static getPorts(node) { return [...]; }
 *   static renderContent(node, container) { ... }
 * }
 * ```
 *
 * 2. **Object-based** (for simple types):
 * ```javascript
 * const MyNodeType = {
 *   id: 'my-node',
 *   name: 'My Node',
 *   category: 'custom',
 *   icon: '🎯',
 *   getPorts: (node) => [...],
 *   renderContent: (node, container) => { ... }
 * };
 * ```
 *
 * @see ARCHITECTURE_PLAN.md Module 2 for full documentation
 */

/**
 * @typedef {Object} PortDefinition
 * @property {string} id - Unique port identifier
 * @property {'left'|'right'|'top'|'bottom'} side - Port side
 * @property {'input'|'output'} type - Port type
 * @property {number} position - Position on side (0-1)
 * @property {string} [label] - Port label
 * @property {string} [dataType] - Data type for coloring
 * @property {number} [maxConnections] - Maximum connections (-1 for unlimited)
 * @property {boolean} [required] - Whether port is required
 */

/**
 * @typedef {Object} NodeStyle
 * @property {number} width - Node width
 * @property {number} height - Node height
 * @property {string} color - Background color
 * @property {string} borderColor - Border color
 * @property {number} borderWidth - Border width
 * @property {number} borderRadius - Border radius
 */

/**
 * @typedef {Object} NodeFeatures
 * @property {boolean} canHaveChildren - Can contain child nodes
 * @property {boolean} canHaveAttributes - Can have attributes
 * @property {boolean} canResize - Can be resized by user
 * @property {boolean} canContainNodes - Can visually contain other nodes (groups)
 * @property {boolean} canCollapse - Can be collapsed
 * @property {boolean} canEdit - Can be edited inline
 */

/**
 * @typedef {Object} NodeInstance
 * @property {string} id - Unique node identifier
 * @property {string} type - Node type ID
 * @property {string} name - Display name
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} width - Width
 * @property {number} height - Height
 * @property {boolean} [collapsed] - Whether collapsed
 * @property {boolean} [expanded] - Whether expanded (children visible)
 * @property {Object[]} [children] - Child nodes
 * @property {string} [parentId] - Parent node ID
 * @property {Object} [style] - Custom style overrides
 */

/**
 * Base node type class.
 *
 * Can be used as a class to extend, or instantiated with a config object.
 */
export class BaseNodeType {
  // =========================================================================
  // Static Properties (for class-based node types)
  // =========================================================================

  /**
   * Unique type identifier.
   * @type {string}
   */
  static id = '';

  /**
   * Display name.
   * @type {string}
   */
  static displayName = '';

  /**
   * Category for organization.
   * @type {'code'|'organization'|'data'}
   */
  static category = 'organization';

  /**
   * Icon (emoji or class).
   * @type {string}
   */
  static icon = '📄';

  /**
   * Default port definitions.
   * @type {PortDefinition[]}
   */
  static defaultPorts = [];

  /**
   * Default style.
   * @type {NodeStyle}
   */
  static defaultStyle = {
    width: 180,
    height: 100,
    color: '#ffffff',
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 4
  };

  /**
   * Feature flags.
   * @type {NodeFeatures}
   */
  static features = {
    canHaveChildren: false,
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false,
    canCollapse: true,
    canEdit: true
  };

  // =========================================================================
  // Constructor (for object-based node types)
  // =========================================================================

  /**
   * Create a node type from a configuration object.
   *
   * @param {Object} config - Node type configuration
   * @param {string} config.id - Type ID
   * @param {string} config.name - Display name
   * @param {string} [config.category] - Category
   * @param {string} [config.icon] - Icon
   * @param {PortDefinition[]} [config.defaultPorts] - Default ports
   * @param {NodeStyle} [config.defaultStyle] - Default style
   * @param {NodeFeatures} [config.features] - Features
   * @param {Function} [config.getPorts] - Dynamic port generator
   * @param {Function} [config.renderContent] - Content renderer
   */
  constructor(config) {
    // Instance properties (for object-based types)
    this.id = config.id;
    this.name = config.name;
    this.category = config.category || 'organization';
    this.icon = config.icon || '📄';
    this.defaultPorts = config.defaultPorts || [];
    this.defaultStyle = {
      width: 180,
      height: 100,
      color: '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1,
      borderRadius: 4,
      ...config.defaultStyle
    };
    this.features = {
      canHaveChildren: false,
      canHaveAttributes: true,
      canResize: false,
      canContainNodes: false,
      canCollapse: true,
      canEdit: true,
      ...config.features
    };

    // Custom functions
    this._getPorts = config.getPorts || null;
    this._renderContent = config.renderContent || null;
    this._canConnect = config.canConnect || null;
    this._onDoubleClick = config.onDoubleClick || null;
    this._serialize = config.serialize || null;
    this._deserialize = config.deserialize || null;
  }

  // =========================================================================
  // Port Configuration
  // =========================================================================

  /**
   * Get ports for a node instance.
   * Override in subclasses for dynamic port generation.
   *
   * @param {NodeInstance} node - Node instance
   * @returns {PortDefinition[]} Port definitions
   */
  static getPorts(node) {
    return this.defaultPorts;
  }

  /**
   * Get default ports (alias for compatibility).
   *
   * @returns {PortDefinition[]} Default ports
   */
  static getDefaultPorts() {
    return this.defaultPorts;
  }

  /**
   * Get ports (instance method for object-based types).
   *
   * @param {NodeInstance} node - Node instance
   * @returns {PortDefinition[]} Port definitions
   */
  getPorts(node) {
    if (this._getPorts) {
      return this._getPorts(node);
    }
    return this.createDefaultPorts();
  }

  /**
   * Create default ports from the type definition.
   *
   * @returns {PortDefinition[]} Array of port objects
   */
  createDefaultPorts() {
    return this.defaultPorts.map((portDef, index) => ({
      id: portDef.id || `port-${index}`,
      side: portDef.side || 'right',
      type: portDef.type || 'output',
      label: portDef.label || '',
      position: portDef.position || 0.5,
      dataType: portDef.dataType || 'unknown',
      maxConnections: portDef.maxConnections ?? -1,
      required: portDef.required || false
    }));
  }

  // =========================================================================
  // Node Instance Creation
  // =========================================================================

  /**
   * Create a new node instance of this type.
   *
   * @param {Object} config - Node configuration
   * @returns {NodeInstance} New node instance
   */
  static createInstance(config = {}) {
    return {
      id: config.id || this.generateId(),
      type: this.id,
      name: config.name || config.title || this.displayName,
      x: config.x ?? config.position?.x ?? 0,
      y: config.y ?? config.position?.y ?? 0,
      width: config.width ?? this.defaultStyle.width,
      height: config.height ?? this.defaultStyle.height,
      collapsed: config.collapsed ?? false,
      expanded: config.expanded ?? true,
      children: this.features.canHaveChildren ? (config.children || []) : undefined,
      parentId: config.parentId || null,
      style: { ...this.defaultStyle, ...config.style },
      attributes: config.attributes || [],
      inputPorts: config.inputPorts || null,
      outputPorts: config.outputPorts || null,
      ...config
    };
  }

  /**
   * Create a new node instance (instance method).
   *
   * @param {Object} config - Node configuration
   * @returns {NodeInstance} New node instance
   */
  createInstance(config = {}) {
    const node = {
      id: config.id || this.generateId(),
      type: this.id,
      name: config.name || config.title || this.name,
      x: config.x ?? config.position?.x ?? 0,
      y: config.y ?? config.position?.y ?? 0,
      width: config.width ?? this.defaultStyle.width,
      height: config.height ?? this.defaultStyle.height,
      collapsed: config.collapsed ?? false,
      expanded: config.expanded ?? true,
      parentId: config.parentId || null,
      style: { ...this.defaultStyle, ...config.style },
      attributes: config.attributes || [],
      inputPorts: config.inputPorts || null,
      outputPorts: config.outputPorts || null,
      containedIn: config.containedIn || null,
      ...config
    };

    // Add feature-specific properties
    if (this.features.canHaveChildren) {
      node.children = config.children || [];
    }

    if (this.features.canContainNodes) {
      node.containedNodes = config.containedNodes || [];
    }

    return node;
  }

  /**
   * Generate a unique ID for a node.
   *
   * @returns {string} Unique identifier
   */
  static generateId() {
    const typeId = this.id || 'node';
    return `${typeId}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique ID (instance method).
   *
   * @returns {string} Unique identifier
   */
  generateId() {
    return `${this.id}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Get default style.
   *
   * @returns {NodeStyle} Default style
   */
  static getDefaultStyle() {
    return { ...this.defaultStyle };
  }

  /**
   * Render node content.
   * Override in subclasses for custom rendering.
   *
   * @param {NodeInstance} node - Node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
    // Default implementation - can be overridden
    const content = document.createElement('div');
    content.className = 'node-content';

    // Title/name
    if (node.name || node.title) {
      const title = document.createElement('div');
      title.className = 'node-title';
      title.textContent = node.name || node.title;
      content.appendChild(title);
    }

    // Description (if present)
    if (node.description) {
      const desc = document.createElement('div');
      desc.className = 'node-description';
      desc.textContent = node.description;
      content.appendChild(desc);
    }

    container.appendChild(content);
  }

  /**
   * Render node content (instance method).
   *
   * @param {NodeInstance} node - Node instance
   * @param {HTMLElement} container - Container element
   */
  renderContent(node, container) {
    if (this._renderContent) {
      return this._renderContent(node, container);
    }
    return this.renderDefaultContent(node, container);
  }

  /**
   * Default content renderer.
   *
   * @param {NodeInstance} node - Node instance
   * @param {HTMLElement} container - Container element
   */
  renderDefaultContent(node, container) {
    const content = document.createElement('div');
    content.className = 'node-content';

    // Title
    const title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = node.name || node.title || this.name;
    content.appendChild(title);

    // Description (if present)
    if (node.description) {
      const desc = document.createElement('div');
      desc.className = 'node-description';
      desc.textContent = node.description;
      content.appendChild(desc);
    }

    container.appendChild(content);
  }

  /**
   * Get the render function for this node type.
   *
   * @returns {Function|null} Custom renderer or null
   */
  getRenderer() {
    return this._renderContent;
  }

  // =========================================================================
  // Behavior
  // =========================================================================

  /**
   * Check if this node type can have children.
   *
   * @returns {boolean}
   */
  static canHaveChildren() {
    return this.features.canHaveChildren;
  }

  /**
   * Check if a connection is allowed between ports.
   * Override for custom validation.
   *
   * @param {PortDefinition} fromPort - Source port
   * @param {PortDefinition} toPort - Target port
   * @param {NodeInstance} fromNode - Source node
   * @param {NodeInstance} toNode - Target node
   * @returns {boolean} Whether connection is allowed
   */
  static canConnect(fromPort, toPort, fromNode, toNode) {
    // Default: allow all connections between output and input
    return fromPort.type === 'output' && toPort.type === 'input';
  }

  /**
   * Check if a connection is allowed (instance method).
   *
   * @param {PortDefinition} fromPort - Source port
   * @param {PortDefinition} toPort - Target port
   * @param {NodeInstance} fromNode - Source node
   * @param {NodeInstance} toNode - Target node
   * @returns {boolean} Whether connection is allowed
   */
  canConnect(fromPort, toPort, fromNode, toNode) {
    if (this._canConnect) {
      return this._canConnect(fromPort, toPort, fromNode, toNode);
    }
    return fromPort.type === 'output' && toPort.type === 'input';
  }

  /**
   * Handle double-click on node.
   * Override for custom behavior.
   *
   * @param {NodeInstance} node - Node instance
   * @param {Event} event - Click event
   */
  static onDoubleClick(node, event) {
    // Default: do nothing (can be overridden)
  }

  /**
   * Handle double-click (instance method).
   *
   * @param {NodeInstance} node - Node instance
   * @param {Event} event - Click event
   */
  onDoubleClick(node, event) {
    if (this._onDoubleClick) {
      return this._onDoubleClick(node, event);
    }
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Serialize a node instance for storage.
   * Override to customize serialization.
   *
   * @param {NodeInstance} node - Node instance
   * @returns {Object} Serializable object
   */
  static serialize(node) {
    // Exclude non-serializable properties
    const {
      parent,        // Circular reference
      fileObject,    // File object can't be serialized
      _cached,       // Internal cache
      ...serializable
    } = node;

    // Recursively serialize children
    if (serializable.children && Array.isArray(serializable.children)) {
      serializable.children = serializable.children.map(child =>
        BaseNodeType.serialize(child)
      );
    }

    return serializable;
  }

  /**
   * Serialize a node (instance method).
   *
   * @param {NodeInstance} node - Node instance
   * @returns {Object} Serializable object
   */
  serialize(node) {
    if (this._serialize) {
      return this._serialize(node);
    }
    return BaseNodeType.serialize(node);
  }

  /**
   * Deserialize a node from storage.
   * Override to customize deserialization.
   *
   * @param {Object} data - Serialized data
   * @returns {NodeInstance} Node instance
   */
  static deserialize(data) {
    const node = { ...data };

    // Recursively deserialize children
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(child =>
        BaseNodeType.deserialize(child)
      );
    }

    return node;
  }

  /**
   * Deserialize a node (instance method).
   *
   * @param {Object} data - Serialized data
   * @returns {NodeInstance} Node instance
   */
  deserialize(data) {
    if (this._deserialize) {
      return this._deserialize(data);
    }
    return BaseNodeType.deserialize(data);
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Validate a node instance.
   *
   * @param {NodeInstance} node - Node to validate
   * @returns {boolean} Whether node is valid
   */
  static validate(node) {
    if (!node) return false;
    if (!node.id) {
      console.error('Node must have an id');
      return false;
    }
    if (!node.type) {
      console.error('Node must have a type');
      return false;
    }
    return true;
  }

  /**
   * Validate a node (instance method).
   *
   * @param {NodeInstance} node - Node to validate
   * @returns {boolean} Whether node is valid
   */
  validate(node) {
    if (!node.id || !node.type) {
      console.error('Node must have id and type');
      return false;
    }

    if (node.type !== this.id) {
      console.error(`Node type mismatch: expected ${this.id}, got ${node.type}`);
      return false;
    }

    return true;
  }

  // =========================================================================
  // Feature Queries
  // =========================================================================

  /**
   * Check if a feature is enabled.
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  static hasFeature(feature) {
    return this.features[feature] === true;
  }

  /**
   * Check if a feature is enabled (instance method).
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  hasFeature(feature) {
    return this.features[feature] === true;
  }

  /**
   * Get all features.
   *
   * @returns {NodeFeatures} Features
   */
  static getFeatures() {
    return { ...this.features };
  }

  // =========================================================================
  // Type Definition Export
  // =========================================================================

  /**
   * Export type definition (for serialization).
   *
   * @returns {Object} Type definition object
   */
  static toJSON() {
    return {
      id: this.id,
      name: this.displayName,
      category: this.category,
      icon: this.icon,
      defaultPorts: this.defaultPorts,
      defaultStyle: this.defaultStyle,
      features: this.features
    };
  }

  /**
   * Export type definition (instance method).
   *
   * @returns {Object} Type definition object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      icon: this.icon,
      defaultPorts: this.defaultPorts,
      defaultStyle: this.defaultStyle,
      features: this.features
    };
  }

  // =========================================================================
  // Node Normalization
  // =========================================================================

  /**
   * Normalize a node to the standard data structure.
   *
   * Handles common variations in property names:
   * - `title` → `name` (display name)
   * - `position.x/y` → `x/y` (coordinates)
   * - `label` → `name` (fallback for display)
   * - Ensures all required properties exist with defaults
   *
   * Standard Node Properties:
   * - id: string (required)
   * - type: string (required)
   * - name: string (display name, formerly title/label)
   * - x, y: number (position)
   * - width, height: number (dimensions)
   * - collapsed: boolean
   * - expanded: boolean
   * - children: array (if canHaveChildren)
   * - parentId: string|null
   * - style: object
   * - attributes: array
   * - inputPorts, outputPorts: array|null (manual port overrides)
   * - containedIn: string|null (for nodes in groups)
   *
   * Type-specific properties are preserved as-is.
   *
   * @param {Object} node - Node to normalize
   * @param {Object} [typeDefaults] - Optional type-specific defaults
   * @returns {Object} Normalized node
   */
  static normalizeNode(node, typeDefaults = {}) {
    if (!node) return null;

    // Extract position from various formats
    const x = node.x ?? node.position?.x ?? typeDefaults.x ?? 0;
    const y = node.y ?? node.position?.y ?? typeDefaults.y ?? 0;

    // Extract display name from various sources
    const name = node.name ?? node.title ?? node.label ?? typeDefaults.name ?? 'Unnamed';

    // Get dimensions with fallbacks
    const defaultStyle = typeDefaults.defaultStyle || this.defaultStyle;
    const width = node.width ?? node.style?.width ?? defaultStyle.width ?? 180;
    const height = node.height ?? node.style?.height ?? defaultStyle.height ?? 100;

    // Build normalized node
    const normalized = {
      // Required properties
      id: node.id,
      type: node.type,
      name: name,

      // Position
      x: x,
      y: y,

      // Dimensions
      width: width,
      height: height,

      // State
      collapsed: node.collapsed ?? false,
      expanded: node.expanded ?? true,

      // Hierarchy
      parentId: node.parentId ?? node.parent?.id ?? null,

      // Style (merge with defaults)
      style: {
        ...defaultStyle,
        ...node.style,
        width: width,
        height: height
      },

      // Attributes (normalize to array format)
      attributes: this._normalizeAttributes(node.attributes),

      // Port overrides (null means use type defaults)
      inputPorts: node.inputPorts ?? null,
      outputPorts: node.outputPorts ?? null,

      // Group containment
      containedIn: node.containedIn ?? null
    };

    // Normalize children recursively if present
    if (node.children && Array.isArray(node.children)) {
      normalized.children = node.children.map(child =>
        this.normalizeNode(child, typeDefaults)
      );
    }

    // Normalize containedNodes if present
    if (node.containedNodes && Array.isArray(node.containedNodes)) {
      normalized.containedNodes = node.containedNodes.map(id =>
        typeof id === 'string' ? id : id?.id
      ).filter(Boolean);
    }

    // Preserve type-specific properties
    const preservedKeys = [
      // Code node properties
      'path', 'filePath', 'relativePath', 'content', 'language',
      'parameters', 'returnType', 'isAsync', 'isStatic', 'isConstructor',
      'visibility', 'className', 'isGetter', 'isSetter',
      'methods', 'properties', 'hasConstructor', 'extendsClass', 'implementsInterfaces',
      'exports', 'imports', 'variables', 'fileObject', 'symbolType',

      // Organization node properties
      'description', 'textColor', 'fontSize', 'shape',

      // Data node properties
      'dataType', 'value',

      // Flow-related properties
      'depth', 'traceDirection', 'flowDirection',

      // Metadata
      'createdAt', 'updatedAt', 'metadata'
    ];

    preservedKeys.forEach(key => {
      if (node[key] !== undefined) {
        normalized[key] = node[key];
      }
    });

    return normalized;
  }

  /**
   * Normalize attributes to consistent array format.
   *
   * Input formats supported:
   * - Array of strings: ['attr1', 'attr2']
   * - Array of objects: [{name: 'attr1', value: 'v1'}]
   * - Object map: {attr1: 'v1', attr2: 'v2'}
   * - null/undefined: returns empty array
   *
   * Output format:
   * - Array of {name, value} objects
   *
   * @param {*} attrs - Attributes in any format
   * @returns {Array} Normalized attributes array
   * @private
   */
  static _normalizeAttributes(attrs) {
    if (!attrs) return [];

    // Already an array
    if (Array.isArray(attrs)) {
      return attrs.map(attr => {
        if (typeof attr === 'string') {
          // String parameter name, no default value
          if (attr.includes('=')) {
            const [name, value] = attr.split('=').map(s => s.trim());
            return { name, value };
          }
          return { name: attr, value: null };
        }
        if (typeof attr === 'object') {
          return {
            name: attr.name ?? attr.title ?? attr.key ?? 'unnamed',
            value: attr.value ?? attr.defaultValue ?? null,
            type: attr.type ?? attr.dataType ?? null
          };
        }
        return { name: String(attr), value: null };
      });
    }

    // Object map
    if (typeof attrs === 'object') {
      return Object.entries(attrs).map(([name, value]) => ({
        name,
        value: typeof value === 'object' ? value?.value ?? value : value
      }));
    }

    return [];
  }

  /**
   * Batch normalize multiple nodes.
   *
   * @param {Array} nodes - Array of nodes to normalize
   * @param {Object} [typeDefaults] - Optional type-specific defaults
   * @returns {Array} Array of normalized nodes
   */
  static normalizeNodes(nodes, typeDefaults = {}) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(node => this.normalizeNode(node, typeDefaults));
  }

  /**
   * Validate and normalize a node, returning errors if invalid.
   *
   * @param {Object} node - Node to validate and normalize
   * @returns {{node: Object|null, errors: string[]}} Result with normalized node and any errors
   */
  static validateAndNormalize(node) {
    const errors = [];

    if (!node) {
      return { node: null, errors: ['Node is null or undefined'] };
    }

    if (!node.id) {
      errors.push('Node is missing required property: id');
    }

    if (!node.type) {
      errors.push('Node is missing required property: type');
    }

    const normalized = errors.length === 0 ? this.normalizeNode(node) : null;

    return { node: normalized, errors };
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Clone a node instance.
   *
   * @param {NodeInstance} node - Node to clone
   * @param {Object} [overrides] - Property overrides
   * @returns {NodeInstance} Cloned node with new ID
   */
  static clone(node, overrides = {}) {
    const cloned = JSON.parse(JSON.stringify(node));
    cloned.id = this.generateId();

    // Apply overrides
    Object.assign(cloned, overrides);

    // Recursively generate new IDs for children
    if (cloned.children && Array.isArray(cloned.children)) {
      cloned.children = cloned.children.map(child =>
        this.clone(child, { parentId: cloned.id })
      );
    }

    return cloned;
  }

  /**
   * Get display info for the type.
   *
   * @returns {Object} Display info
   */
  static getInfo() {
    return {
      id: this.id,
      name: this.displayName,
      category: this.category,
      icon: this.icon,
      features: this.features
    };
  }

  /**
   * Get display info (instance method).
   *
   * @returns {Object} Display info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      icon: this.icon,
      features: this.features
    };
  }
}
