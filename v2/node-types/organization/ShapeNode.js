/**
 * Shape Node - Visual container with configurable shape
 *
 * Can be used for grouping or visual organization.
 * Supports rectangle, circle, diamond, and hexagon shapes.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';

/**
 * Shape Node Type class.
 */
export class ShapeNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'shape';
  static displayName = 'Shape';
  static category = 'organization';
  static icon = '⬜';

  static defaultPorts = [
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
  ];

  static defaultStyle = {
    width: 150,
    height: 150,
    color: '#2d4a2e',
    borderColor: '#66bb6a',
    borderWidth: 2,
    borderRadius: 8
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: true,     // Can have custom shape properties
    canResize: true,
    canContainNodes: false,
    canCollapse: false,
    canEdit: true
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Shapes have 4-sided bidirectional ports.
   *
   * @param {Object} node - The node instance
   * @returns {Array} Array of port definitions
   */
  static getPorts(node) {
    return this.defaultPorts;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render shape node content with shape-specific styling.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
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
}

// Export as object for backwards compatibility
export const ShapeNodeType = ShapeNode;
