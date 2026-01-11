/**
 * Connection System - Handles bezier curve connections between ports
 * Automatically calculates control points based on port orientations
 */

import { state } from '../state.js';
import { portSystem } from './PortSystem.js';
import { findNode } from '../state.js';

export class ConnectionSystem {
  constructor() {
    this.svgElement = null;
    this.connections = [];
    this.temporaryConnection = null; // For drag preview
  }

  /**
   * Initialize the connection system
   * @param {SVGElement} svgElement - SVG element for rendering connections
   */
  init(svgElement) {
    this.svgElement = svgElement;
    this.setupMarkers();
    console.log('ConnectionSystem initialized');
  }

  /**
   * Setup SVG markers for arrowheads and other decorations
   */
  setupMarkers() {
    if (!this.svgElement) return;

    // Clear existing defs
    let defs = this.svgElement.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgElement.appendChild(defs);
    }
    defs.innerHTML = '';

    // Standard arrowhead marker
    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    arrowhead.setAttribute('id', 'arrowhead');
    arrowhead.setAttribute('markerWidth', '10');
    arrowhead.setAttribute('markerHeight', '10');
    arrowhead.setAttribute('refX', '9');
    arrowhead.setAttribute('refY', '3');
    arrowhead.setAttribute('orient', 'auto');
    arrowhead.setAttribute('markerUnits', 'strokeWidth');

    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    arrowPath.setAttribute('fill', '#666');
    arrowhead.appendChild(arrowPath);
    defs.appendChild(arrowhead);

    // Highlighted arrowhead (for selected connections)
    const arrowheadHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    arrowheadHighlight.setAttribute('id', 'arrowhead-highlight');
    arrowheadHighlight.setAttribute('markerWidth', '10');
    arrowheadHighlight.setAttribute('markerHeight', '10');
    arrowheadHighlight.setAttribute('refX', '9');
    arrowheadHighlight.setAttribute('refY', '3');
    arrowheadHighlight.setAttribute('orient', 'auto');
    arrowheadHighlight.setAttribute('markerUnits', 'strokeWidth');

    const arrowPathHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPathHighlight.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    arrowPathHighlight.setAttribute('fill', '#2196f3');
    arrowheadHighlight.appendChild(arrowPathHighlight);
    defs.appendChild(arrowheadHighlight);

