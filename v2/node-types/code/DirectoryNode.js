/**
 * Directory Node - Represents a directory/folder
 * Can have hierarchical children (files, subdirectories, etc.)
 */

export const DirectoryNodeType = {
  id: 'directory',
  name: 'Directory',
  category: 'code',
  icon: '📁',
  defaultPorts: [
    {
      id: 'output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'contents'
    }
  ],
  defaultStyle: {
    width: 180,
    height: 100,
    color: '#3a3a3a',
    borderColor: '#666',
    borderWidth: 2,
    borderRadius: 4
  },
  features: {
    canHaveChildren: true,      // Can contain files, subdirectories, etc.
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
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
};
