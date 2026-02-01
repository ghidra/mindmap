/**
 * Port System - Manages port creation, positioning, and validation
 * Handles orientation calculation for bezier curve connections
 */

// Data type colors for typed ports
const DATA_TYPE_COLORS = {
  number: '#f39c12',    // Orange
  string: '#27ae60',    // Green
  boolean: '#9b59b6',   // Purple
  array: '#3498db',     // Blue
  object: '#e74c3c',    // Red
  function: '#1abc9c',  // Teal
  unknown: '#000000'    // Black (polymorphic)
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
   * @returns {boolean} Whether connection is valid
   */
  canConnect(sourcePort, targetPort) {
    // Can't connect a port to itself
    if (sourcePort.nodeId === targetPort.nodeId && sourcePort.id === targetPort.id) {
      return false;
    }

    // Bidirectional ports can connect to anything
    if (sourcePort.type === 'bidirectional' || targetPort.type === 'bidirectional') {
      return true;
    }

    // Output can only connect to input
    if (sourcePort.type === 'output' && targetPort.type === 'input') {
      return true;
    }

    // Input can only connect to output
    if (sourcePort.type === 'input' && targetPort.type === 'output') {
      return true;
    }

    return false;
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
