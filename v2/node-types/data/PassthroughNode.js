/**
 * Passthrough/Null Node - Flow control node
 *
 * Simple node that passes connections through for organization.
 * Minimal appearance with single input and output ports.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';

/**
 * Passthrough Node Type class.
 */
export class PassthroughNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'passthrough';
  static displayName = 'Passthrough';
  static category = 'data';
  static icon = '⚪';

  static defaultPorts = [
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
  ];

  static defaultStyle = {
    width: 80,
    height: 60,
    color: '#3a3a3a',
    borderColor: '#666',
    borderWidth: 1,
    borderRadius: 30  // Rounded for minimal appearance
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: false,
    canContainNodes: false,
    canCollapse: false,
    canEdit: false
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Passthrough has simple input/output ports.
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
   * Render passthrough node content with minimal appearance.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
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
}

// Export as object for backwards compatibility
export const PassthroughNodeType = PassthroughNode;
