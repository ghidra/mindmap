/**
 * Text Node - Simple label for organization
 * Minimal styling, just displays text with customizable size and color
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const TextNodeType = {
  id: 'text',
  name: 'Text Label',
  category: 'organization',
  icon: '📌',
  defaultPorts: [],  // No ports by default
  defaultStyle: {
    width: 150,
    height: 50,
    color: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0
  },
  // Default text properties
  defaultTextStyle: {
    fontSize: 16,
    textColor: '#ffffff',
    bold: false,
    italic: false
  },
  features: {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: true,  // Allow resizing
    canContainNodes: false
  },
  renderContent: (node, container) => {
    // Text nodes show just the title in the header with custom styling
    // This content area can show additional description if needed
    const content = document.createElement('div');
    content.className = 'text-node-content';
    content.style.textAlign = 'center';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.height = '100%';

    if (node.description) {
      const text = document.createElement('div');
      text.textContent = node.description;
      text.style.fontSize = node.fontSize ? `${node.fontSize}px` : '16px';
      text.style.fontWeight = node.bold ? 'bold' : 'normal';
      text.style.fontStyle = node.italic ? 'italic' : 'normal';
      text.style.color = node.textColor || '#ffffff';
      content.appendChild(text);
    }

    container.appendChild(content);
  }
};
