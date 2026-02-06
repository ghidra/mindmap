/**
 * Notes Node - Freeform text/notes with rich editing
 *
 * Resizable with 4-sided ports for flexible connections.
 * Supports editable text content via textarea.
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';

/**
 * Notes Node Type class.
 */
export class NotesNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'note';
  static displayName = 'Notes';
  static category = 'organization';
  static icon = '📝';

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
    width: 200,
    height: 150,
    color: '#fff9c4',
    borderColor: '#fbc02d',
    borderWidth: 1,
    borderRadius: 4
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: true,             // Notes are resizable
    canContainNodes: false,
    canCollapse: false,
    canEdit: true
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Notes have 4-sided bidirectional ports.
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
   * Render notes node content with editable textarea.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
    const content = document.createElement('div');
    content.className = 'notes-node-content';
    content.style.padding = '8px';
    content.style.height = 'calc(100% - 40px)'; // Account for header
    content.style.overflow = 'auto';

    // Description/notes textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'notes-textarea';
    textarea.placeholder = 'Add notes here...';
    textarea.value = node.description || '';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.border = 'none';
    textarea.style.background = 'transparent';
    textarea.style.resize = 'none';
    textarea.style.fontFamily = 'inherit';
    textarea.style.fontSize = node.fontSize ? `${node.fontSize}px` : '14px';
    textarea.style.color = node.textColor || '#000';

    textarea.oninput = (e) => {
      node.description = e.target.value;
    };

    textarea.onblur = () => {
      // Trigger save (will be handled by event system)
      const event = new CustomEvent('node-updated', { detail: { nodeId: node.id } });
      document.dispatchEvent(event);
    };

    content.appendChild(textarea);
    container.appendChild(content);
  }
}

// Export as object for backwards compatibility
export const NotesNodeType = NotesNode;
