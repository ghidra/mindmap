/**
 * File Node - Represents a code file
 * Can have hierarchical children (classes, functions, etc.)
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const FileNodeType = {
  id: 'file',
  name: 'File',
  category: 'code',
  icon: '📄',
  defaultPorts: [
    {
      id: 'output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'exports'
    }
  ],
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
