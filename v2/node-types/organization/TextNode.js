/**
 * Text Node - Simple label for organization
 *
 * Minimal styling, just displays text with customizable size and color.
 * No ports by default - used purely for labeling.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';

/**
 * Text Node Type class.
 */
export class TextNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'text';
  static displayName = 'Text Label';
  static category = 'organization';
  static icon = '📌';

  static defaultPorts = [];  // No ports by default

  static defaultStyle = {
    width: 150,
    height: 50,
    color: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0
  };

  // Default text properties
  static defaultTextStyle = {
    fontSize: 16,
    textColor: '#ffffff',
    bold: false,
    italic: false
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: true,  // Allow resizing
    canContainNodes: false,
    canCollapse: false,
    canEdit: true
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Text nodes have no ports by default.
   *
   * @param {Object} node - The node instance
   * @returns {Array} Empty array (no ports)
   */
  static getPorts(node) {
    return [];
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render text node content.
   *
   * Text nodes show just the title in the header with custom styling.
   * This content area can show additional description if needed.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
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
}

// Export as object for backwards compatibility
export const TextNodeType = TextNode;
