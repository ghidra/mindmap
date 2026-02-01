/**
 * Class Node - Represents a class definition
 * Can have children (methods, properties)
 */

import { BaseNodeType } from '../BaseNodeType.js';
import { inferDataType } from '../../core/PortSystem.js';

export const ClassNodeType = {
  id: 'class',
  name: 'Class',
  category: 'code',
  icon: '🔷',

  /**
   * Generate ports dynamically based on class members (properties)
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
      // Collect properties from multiple sources
      let properties = [];

      // Source 1: node.attributes object (most common for parsed classes)
      if (node.attributes && typeof node.attributes === 'object' && !Array.isArray(node.attributes)) {
        properties = Object.entries(node.attributes).map(([name, value]) => ({ name, value }));
      }

      // Source 2: node.children with type === 'property'
      if (properties.length === 0 && node.children) {
        const childProps = node.children.filter(c => c.type === 'property');
        properties = childProps.map(c => ({ name: c.title || c.name, value: c.value }));
      }

      // Source 3: node.properties array
      if (properties.length === 0 && node.properties) {
        properties = node.properties.map(p =>
          typeof p === 'string' ? { name: p, value: null } : { name: p.name, value: p.value }
        );
      }

      // Create input port for each property
      properties.forEach((prop, idx) => {
        if (prop.name) {
          ports.push({
            id: `prop-${prop.name}`,
            side: 'left',
            type: 'input',
            position: (idx + 1) / (properties.length + 1),
            label: prop.name,
            dataType: inferDataType(prop.value)
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
      // Default output port for class instance
      ports.push({
        id: 'instance',
        side: 'right',
        type: 'output',
        position: 0.5,
        label: 'instance',
        dataType: 'object'
      });
    }

    return ports;
  },
  defaultStyle: {
    width: 180,
    height: 110,
    color: '#1e3a5f',
    borderColor: '#4a90e2',
    borderWidth: 2,
    borderRadius: 4
  },
  features: {
    canHaveChildren: true,      // Can contain methods, properties
    canHaveAttributes: true,     // Can have class-level attributes
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'class-node-content';

    // Show constructor if present
    if (node.hasConstructor) {
      const constructor = document.createElement('div');
      constructor.className = 'class-constructor';
      constructor.textContent = 'constructor()';
      constructor.style.fontSize = '11px';
      constructor.style.color = '#1976d2';
      constructor.style.marginTop = '4px';
      constructor.style.fontFamily = 'monospace';
      content.appendChild(constructor);
    }

    // Show method/property count
    if (node.children && node.children.length > 0) {
      const methods = node.children.filter(c => c.type === 'method' || c.type === 'function');
      const properties = node.children.filter(c => c.type === 'property');

      const summary = document.createElement('div');
      summary.className = 'class-summary';
      summary.style.fontSize = '11px';
      summary.style.color = '#666';
      summary.style.marginTop = '4px';

      const parts = [];
      if (methods.length > 0) parts.push(`${methods.length} methods`);
      if (properties.length > 0) parts.push(`${properties.length} properties`);

      summary.textContent = parts.join(', ');
      content.appendChild(summary);
    }

    container.appendChild(content);
  }
};
