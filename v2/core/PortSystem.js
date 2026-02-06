/**
 * Port System - Manages port creation, positioning, and validation
 * Handles orientation calculation for bezier curve connections
 */

// Data type colors for typed ports
const DATA_TYPE_COLORS = {
  any: '#888888',       // Gray (accepts any type)
  number: '#f39c12',    // Orange
  string: '#27ae60',    // Green
  boolean: '#9b59b6',   // Purple
  array: '#3498db',     // Blue
  object: '#e74c3c',    // Red
  function: '#1abc9c',  // Teal
  null: '#95a5a6',      // Light gray
  undefined: '#95a5a6', // Light gray
  unknown: '#000000'    // Black (polymorphic)
};

/**
 * Data type compatibility matrix.
 * Used for validating connections between typed ports.
 */
const DATA_TYPE_COMPATIBILITY = {
  any: ['any', 'number', 'string', 'boolean', 'array', 'object', 'function', 'null', 'undefined', 'unknown'],
  number: ['any', 'number', 'unknown'],
  string: ['any', 'string', 'unknown'],
  boolean: ['any', 'boolean', 'unknown'],
  array: ['any', 'array', 'unknown'],
  object: ['any', 'object', 'unknown'],
  function: ['any', 'function', 'unknown'],
  null: ['any', 'null', 'object', 'unknown'],
  undefined: ['any', 'undefined', 'unknown'],
  unknown: ['any', 'number', 'string', 'boolean', 'array', 'object', 'function', 'null', 'undefined', 'unknown']
};

/**
 * Types that can be coerced to other types.
 * Key is source type, value is array of target types it can coerce to.
 */
const DATA_TYPE_COERCION = {
  number: ['string', 'boolean'],
  string: ['number', 'boolean'],
  boolean: ['number', 'string'],
  array: ['string'],
  object: ['string', 'boolean']
};

/**
 * Infer data type from a value string
 * @param {*} value - Value to analyze
 * @returns {string} Inferred type name
 */
export function inferDataType(value) {
  if (value === null || value === undefined) return 'unknown';

  const str = String(value).trim();
  if (str === '') return 'unknown';

  // Number (but not quoted strings that look like numbers)
  if (!isNaN(Number(str)) && !str.startsWith("'") && !str.startsWith('"')) {
    return 'number';
  }

  // Boolean
  if (str === 'true' || str === 'false') return 'boolean';

  // Array
  if (str.startsWith('[')) return 'array';

  // Object (literal or instantiation)
  if (str.startsWith('{') || str.startsWith('new ')) return 'object';

  // String (quoted)
  if (str.startsWith("'") || str.startsWith('"') || str.startsWith('`')) return 'string';

  // Function
  if (str.includes('=>') || str.startsWith('function')) return 'function';

  // Unknown/polymorphic
  return 'unknown';
}

export class PortSystem {
  constructor() {
    this.ports = new Map(); // Map of nodeId -> array of ports
  }

  /**
   * Register ports for a node
   * @param {string} nodeId - Node identifier
   * @param {Array} ports - Array of port definitions
   */
  registerPorts(nodeId, ports) {
    this.ports.set(nodeId, ports);
  }

  /**
   * Get all ports for a node
   * @param {string} nodeId - Node identifier
   * @returns {Array} Array of ports
   */
  getPorts(nodeId) {
    return this.ports.get(nodeId) || [];
  }

  /**
   * Get a specific port
   * @param {string} nodeId - Node identifier
   * @param {string} portId - Port identifier
   * @returns {Object|null} Port object or null
   */
  getPort(nodeId, portId) {
    const ports = this.getPorts(nodeId);
    return ports.find(p => p.id === portId) || null;
  }

  /**
   * Create a new port
   * @param {Object} portDef - Port definition
   * @returns {Object} Port object
   */
  createPort(portDef) {
    return {
      id: portDef.id || this.generatePortId(),
      side: portDef.side || 'right',
      type: portDef.type || 'output',
      label: portDef.label || '',
      position: portDef.position || 0.5, // 0-1 along the side
      style: {
        color: this.getDefaultPortColor(portDef.type),
        size: 10,
        shape: 'circle',
        ...portDef.style
      }
    };
  }

  /**
   * Calculate the absolute position of a port on a node
   * @param {Object} node - Node object
   * @param {Object} port - Port object
   * @returns {Object} {x, y, orientation, side} position and metadata
   */
  calculatePortPosition(node, port) {
    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;
    const nodeWidth = node.size?.width ?? node.width ?? 180;
    const nodeHeight = node.size?.height ?? node.height ?? 100;

    let x, y, orientation;

    switch (port.side) {
      case 'left':
        x = nodeX;
        y = nodeY + nodeHeight * port.position;
        orientation = 'horizontal';
        break;

      case 'right':
        x = nodeX + nodeWidth;
        y = nodeY + nodeHeight * port.position;
        orientation = 'horizontal';
        break;

      case 'top':
        x = nodeX + nodeWidth * port.position;
        y = nodeY;
        orientation = 'vertical';
        break;

      case 'bottom':
        x = nodeX + nodeWidth * port.position;
        y = nodeY + nodeHeight;
        orientation = 'vertical';
        break;

      default:
        console.warn(`Unknown port side: ${port.side}, defaulting to right`);
        x = nodeX + nodeWidth;
        y = nodeY + nodeHeight * 0.5;
        orientation = 'horizontal';
    }

    return {
      x,
      y,
      orientation,
      side: port.side,
      type: port.type,
      portId: port.id
    };
  }

