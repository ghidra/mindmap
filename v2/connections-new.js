/**
 * Connections Module - Refactored to use bezier curve ConnectionSystem
 * Replaces straight lines with smooth curved connections
 */

import { getCurrentNodes, state, findNode } from './state.js';
import { connectionSystem } from './core/ConnectionSystem.js';
import { portSystem } from './core/PortSystem.js';

const svg = document.getElementById('connections');

/**
 * Initialize the connections system
 */
export function initConnections() {
  connectionSystem.init(svg);
  console.log('Connections system initialized with bezier curves');
}

/**
 * Render all connections using bezier curves
 */
export function renderConnections() {
  // Update SVG size to match canvas
  const canvas = document.getElementById('canvas');
  if (canvas) {
    svg.style.width = canvas.offsetWidth + 'px';
    svg.style.height = canvas.offsetHeight + 'px';
  }

  // Render using the connection system
  connectionSystem.renderConnections();
}

/**
 * Add a connection between two nodes/ports
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @param {string} fromPortId - Source port ID (optional)
 * @param {string} toPortId - Target port ID (optional)
 * @returns {boolean} Whether connection was added
 */
export function addConnection(fromId, toId, fromPortId = 'output', toPortId = 'input') {
  const fromNode = findNode(fromId);
  const toNode = findNode(toId);

  if (!fromNode || !toNode || fromId === toId) {
    return false;
  }

  // Get ports
  const fromPort = portSystem.getPort(fromId, fromPortId);
  const toPort = portSystem.getPort(toId, toPortId);

  if (!fromPort || !toPort) {
    console.warn('Cannot create connection: port not found');
    return false;
  }

  // Check if ports can connect
  if (!portSystem.canConnect(
    { ...fromPort, nodeId: fromId },
    { ...toPort, nodeId: toId }
  )) {
    console.warn('Cannot create connection: incompatible ports');
    return false;
  }

  // Check if connection already exists
  const exists = state.connections.some(
    c => c.from.nodeId === fromId &&
         c.from.portId === fromPortId &&
         c.to.nodeId === toId &&
         c.to.portId === toPortId
  );

  if (exists) {
    return false;
  }

  // Create connection
  const connection = {
    id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: { nodeId: fromId, portId: fromPortId },
    to: { nodeId: toId, portId: toPortId },
    style: {
      stroke: '#666',
      strokeWidth: 2,
      strokeDasharray: null,
      animated: false
    }
  };

  state.connections.push(connection);
  return true;
}

/**
 * Toggle a connection (add if doesn't exist, remove if exists)
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @param {string} fromPortId - Source port ID (optional)
 * @param {string} toPortId - Target port ID (optional)
 * @returns {boolean} Whether operation succeeded
 */
export function toggleConnection(fromId, toId, fromPortId = 'output', toPortId = 'input') {
  if (fromId === toId) {
    return false; // Can't connect to self
  }

  // Check if connection exists
  const connectionIndex = state.connections.findIndex(
    c => c.from.nodeId === fromId &&
         c.from.portId === fromPortId &&
         c.to.nodeId === toId &&
         c.to.portId === toPortId
  );

  if (connectionIndex !== -1) {
    // Connection exists - remove it
    state.connections.splice(connectionIndex, 1);
    console.log('Connection removed:', fromId, '->', toId);
    return true;
  } else {
    // Connection doesn't exist - add it
    return addConnection(fromId, toId, fromPortId, toPortId);
  }
}

/**
 * Remove a connection
 * @param {string} connectionId - Connection ID
 * @returns {boolean} Whether connection was removed
 */
export function removeConnection(connectionId) {
  const index = state.connections.findIndex(c => c.id === connectionId);
  if (index !== -1) {
    state.connections.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get all connections for a node
 * @param {string} nodeId - Node ID
 * @returns {Array} Array of connections
 */
export function getNodeConnections(nodeId) {
  return state.connections.filter(
    c => c.from.nodeId === nodeId || c.to.nodeId === nodeId
  );
}

/**
 * Remove all connections for a node
 * @param {string} nodeId - Node ID
 */
export function removeNodeConnections(nodeId) {
  state.connections = state.connections.filter(
    c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId
  );
}

/**
 * Set temporary connection for drag preview
 * @param {string} fromNodeId - Source node ID
 * @param {string} fromPortId - Source port ID
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 */
export function setTemporaryConnection(fromNodeId, fromPortId, mouseX, mouseY) {
  const fromNode = findNode(fromNodeId);
  const fromPort = portSystem.getPort(fromNodeId, fromPortId);

  if (fromNode && fromPort) {
    connectionSystem.setTemporaryConnection(fromNode, fromPort, mouseX, mouseY);
  }
}

/**
 * Clear temporary connection
 */
export function clearTemporaryConnection() {
  connectionSystem.clearTemporaryConnection();
}

/**
 * Convert legacy node connections to new format
 * This helps migrate from the old connections array in nodes to the new state.connections
 */
export function migrateLegacyConnections() {
  const nodes = getCurrentNodes();
  let migrated = 0;

  nodes.forEach(node => {
    if (node.connections && Array.isArray(node.connections)) {
      node.connections.forEach(toId => {
        const added = addConnection(node.id, toId);
        if (added) migrated++;
      });
    }
  });

  if (migrated > 0) {
    console.log(`Migrated ${migrated} legacy connections to new format`);
  }
}

// Initialize connections on module load
initConnections();
