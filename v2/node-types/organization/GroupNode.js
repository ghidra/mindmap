/**
 * Group Node - Container for other nodes
 * Moving the group moves all contained nodes together
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const GroupNodeType = {
  id: 'group',
  name: 'Group',
  category: 'organization',
  icon: '📦',
  defaultPorts: [],  // Groups typically don't have ports (their children do)
  defaultStyle: {
    width: 400,
    height: 300,
    color: 'rgba(100, 150, 200, 0.1)',
    borderColor: '#4a90e2',
    borderWidth: 2,
    borderRadius: 8
  },
  features: {
    canHaveChildren: false,      // Groups contain nodes, not hierarchical children
    canHaveAttributes: false,
    canResize: true,             // Groups are resizable
    canContainNodes: true        // This is the key feature - can contain other nodes
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'group-node-content';
    content.style.padding = '8px';
    content.style.height = 'calc(100% - 40px)'; // Account for header

    // Show container status
    const containedCount = node.containedNodes ? node.containedNodes.length : 0;

    const info = document.createElement('div');
    info.className = 'group-info';
    info.style.fontSize = '12px';
    info.style.color = '#666';
    info.style.marginTop = '4px';

    if (containedCount > 0) {
      info.textContent = `Contains ${containedCount} node${containedCount !== 1 ? 's' : ''}`;
    } else {
      info.textContent = 'Empty group - drag nodes here';
      info.style.fontStyle = 'italic';
    }

    content.appendChild(info);

    // Add visual indicator for drop zone
    const dropZone = document.createElement('div');
    dropZone.className = 'group-drop-zone';
    dropZone.style.position = 'absolute';
    dropZone.style.top = '40px';
    dropZone.style.left = '0';
    dropZone.style.right = '0';
    dropZone.style.bottom = '0';
    dropZone.style.border = '2px dashed rgba(74, 144, 226, 0.3)';
    dropZone.style.margin = '8px';
    dropZone.style.borderRadius = '4px';
    dropZone.style.pointerEvents = 'none';
    dropZone.style.display = containedCount > 0 ? 'none' : 'block';

    content.appendChild(dropZone);
    container.appendChild(content);

    // Apply semi-transparent background to group container
    container.style.opacity = '0.9';
    container.style.zIndex = '0'; // Groups should be behind regular nodes
  }
};
