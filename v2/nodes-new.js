/**
 * Nodes Module - Refactored to use modular NodeRenderer
 * This is the new simplified node management system
 */

import { state, save, addNode as stateAddNode, removeNode as stateRemoveNode, findNode, getCurrentNodes } from './state.js';
import { nodeRenderer } from './core/NodeRenderer.js';
import { BaseNodeType } from './node-types/BaseNodeType.js';
import { nodeTypeRegistry } from './node-types/NodeTypeRegistry.js';

const canvas = document.getElementById('canvas');

/**
 * Create a new node instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} typeId - Node type ID
 * @param {Object} config - Additional configuration
 * @returns {Object} New node instance
 */
export function createNode(x, y, typeId = 'file', config = {}) {
  const typeDef = nodeTypeRegistry.get(typeId);

  if (!typeDef) {
    console.error(`Unknown node type: ${typeId}`);
    return null;
  }

  // Create node using type definition
  const baseType = new BaseNodeType(typeDef);
  const node = baseType.createInstance({
    position: { x, y },
    title: config.title || typeDef.name,
    ...config
  });

  return node;
}

/**
 * Delete a node
 * @param {string} nodeId - Node ID
 * @returns {boolean} Success
 */
export function deleteNode(nodeId) {
  const removed = stateRemoveNode(nodeId);
  if (removed) {
    nodeRenderer.removeRenderedNode(nodeId);
    save();
  }
  return removed;
}

/**
 * Render all nodes using the modular renderer
 * @param {Function} onRender - Render callback (optional)
 * @param {Function} onSelectNode - Select callback (optional)
 */
export function renderNodes(onRender, onSelectNode) {
  // Clear canvas
  canvas.innerHTML = '';

  // Get nodes to render (use legacy getCurrentNodes for now)
  const nodes = getNodesForRendering();

  // Render each node
  nodes.forEach(node => {
    try {
      nodeRenderer.render(node, canvas);
    } catch (error) {
      console.error(`Error rendering node ${node.id}:`, error);
    }
  });
}

/**
 * Get nodes for rendering (bridge to legacy system)
 * This function adapts the legacy state to the new rendering system
 */
function getNodesForRendering() {
  // For now, use the legacy getCurrentNodes function
  // This will be replaced in Phase 8 when we remove mode-specific logic
  const legacyNodes = getCurrentNodes();

  // Adapt legacy nodes to new format if needed
  return legacyNodes.map(adaptLegacyNode);
}

/**
 * Adapt a legacy node to the new node format
 * @param {Object} legacyNode - Old node format
 * @returns {Object} New node format
 */
function adaptLegacyNode(node) {
  // If node is already in new format, return as-is
  if (node.position && node.size && node.ports !== undefined) {
    return node;
  }

  // Adapt legacy node to new format
  const adapted = {
    ...node,
    position: node.position || {
      x: node.x || 0,
      y: node.y || 0
    },
    size: node.size || {
      width: node.width || 180,
      height: node.height || 100
    },
    ports: node.ports || [],
    style: node.style || {
      color: node.color || '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1
    },
    attributes: node.attributes || {}
  };

  // Add default output port if node doesn't have ports
  if (adapted.ports.length === 0 && node.type !== 'note') {
    adapted.ports.push({
      id: 'output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'out'
    });
  }

  // Add input ports for legacy attributes
  if (node.attributes && Array.isArray(node.attributes) && node.attributes.length > 0) {
    node.attributes.forEach((attr, index) => {
      const position = 0.2 + (index * 0.15); // Spread ports vertically
      adapted.ports.push({
        id: `input-${attr.id || index}`,
        side: 'left',
        type: 'input',
        position: Math.min(position, 0.8),
        label: attr.name
      });
    });
  }

  // Add 4-sided ports for note nodes
  if (node.type === 'note' || node.isNote) {
    adapted.ports = [
      { id: 'top', side: 'top', type: 'bidirectional', position: 0.5 },
      { id: 'right', side: 'right', type: 'bidirectional', position: 0.5 },
      { id: 'bottom', side: 'bottom', type: 'bidirectional', position: 0.5 },
      { id: 'left', side: 'left', type: 'bidirectional', position: 0.5 }
    ];
  }

  return adapted;
}

/**
 * Register a new node type
 * @param {Object} typeDef - Type definition
 */
export function registerNodeType(typeDef) {
  nodeTypeRegistry.register(typeDef);
}

/**
 * Get all available node types
 * @returns {Array} Array of type definitions
 */
export function getNodeTypes() {
  return nodeTypeRegistry.getAll();
}

/**
 * Get node types by category
 * @param {string} category - Category name
 * @returns {Array} Array of type definitions
 */
export function getNodeTypesByCategory(category) {
  return nodeTypeRegistry.getByCategory(category);
}
