/**
 * Terminal Node - Special node for global attributes and terminal-level data
 *
 * Stores global variables, constants, and module-level declarations.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';

/**
 * Terminal Node Type class.
 */
export class TerminalNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'terminal';
  static displayName = 'Terminal';
  static category = 'code';
  static icon = '⚡';
  static description = 'Global attributes and terminal-level data';

  static defaultPorts = [];

  static defaultStyle = {
    width: 200,
    height: 120,
    color: '#1a3a52',
    borderColor: '#4a90e2',
    borderWidth: 2,
    borderRadius: 4
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false,
    canCollapse: false,
    canEdit: true,
    isDeletable: false  // Terminal node cannot be deleted
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Terminal nodes have no ports by default.
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
   * Render terminal node content.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
    const content = document.createElement('div');
    content.className = 'terminal-node-content';

    // Show attribute count
    const attrCount = node.attributes?.length || 0;
    const attrLabel = document.createElement('div');
    attrLabel.className = 'terminal-attr-count';
    attrLabel.textContent = `${attrCount} global ${attrCount === 1 ? 'attribute' : 'attributes'}`;
    attrLabel.style.cssText = 'font-size: 12px; color: #666; margin-top: 8px;';
    content.appendChild(attrLabel);

    // Show description
    const desc = document.createElement('div');
    desc.className = 'terminal-description';
    desc.textContent = 'Global variables and constants';
    desc.style.cssText = 'font-size: 11px; color: #999; margin-top: 4px; font-style: italic;';
    content.appendChild(desc);

    container.appendChild(content);
  }
}

// Export as object for backwards compatibility
export const TerminalNodeType = TerminalNode;
