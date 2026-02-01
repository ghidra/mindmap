/**
 * Base Node Type - Abstract base class for all node type definitions
 * Provides common functionality and default implementations
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
 */

export class BaseNodeType {
  constructor(config) {
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
      ...config.features
    };

    // Custom content renderer (optional)
    this.renderContent = config.renderContent || null;
  }

  /**
   * Validate a node instance of this type
   * @param {Object} node - Node instance to validate
   * @returns {boolean} Whether the node is valid
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

  /**
   * Create a new node instance of this type
   * @param {Object} config - Node configuration
   * @returns {Object} New node instance
   */
  createInstance(config) {
    const node = {
      id: config.id || this.generateId(),
      type: this.id,
      title: config.title || this.name,
      description: config.description || '',
      position: config.position || { x: 0, y: 0 },
      size: config.size || {
        width: this.defaultStyle.width,
        height: this.defaultStyle.height
      },
      ports: config.ports || this.createDefaultPorts(),
      style: { ...this.defaultStyle, ...config.style },
      attributes: config.attributes || {},
      containedIn: config.containedIn || null,
      // Support for manual port override
      inputPorts: config.inputPorts || null,
      outputPorts: config.outputPorts || null,
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
   * Create default ports from the type definition
   * @returns {Array} Array of port objects
   */
  createDefaultPorts() {
    return this.defaultPorts.map((portDef, index) => ({
      id: portDef.id || `port-${index}`,
      side: portDef.side || 'right',
      type: portDef.type || 'output',
      label: portDef.label || '',
      position: portDef.position || 0.5,
      style: {
        color: '#28a745',
        size: 10,
        shape: 'circle',
        ...portDef.style
      }
    }));
  }

  /**
   * Generate a unique ID for a node
   * @returns {string} Unique identifier
   */
  generateId() {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Default content renderer
   * Can be overridden by custom renderContent function
   * @param {Object} node - Node instance
   * @param {HTMLElement} container - Container element
   */
  renderDefaultContent(node, container) {
    const content = document.createElement('div');
    content.className = 'node-content';

    // Title
    const title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = node.title;
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
   * Get the render function for this node type
   * @returns {Function|null} Custom renderer or null to use default
   */
  getRenderer() {
    return this.renderContent;
  }

  /**
   * Check if a feature is enabled for this type
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  hasFeature(feature) {
    return this.features[feature] === true;
  }

  /**
   * Export type definition (for serialization)
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
}
