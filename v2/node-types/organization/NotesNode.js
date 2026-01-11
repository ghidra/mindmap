/**
 * Notes Node - Freeform text/notes with rich editing
 * Resizable with 4-sided ports for flexible connections
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const NotesNodeType = {
  id: 'note',
  name: 'Notes',
  category: 'organization',
  icon: '📝',
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
    width: 200,
    height: 150,
    color: '#fff9c4',
    borderColor: '#fbc02d',
    borderWidth: 1,
    borderRadius: 4
  },
  features: {
    canHaveChildren: false,
    canHaveAttributes: false,
    canResize: true,             // Notes are resizable
    canContainNodes: false
  },
  renderContent: (node, container) => {
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
};
