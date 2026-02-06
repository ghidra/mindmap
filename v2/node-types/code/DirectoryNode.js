/**
 * Directory Node - Represents a directory/folder
 *
 * Can have hierarchical children (files, subdirectories, etc.)
 * Dynamically generates ports based on directory contents.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';
import { inferDataType } from '../../core/PortSystem.js';

/**
 * Directory Node Type class.
 */
export class DirectoryNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'directory';
  static displayName = 'Directory';
  static category = 'code';
  static icon = '📁';

  static defaultPorts = [
    {
      id: 'parent',
      side: 'left',
      type: 'input',
      position: 0.5,
      label: 'parent',
      dataType: 'object'
    },
    {
      id: 'contents',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'contents',
      dataType: 'object'
    }
  ];

  static defaultStyle = {
    width: 180,
    height: 100,
    color: '#3a3a3a',
    borderColor: '#666',
    borderWidth: 2,
    borderRadius: 4
  };

  static features = {
    canHaveChildren: true,
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false,
    canCollapse: true,
    canEdit: true
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Generate ports dynamically.
   *
   * Supports manual override via node.inputPorts and node.outputPorts arrays.
   *
   * @param {Object} node - The node instance
   * @returns {Array} Array of port definitions
   */
  static getPorts(node) {
    const ports = [];

    // Check for manual input port override
    if (node.inputPorts && node.inputPorts.length > 0) {
      node.inputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `input-${name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (node.inputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Default parent input port
      ports.push({
        id: 'parent',
        side: 'left',
        type: 'input',
        position: 0.5,
        label: 'parent',
        dataType: 'object'
      });
    }

    // Check for manual output port override
    if (node.outputPorts && node.outputPorts.length > 0) {
      node.outputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `output-${name}`,
          side: 'right',
          type: 'output',
          position: (idx + 1) / (node.outputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Default contents output port
      ports.push({
        id: 'contents',
        side: 'right',
        type: 'output',
        position: 0.5,
        label: 'contents',
        dataType: 'object'
      });
    }

    return ports;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render directory node content.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
    const content = document.createElement('div');
    content.className = 'directory-node-content';

    // Directory path
    if (node.attributes?.path) {
      const path = document.createElement('div');
      path.className = 'directory-path';
      path.textContent = node.attributes.path;
      path.style.fontSize = '11px';
      path.style.color = '#666';
      path.style.marginTop = '4px';
      path.style.overflow = 'hidden';
      path.style.textOverflow = 'ellipsis';
      path.style.whiteSpace = 'nowrap';
      content.appendChild(path);
    }

    // Show child count if has children
    const childCount = (node.children?.length || 0) + (node.childNodes?.length || 0);
    if (childCount > 0) {
      const countEl = document.createElement('div');
      countEl.className = 'directory-child-count';
      countEl.textContent = `${childCount} items`;
      countEl.style.fontSize = '11px';
      countEl.style.color = '#999';
      countEl.style.marginTop = '2px';
      content.appendChild(countEl);
    }

    container.appendChild(content);
  }

  // =========================================================================
  // Behavior
  // =========================================================================

  /**
   * Handle double-click to navigate into directory.
   *
   * @param {Object} node - The node instance
   * @param {Event} event - Click event
   */
  static onDoubleClick(node, event) {
    // Navigation handled by event manager
  }
}

// Export as object for backwards compatibility
export const DirectoryNodeType = DirectoryNode;
