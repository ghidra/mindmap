/**
 * Class Node - Represents a class definition
 * Can have children (methods, properties)
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const ClassNodeType = {
  id: 'class',
  name: 'Class',
  category: 'code',
  icon: '🔷',
  defaultPorts: [
    {
      id: 'extends',
      side: 'left',
      type: 'input',
      position: 0.3,
      label: 'extends'
    },
    {
      id: 'instantiated-by',
      side: 'left',
      type: 'input',
      position: 0.7,
      label: 'used by'
    },
    {
      id: 'output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'provides'
    }
  ],
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
