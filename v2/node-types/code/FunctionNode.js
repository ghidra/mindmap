/**
 * Function Node - Represents a function or method
 * Can have attributes for parameters
 */

import { BaseNodeType } from '../BaseNodeType.js';
import { inferDataType } from '../../core/PortSystem.js';

export const FunctionNodeType = {
  id: 'function',
  name: 'Function',
  category: 'code',
  icon: '⚡',

  /**
   * Generate ports dynamically based on function parameters
   * Supports manual override via node.inputPorts and node.outputPorts arrays
   * @param {Object} node - The node instance
   * @returns {Array} Array of port definitions
   */
  getPorts: (node) => {
    const ports = [];

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
      // Get parameters from node.parameters array or node.attributes object
      let params = node.parameters || [];

      // Fallback to attributes if parameters is empty
      if (params.length === 0 && node.attributes) {
        if (Array.isArray(node.attributes)) {
          params = node.attributes;
        } else if (typeof node.attributes === 'object') {
          params = Object.entries(node.attributes).map(([name, value]) => ({ name, value }));
        }
      }

      // Create input port for each parameter
      params.forEach((param, idx) => {
        let paramName, defaultValue;

        if (typeof param === 'object') {
          paramName = param.name || param.title;
          defaultValue = param.defaultValue || param.value;
        } else {
          const paramStr = String(param);
          if (paramStr.includes('=')) {
            const parts = paramStr.split('=');
            paramName = parts[0].trim();
            defaultValue = parts[1].trim();
          } else {
            paramName = paramStr.trim();
            defaultValue = null;
          }
        }

        if (paramName) {
          ports.push({
            id: `param-${paramName}`,
            side: 'left',
            type: 'input',
            position: (idx + 1) / (params.length + 1),
            label: paramName,
            dataType: inferDataType(defaultValue)
          });
        }
      });
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
      // Default return port
      ports.push({
        id: 'return',
        side: 'right',
        type: 'output',
        position: 0.5,
        label: node.returnType || 'return',
        dataType: node.returnType ? node.returnType.toLowerCase() : 'unknown'
      });
    }

    return ports;
  },
  defaultStyle: {
    width: 180,
    height: 100,
    color: '#3a2847',
    borderColor: '#ba68c8',
    borderWidth: 2,
    borderRadius: 4
  },
  features: {
    canHaveChildren: false,      // Functions typically don't have hierarchical children
    canHaveAttributes: true,     // Can have parameters as attributes
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'function-node-content';

    // Show parameter count
    if (node.parameters || (node.attributes && Object.keys(node.attributes).length > 0)) {
      const paramCount = node.parameters?.length || Object.keys(node.attributes).length;

      const params = document.createElement('div');
      params.className = 'function-params';
      params.textContent = `(${paramCount} param${paramCount !== 1 ? 's' : ''})`;
      params.style.fontSize = '11px';
      params.style.color = '#7b1fa2';
      params.style.marginTop = '4px';
      params.style.fontFamily = 'monospace';
      content.appendChild(params);
    }

    // Show async indicator
    if (node.isAsync) {
      const asyncLabel = document.createElement('div');
      asyncLabel.className = 'function-async';
      asyncLabel.textContent = 'async';
      asyncLabel.style.fontSize = '10px';
      asyncLabel.style.color = '#fff';
      asyncLabel.style.backgroundColor = '#7b1fa2';
      asyncLabel.style.padding = '2px 6px';
      asyncLabel.style.borderRadius = '3px';
      asyncLabel.style.display = 'inline-block';
      asyncLabel.style.marginTop = '4px';
      content.appendChild(asyncLabel);
    }

    // Show return type if specified
    if (node.returnType) {
      const returnType = document.createElement('div');
      returnType.className = 'function-return-type';
      returnType.textContent = `→ ${node.returnType}`;
      returnType.style.fontSize = '11px';
      returnType.style.color = '#666';
      returnType.style.marginTop = '4px';
      returnType.style.fontFamily = 'monospace';
      content.appendChild(returnType);
    }

    container.appendChild(content);
  }
};
