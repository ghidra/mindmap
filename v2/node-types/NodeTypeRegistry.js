/**
 * Node Type Registry - Plugin system for extensible node types
 * Allows registering, retrieving, and managing node type definitions
 */

export class NodeTypeRegistry {
  constructor() {
    this.types = new Map();
    this.categories = new Set();
  }

  /**
   * Register a new node type
   * @param {Object} typeDef - Node type definition
   */
  register(typeDef) {
    // Validate type definition
    if (!typeDef.id) {
      throw new Error('Node type must have an id');
    }
    if (!typeDef.name) {
      throw new Error('Node type must have a name');
    }

    // Set defaults
    const fullTypeDef = {
      category: 'organization',
      icon: '📄',
      defaultPorts: [],
      defaultStyle: {
        width: 180,
        height: 100,
        color: '#ffffff',
        borderColor: '#cccccc',
        borderWidth: 1
      },
      features: {
        canHaveChildren: false,
        canHaveAttributes: true,
        canResize: false,
        canContainNodes: false
      },
      ...typeDef
    };

    this.types.set(typeDef.id, fullTypeDef);
    this.categories.add(fullTypeDef.category);

    console.log(`✓ Registered node type: ${typeDef.id} (${typeDef.name})`);
  }

  /**
   * Get a node type definition by ID
   * @param {string} typeId - Type identifier
   * @returns {Object|null} Type definition or null
   */
  get(typeId) {
    return this.types.get(typeId) || null;
  }

  /**
   * Get all node types in a category
   * @param {string} category - Category name
   * @returns {Array} Array of type definitions
   */
  getByCategory(category) {
    return Array.from(this.types.values()).filter(t => t.category === category);
  }

  /**
   * Get all registered categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Get all registered node types
   * @returns {Array} Array of type definitions
   */
  getAll() {
    return Array.from(this.types.values());
  }

  /**
   * Check if a type exists
   * @param {string} typeId - Type identifier
   * @returns {boolean}
   */
  has(typeId) {
    return this.types.has(typeId);
  }

  /**
   * Unregister a node type (for plugins)
   * @param {string} typeId - Type identifier
   */
  unregister(typeId) {
    const typeDef = this.types.get(typeId);
    if (typeDef) {
      this.types.delete(typeId);
      console.log(`✓ Unregistered node type: ${typeId}`);
    }
  }
}

// Create singleton instance
export const nodeTypeRegistry = new NodeTypeRegistry();