    // Animated flow marker (small circle)
    const flowDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    flowDot.setAttribute('id', 'flow-dot');
    flowDot.setAttribute('r', '3');
    flowDot.setAttribute('fill', '#2196f3');
  }

  /**
   * Calculate bezier path between two ports
   * @param {Object} fromPort - Source port {x, y, orientation, side}
   * @param {Object} toPort - Target port {x, y, orientation, side}
   * @returns {string} SVG path d attribute
   */
  calculateBezierPath(fromPort, toPort) {
    const from = {
      x: fromPort.x + state.viewport.x,
      y: fromPort.y + state.viewport.y,
      orientation: fromPort.orientation,
      side: fromPort.side
    };

    const to = {
      x: toPort.x + state.viewport.x,
      y: toPort.y + state.viewport.y,
      orientation: toPort.orientation,
      side: toPort.side
    };

    // Calculate distance between ports
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Handle distance for control points (adaptive based on distance)
    const baseHandleDistance = Math.min(distance * 0.5, 150);
    const handleDistance = Math.max(baseHandleDistance, 50);

    // Calculate control points based on port orientations
    const cp1 = this.calculateControlPoint(from, handleDistance, 'out');
    const cp2 = this.calculateControlPoint(to, handleDistance, 'in');

    // Create cubic bezier curve path
    return `M ${from.x},${from.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${to.x},${to.y}`;
  }

  /**
   * Calculate a control point for bezier curve
   * @param {Object} port - Port position and orientation
   * @param {number} distance - Distance from port
   * @param {string} direction - 'in' or 'out'
   * @returns {Object} Control point {x, y}
   */
  calculateControlPoint(port, distance, direction) {
    const multiplier = direction === 'out' ? 1 : -1;

    let dx = 0;
    let dy = 0;

    if (port.orientation === 'horizontal') {
      // Horizontal ports (left/right)
      dx = port.side === 'right' ? distance * multiplier : -distance * multiplier;
      dy = 0;
    } else {
      // Vertical ports (top/bottom)
      dx = 0;
      dy = port.side === 'bottom' ? distance * multiplier : -distance * multiplier;
    }

    return {
      x: port.x + dx,
      y: port.y + dy
    };
  }

  /**
   * Render all connections
   */
  renderConnections() {
    if (!this.svgElement) return;

    // Clear existing connections (except defs)
    Array.from(this.svgElement.children).forEach(child => {
      if (child.tagName !== 'defs') {
        this.svgElement.removeChild(child);
      }
    });

    // Render state connections
    state.connections.forEach(connection => {
      this.renderConnection(connection);
    });

    // Render temporary connection (during drag)
    if (this.temporaryConnection) {
      this.renderTemporaryConnection(this.temporaryConnection);
    }
  }

  /**
   * Render a single connection
   * @param {Object} connection - Connection object
   */
  renderConnection(connection) {
    // Get nodes and ports
    const fromNode = findNode(connection.from.nodeId);
    const toNode = findNode(connection.to.nodeId);

    if (!fromNode || !toNode) {
      console.warn(`Cannot render connection ${connection.id}: node not found`);
      return;
    }

    const fromPort = portSystem.getPort(connection.from.nodeId, connection.from.portId);
    const toPort = portSystem.getPort(connection.to.nodeId, connection.to.portId);

    if (!fromPort || !toPort) {
      console.warn(`Cannot render connection ${connection.id}: port not found`);
      return;
    }

    // Calculate port positions
    const fromPos = portSystem.calculatePortPosition(fromNode, fromPort);
    const toPos = portSystem.calculatePortPosition(toNode, toPort);

    // Calculate bezier path
    const pathData = this.calculateBezierPath(fromPos, toPos);

    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', connection.style?.stroke || '#666');
    path.setAttribute('stroke-width', connection.style?.strokeWidth || 2);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('class', 'connection');
    path.dataset.connectionId = connection.id;

    // Apply stroke dash array if specified
    if (connection.style?.strokeDasharray) {
      path.setAttribute('stroke-dasharray', connection.style.strokeDasharray);
    }

    // Animated flow effect
    if (connection.style?.animated) {
      path.classList.add('animated-connection');
      this.addFlowAnimation(path);
    }

    this.svgElement.appendChild(path);
  }

  /**
   * Render temporary connection during dragging
   * @param {Object} tempConn - Temporary connection {fromPort, toX, toY}
   */
  renderTemporaryConnection(tempConn) {
    const { fromNode, fromPort, toX, toY } = tempConn;

    const fromPos = portSystem.calculatePortPosition(fromNode, fromPort);

    // Create a fake "toPort" at mouse position with neutral orientation
    const toPort = {
      x: toX - state.viewport.x,
      y: toY - state.viewport.y,
      orientation: 'horizontal', // Default orientation
      side: 'left'
    };

    const pathData = this.calculateBezierPath(fromPos, toPort);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#2196f3');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('class', 'temporary-connection');

    this.svgElement.appendChild(path);
  }

  /**
   * Add flow animation to a path
   * @param {SVGPathElement} path - Path element
   */
  addFlowAnimation(path) {
    // Create animateMotion for flowing dot
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#2196f3');

    const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    animateMotion.setAttribute('dur', '2s');
    animateMotion.setAttribute('repeatCount', 'indefinite');

    const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + path.id);

    animateMotion.appendChild(mpath);
    circle.appendChild(animateMotion);

    // Generate unique ID for the path if it doesn't have one
    if (!path.id) {
      path.id = `path-${Math.random().toString(36).substr(2, 9)}`;
    }

    this.svgElement.appendChild(circle);
  }

  /**
   * Set temporary connection for drag preview
   * @param {Object} fromNode - Source node
   * @param {Object} fromPort - Source port
   * @param {number} toX - Mouse X position
   * @param {number} toY - Mouse Y position
   */
  setTemporaryConnection(fromNode, fromPort, toX, toY) {
    this.temporaryConnection = { fromNode, fromPort, toX, toY };
  }

  /**
   * Clear temporary connection
   */
  clearTemporaryConnection() {
    this.temporaryConnection = null;
  }

  /**
   * Add a connection
   * @param {Object} connection - Connection object
   */
  addConnection(connection) {
    this.connections.push(connection);
    state.connections.push(connection);
  }

  /**
   * Remove a connection
   * @param {string} connectionId - Connection ID
   */
  removeConnection(connectionId) {
    const index = this.connections.findIndex(c => c.id === connectionId);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    const stateIndex = state.connections.findIndex(c => c.id === connectionId);
    if (stateIndex !== -1) {
      state.connections.splice(stateIndex, 1);
    }
  }

  /**
   * Find connection at a point (for selection)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} threshold - Distance threshold
   * @returns {Object|null} Connection or null
   */
  findConnectionAtPoint(x, y, threshold = 10) {
    // This would require calculating distance from point to bezier curve
    // For now, return null (implement if needed)
    return null;
  }

  /**
   * Get all connections for a node
   * @param {string} nodeId - Node ID
   * @returns {Array} Array of connections
   */
  getNodeConnections(nodeId) {
    return state.connections.filter(
      c => c.from.nodeId === nodeId || c.to.nodeId === nodeId
    );
  }

  /**
   * Get all connections from a specific port
   * @param {string} nodeId - Node ID
   * @param {string} portId - Port ID
   * @returns {Array} Array of connections
   */
  getPortConnections(nodeId, portId) {
    return state.connections.filter(
      c => (c.from.nodeId === nodeId && c.from.portId === portId) ||
           (c.to.nodeId === nodeId && c.to.portId === portId)
    );
  }
}

// Create singleton instance
export const connectionSystem = new ConnectionSystem();