  /**
   * Calculate positions for all ports on a node
   * @param {Object} node - Node object
   * @returns {Array} Array of port positions
   */
  calculateAllPortPositions(node) {
    const ports = node.ports || [];
    return ports.map(port => ({
      port,
      position: this.calculatePortPosition(node, port)
    }));
  }

  /**
   * Validate if two ports can be connected
   * @param {Object} sourcePort - Source port object
   * @param {Object} targetPort - Target port object
   * @param {Object} [options] - Validation options
   * @param {boolean} [options.checkDataTypes=false] - Check data type compatibility
   * @param {boolean} [options.strictTypes=false] - Reject coercible types
   * @returns {boolean} Whether connection is valid
   */
  canConnect(sourcePort, targetPort, options = {}) {
    const { checkDataTypes = false, strictTypes = false } = options;

    // Can't connect a port to itself
    if (sourcePort.nodeId === targetPort.nodeId && sourcePort.id === targetPort.id) {
      return false;
    }

    // Bidirectional ports can connect to anything
    if (sourcePort.type === 'bidirectional' || targetPort.type === 'bidirectional') {
      // Still check data types if requested
      if (checkDataTypes) {
        return this.validateDataTypes(sourcePort, targetPort, strictTypes).valid;
      }
      return true;
    }

    // Output can only connect to input
    if (sourcePort.type === 'output' && targetPort.type === 'input') {
      if (checkDataTypes) {
        return this.validateDataTypes(sourcePort, targetPort, strictTypes).valid;
      }
      return true;
    }

    // Input can only connect to output
    if (sourcePort.type === 'input' && targetPort.type === 'output') {
      if (checkDataTypes) {
        return this.validateDataTypes(sourcePort, targetPort, strictTypes).valid;
      }
      return true;
    }

    return false;
  }

  /**
   * Validate data type compatibility between ports.
   * @param {Object} sourcePort - Source port object
   * @param {Object} targetPort - Target port object
   * @param {boolean} [strictTypes=false] - Reject coercible types
   * @returns {{valid: boolean, level: string, reason?: string}} Validation result
   */
  validateDataTypes(sourcePort, targetPort, strictTypes = false) {
    const fromType = sourcePort.dataType || 'unknown';
    const toType = targetPort.dataType || 'unknown';

    const compatibility = this.getTypeCompatibility(fromType, toType);

    switch (compatibility) {
      case 'exact':
      case 'compatible':
        return { valid: true, level: compatibility };

      case 'coerce':
        if (strictTypes) {
          return {
            valid: false,
            level: 'coerce',
            reason: `Type '${fromType}' requires coercion to '${toType}' (strict mode)`
          };
        }
        return { valid: true, level: 'coerce' };

      case 'incompatible':
      default:
        return {
          valid: false,
          level: 'incompatible',
          reason: `Type '${fromType}' is incompatible with '${toType}'`
        };
    }
  }

  /**
   * Get detailed connection validation result.
   * @param {Object} sourcePort - Source port object
   * @param {Object} targetPort - Target port object
   * @param {Object} [options] - Validation options
   * @returns {{valid: boolean, portTypeOk: boolean, dataTypeOk: boolean, reasons: string[]}}
   */
  validateConnection(sourcePort, targetPort, options = {}) {
    const reasons = [];

    // Check port types (input/output)
    let portTypeOk = false;
    if (sourcePort.type === 'bidirectional' || targetPort.type === 'bidirectional') {
      portTypeOk = true;
    } else if (sourcePort.type === 'output' && targetPort.type === 'input') {
      portTypeOk = true;
    } else if (sourcePort.type === 'input' && targetPort.type === 'output') {
      portTypeOk = true;
    } else {
      reasons.push(`Cannot connect ${sourcePort.type} to ${targetPort.type}`);
    }

    // Check data types
    const dataTypeResult = this.validateDataTypes(sourcePort, targetPort, options.strictTypes);
    const dataTypeOk = dataTypeResult.valid;

    if (!dataTypeOk && dataTypeResult.reason) {
      reasons.push(dataTypeResult.reason);
    }

    return {
      valid: portTypeOk && dataTypeOk,
      portTypeOk,
      dataTypeOk,
      dataTypeLevel: dataTypeResult.level,
      reasons
    };
  }

