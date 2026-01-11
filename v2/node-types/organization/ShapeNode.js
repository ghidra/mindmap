/**
 * Shape Node - Visual container with configurable shape
 * Can be used for grouping or visual organization
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const ShapeNodeType = {
  id: 'shape',
  name: 'Shape',
  category: 'organization',
  icon: '⬜',
  defaultPorts: [
    {
      id: 'top',
      side: 'top',
      type: 'bidirectional',
      position: 0.5,
      label: ''
    },
    {
      id: 'right',
      side: 'right',
      type: 'bidirectional',
      position: 0.5,
      label: ''
    },
    {
      id: 'bottom',
      side: 'bottom',
      type: 'bidirectional',
      position: 0.5,
      label: ''
    },
    {
      id: 'left',
      side: 'left',
      type: 'bidirectional',
      position: 0.5,
      label: ''
    }
  ],
  defaultStyle: {
    width: 150,
    height: 150,
    color: '#2d4a2e',
    borderColor: '#66bb6a',
    borderWidth: 2,
    borderRadius: 8
  },
  features: {
    canHaveChildren: false,
    canHaveAttributes: true,     // Can have custom shape properties
    canResize: true,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'shape-node-content';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.height = '100%';

    // Apply shape-specific styling
    if (node.shape === 'circle') {
      container.style.borderRadius = '50%';
    } else if (node.shape === 'diamond') {
      container.style.transform = 'rotate(45deg)';
      // Rotate content back
      content.style.transform = 'rotate(-45deg)';
    } else if (node.shape === 'hexagon') {
      // Approximate hexagon with clip-path
      container.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
    }

    // Show shape type label if no title
    if (!node.title || node.title === 'Shape') {
      const shapeLabel = document.createElement('div');
      shapeLabel.textContent = node.shape || 'Rectangle';
      shapeLabel.style.fontSize = '12px';
      shapeLabel.style.color = '#666';
      shapeLabel.style.textTransform = 'capitalize';
      content.appendChild(shapeLabel);
    }

    container.appendChild(content);
  }
};
