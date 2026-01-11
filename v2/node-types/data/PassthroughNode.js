/**
 * Passthrough/Null Node - Flow control node
 * Simple node that passes connections through for organization
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const PassthroughNodeType = {
  id: 'passthrough',
  name: 'Passthrough',
  category: 'data',
  icon: '⚪',
  defaultPorts: [
    {
      id: 'input',
      side: 'left',
      type: 'input',
      position: 0.5,
      label: 'in'
    },
    {
      id: 'output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'out'
    }
  ],
  defaultStyle: {
    width: 80,
    height: 60,
    color: '#3a3a3a',
    borderColor: '#666',
    borderWidth: 1,
    borderRadius: 30  // Rounded for minimal appearance
  },
  features: {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'passthrough-node-content';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.height = '100%';
    content.style.fontSize = '20px';
    content.style.color = '#999';

    // Simple dot or icon to indicate passthrough
    const icon = document.createElement('div');
    icon.textContent = '→';
    icon.style.fontWeight = 'bold';
    content.appendChild(icon);

    container.appendChild(content);

    // Make the node more minimal
    container.style.minHeight = 'unset';
  }
};
