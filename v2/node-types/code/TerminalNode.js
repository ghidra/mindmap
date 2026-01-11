/**
 * Terminal Node Type
 * Special node for storing global attributes and terminal-level data
 */

export const TerminalNodeType = {
  id: 'terminal',
  name: 'Terminal',
  category: 'code',
  icon: '⚡',
  description: 'Global attributes and terminal-level data',

  defaultPorts: [],

  defaultStyle: {
    width: 200,
    height: 120,
    color: '#1a3a52',
    borderColor: '#4a90e2',
    borderWidth: 2
  },

  features: {
    canHaveChildren: false,
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false,
    isDeletable: false // Terminal node cannot be deleted
  },

  /**
   * Render terminal node content
   */
  renderContent: (node, container) => {
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
};