  /**
   * Get default color for port type
   * @param {string} type - Port type
   * @returns {string} Hex color
   */
  getDefaultPortColor(type) {
    switch (type) {
      case 'input':
        return '#28a745'; // Green
      case 'output':
        return '#007bff'; // Blue
      case 'bidirectional':
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Get color for a data type
   * @param {string} dataType - Data type name
   * @returns {string} Hex color
   */
  getDataTypeColor(dataType) {
    return DATA_TYPE_COLORS[dataType] || DATA_TYPE_COLORS.unknown;
  }

  /**
   * Check if two data types are compatible for connection.
   * @param {string} fromType - Source data type
   * @param {string} toType - Target data type
   * @returns {boolean} Whether types are compatible
   */
  areTypesCompatible(fromType, toType) {
    fromType = fromType || 'unknown';
    toType = toType || 'unknown';

    // Check direct compatibility
    const compatible = DATA_TYPE_COMPATIBILITY[fromType];
    if (compatible && compatible.includes(toType)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a type can be coerced to another type.
   * @param {string} fromType - Source data type
   * @param {string} toType - Target data type
   * @returns {boolean} Whether coercion is possible
   */
  canCoerce(fromType, toType) {
    fromType = fromType || 'unknown';
    toType = toType || 'unknown';

    // Check coercion
    const coercible = DATA_TYPE_COERCION[fromType];
    if (coercible && coercible.includes(toType)) {
      return true;
    }

    return false;
  }

  /**
   * Get compatibility level between two types.
   * @param {string} fromType - Source data type
   * @param {string} toType - Target data type
   * @returns {'exact'|'compatible'|'coerce'|'incompatible'} Compatibility level
   */
  getTypeCompatibility(fromType, toType) {
    fromType = fromType || 'unknown';
    toType = toType || 'unknown';

    // Exact match
    if (fromType === toType) {
      return 'exact';
    }

    // Direct compatibility
    if (this.areTypesCompatible(fromType, toType)) {
      return 'compatible';
    }

    // Coercion possible
    if (this.canCoerce(fromType, toType)) {
      return 'coerce';
    }

    return 'incompatible';
  }

  /**
   * Get all compatible types for a given type.
   * @param {string} dataType - Data type name
   * @returns {string[]} Compatible types
   */
  getCompatibleTypes(dataType) {
    dataType = dataType || 'unknown';
    const compatible = DATA_TYPE_COMPATIBILITY[dataType] || [];
    const coercible = DATA_TYPE_COERCION[dataType] || [];
    return [...new Set([...compatible, ...coercible])];
  }

  /**
   * Generate unique port ID
   * @returns {string} Unique identifier
   */
  generatePortId() {
    return `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a port to a node
   * @param {string} nodeId - Node identifier
   * @param {Object} portDef - Port definition
   * @returns {Object} Created port
   */
  addPort(nodeId, portDef) {
    const port = this.createPort(portDef);
    const ports = this.getPorts(nodeId);
    ports.push(port);
    this.ports.set(nodeId, ports);
    return port;
  }

  /**
   * Remove a port from a node
   * @param {string} nodeId - Node identifier
   * @param {string} portId - Port identifier
   * @returns {boolean} Whether port was removed
   */
  removePort(nodeId, portId) {
    const ports = this.getPorts(nodeId);
    const index = ports.findIndex(p => p.id === portId);

    if (index !== -1) {
      ports.splice(index, 1);
      this.ports.set(nodeId, ports);
      return true;
    }

    return false;
  }

  /**
   * Clear all ports for a node
   * @param {string} nodeId - Node identifier
   */
  clearPorts(nodeId) {
    this.ports.delete(nodeId);
  }

  /**
   * Get ports by type
   * @param {string} nodeId - Node identifier
   * @param {string} type - Port type (input, output, bidirectional)
   * @returns {Array} Filtered ports
   */
  getPortsByType(nodeId, type) {
    const ports = this.getPorts(nodeId);
    return ports.filter(p => p.type === type);
  }

  /**
   * Get ports by side
   * @param {string} nodeId - Node identifier
   * @param {string} side - Port side (left, right, top, bottom)
   * @returns {Array} Filtered ports
   */
  getPortsBySide(nodeId, side) {
    const ports = this.getPorts(nodeId);
    return ports.filter(p => p.side === side);
  }

  /**
   * Find the closest port to a given point
   * @param {string} nodeId - Node identifier
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} node - Node object (for position calculation)
   * @returns {Object|null} Closest port and its position
   */
  findClosestPort(nodeId, x, y, node) {
    const portPositions = this.calculateAllPortPositions(node);

    if (portPositions.length === 0) return null;

    let closest = null;
    let minDistance = Infinity;

    portPositions.forEach(({ port, position }) => {
      const dx = position.x - x;
      const dy = position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        closest = { port, position, distance };
      }
    });

    return closest;
  }

  /**
   * Update port position along its side
   * @param {string} nodeId - Node identifier
   * @param {string} portId - Port identifier
   * @param {number} position - New position (0-1)
   * @returns {boolean} Whether update succeeded
   */
  updatePortPosition(nodeId, portId, position) {
    const ports = this.getPorts(nodeId);
    const port = ports.find(p => p.id === portId);

    if (port) {
      port.position = Math.max(0, Math.min(1, position));
      this.ports.set(nodeId, ports);
      return true;
    }

    return false;
  }
}

// Create singleton instance
export const portSystem = new PortSystem();
