import { state, getCurrentNodes } from './state.js';
import { createNode } from './nodes.js';

// Terminal node management
export const TERMINAL_NODE_ID = 'terminal';

export function getTerminalNode() {
  // Terminal node is only for hierarchical mode - skip in notes mode
  if (state.currentMode === 'notes') {
    return null;
  }

  const nodes = getCurrentNodes();
  let terminalNode = nodes.find(n => n.id === TERMINAL_NODE_ID);

  if (!terminalNode) {
    // Create terminal node if it doesn't exist using new format
    terminalNode = {
      id: TERMINAL_NODE_ID,
      type: 'terminal', // Use the terminal node type
      title: 'Terminal',
      isTerminal: true,
      x: 50,
      y: 50,
      position: { x: 50, y: 50 },
      size: { width: 200, height: 120 },
      style: {
        color: '#1a3a52',
        borderColor: '#4a90e2',
        borderWidth: 2
      },
      ports: [],
      attributes: [],
      children: [], // Terminal nodes never have children
      connections: [],
      expanded: false,
      attributesExpanded: false,
      visible: true
    };
    nodes.push(terminalNode);
  }

  return terminalNode;
}

export function isTerminalNode(node) {
  return node && node.isTerminal === true;
}

export function getTerminalNodeAttributes() {
  const terminalNode = getTerminalNode();
  if (!terminalNode) return [];
  return terminalNode.attributes || [];
}

export function addTerminalAttribute(name, type, value) {
  const terminalNode = getTerminalNode();
  if (!terminalNode) return null;
  if (!terminalNode.attributes) {
    terminalNode.attributes = [];
  }
  
  const attribute = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    name,
    type,
    value: type === 'string' ? value : 
           type === 'integer' ? parseInt(value) || 0 :
           type === 'float' ? parseFloat(value) || 0.0 : value
  };
  
  terminalNode.attributes.push(attribute);
  return attribute;
}

export function removeTerminalAttribute(attributeId) {
  const terminalNode = getTerminalNode();
  if (!terminalNode || !terminalNode.attributes) return false;
  
  const index = terminalNode.attributes.findIndex(attr => attr.id === attributeId);
  if (index !== -1) {
    terminalNode.attributes.splice(index, 1);
    return true;
  }
  return false;
}

export function updateTerminalAttributeValue(attributeId, value) {
  const terminalNode = getTerminalNode();
  if (!terminalNode || !terminalNode.attributes) return false;
  
  const attribute = terminalNode.attributes.find(attr => attr.id === attributeId);
  if (attribute) {
    attribute.value = validateAttributeValue(attribute.type, value);
    return true;
  }
  return false;
}

function validateAttributeValue(type, value) {
  switch (type) {
    case 'string':
      return String(value);
    case 'integer':
      const intVal = parseInt(value);
      return isNaN(intVal) ? 0 : intVal;
    case 'float':
      const floatVal = parseFloat(value);
      return isNaN(floatVal) ? 0.0 : floatVal;
    default:
      return value;
  }
}

// Position the terminal node in a consistent location
export function positionTerminalNode() {
  const terminalNode = getTerminalNode();
  if (!terminalNode) return; // Skip if no terminal node (e.g., notes mode)

  const nodes = getCurrentNodes();
  
  // Find the rightmost node to position terminal node to the right
  let maxX = 0;
  let hasOtherNodes = false;
  
  nodes.forEach(node => {
    if (!isTerminalNode(node)) {
      hasOtherNodes = true;
      if (node.x > maxX) {
        maxX = node.x;
      }
    }
  });
  
  if (hasOtherNodes) {
    // Position terminal node to the right of all other nodes
    terminalNode.x = maxX + 200;
    terminalNode.y = 50; // Fixed Y position for consistency
  } else {
    // If no other nodes exist, keep terminal node in default position
    // or position it in a visible area
    if (terminalNode.x < 50) {
      terminalNode.x = 50;
    }
    if (terminalNode.y < 50) {
      terminalNode.y = 50;
    }
  }
}

// Ensure terminal node exists and is properly initialized
export function ensureTerminalNode() {
  // Skip in notes mode - terminal node is not used there
  if (state.currentMode === 'notes') {
    return null;
  }

  const terminalNode = getTerminalNode();
  positionTerminalNode();
  return terminalNode;
} 