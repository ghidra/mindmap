/**
 * File Node - Represents a code file
 * Can have hierarchical children (classes, functions, etc.)
 */

import { BaseNodeType } from '../BaseNodeType.js';
import { inferDataType } from '../../core/PortSystem.js';

export const FileNodeType = {
  id: 'file',
  name: 'File',
  category: 'code',
  icon: '📄',

  /**
   * Generate ports dynamically based on file contents
   * For JS files without classes, expose top-level variables as input ports
   * Supports manual override via node.inputPorts and node.outputPorts arrays
   * @param {Object} node - The node instance
   * @returns {Array} Array of port definitions
   */
  getPorts: (node) => {
    const ports = [];
    const children = node.children || [];

    // Check for manual port override first
    if (node.inputPorts && node.inputPorts.length > 0) {
      node.inputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `input-${name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (node.inputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Check if this is a JS file without classes
      const hasClasses = children.some(c => c.type === 'class');

      // Collect variables from multiple sources
      let variables = [];

      // Source 1: node.nodeAttributes object (most common for parsed files)
      if (node.nodeAttributes && typeof node.nodeAttributes === 'object') {
        variables = Object.entries(node.nodeAttributes).map(([name, value]) => ({ name, value }));
      }

      // Source 2: node.children with type === 'variable'
      if (variables.length === 0) {
        const childVars = children.filter(c => c.type === 'variable');
        variables = childVars.map(c => ({ name: c.title || c.name, value: c.value }));
      }

      // Source 3: node.variables array
      if (variables.length === 0 && node.variables) {
        variables = node.variables.map(v =>
          typeof v === 'string' ? { name: v, value: null } : { name: v.name, value: v.value }
        );
      }

      // Only add variable ports if no classes present (for JS files)
      if (!hasClasses && variables.length > 0) {
        variables.forEach((variable, idx) => {
          if (variable.name) {
            ports.push({
              id: `var-${variable.name}`,
              side: 'left',
              type: 'input',
              position: (idx + 1) / (variables.length + 1),
              label: variable.name,
              dataType: inferDataType(variable.value)
            });
          }
        });
      }
    }

    // Check for manual output ports override
    if (node.outputPorts && node.outputPorts.length > 0) {
      node.outputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `output-${name}`,
          side: 'right',
          type: 'output',
          position: (idx + 1) / (node.outputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Default exports output port
      ports.push({
        id: 'exports',
        side: 'right',
        type: 'output',
        position: 0.5,
        label: 'exports',
        dataType: 'object'
      });
    }

    return ports;
  },
  defaultStyle: {
    width: 180,
    height: 100,
    color: '#3a3a3a',
    borderColor: '#555',
    borderWidth: 2,
    borderRadius: 4
  },
  features: {
    canHaveChildren: true,      // Can contain classes, functions, etc.
    canHaveAttributes: true,     // Can have file-level attributes
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'file-node-content';

    // File path or name
    if (node.filePath) {
      const path = document.createElement('div');
      path.className = 'file-path';
      path.textContent = node.filePath;
      path.style.fontSize = '11px';
      path.style.color = '#666';
      path.style.marginTop = '4px';
      path.style.overflow = 'hidden';
      path.style.textOverflow = 'ellipsis';
      path.style.whiteSpace = 'nowrap';
      content.appendChild(path);
    }

    // Show child count if has children
    if (node.children && node.children.length > 0) {
      const childCount = document.createElement('div');
      childCount.className = 'file-child-count';
      childCount.textContent = `${node.children.length} items`;
      childCount.style.fontSize = '11px';
      childCount.style.color = '#999';
      childCount.style.marginTop = '2px';
      content.appendChild(childCount);
    }

    container.appendChild(content);
  }
};
