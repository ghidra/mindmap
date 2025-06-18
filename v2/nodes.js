import { state, save, getCurrentNodes } from './state.js';
import { ATTRIBUTE_TYPES, updateAttributeValue, removeAttributeFromNode } from './attributes.js';
import { refreshAttributesPanel } from './attributes-panel.js';
import { isTerminalNode, updateTerminalAttributeValue, removeTerminalAttribute } from './terminal-nodes.js';

const canvas = document.getElementById('canvas');

export function createNode(x, y, title = 'New Node') {
  return {
    id: Date.now().toString(36),
    x,
    y,
    title,
    color: '#ffffff',
    expanded: true,
    attributesExpanded: false,
    connections: [],
    children: [],
    attributes: []
  };
}

export function deleteNode(nodeId) {
  const nodes = getCurrentNodes();
  
  // Remove the node
  const nodeIndex = nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex === -1) return false;
  
  const deletedNode = nodes[nodeIndex];
  nodes.splice(nodeIndex, 1);
  
  // Remove all connections to this node from other nodes
  nodes.forEach(node => {
    if (node.connections) {
      const connectionIndex = node.connections.indexOf(nodeId);
      if (connectionIndex !== -1) {
        node.connections.splice(connectionIndex, 1);
      }
    }
  });
  
  // Remove this node from other nodes' children lists
  nodes.forEach(node => {
    if (node.children) {
      const childIndex = node.children.findIndex(child => child.id === nodeId);
      if (childIndex !== -1) {
        node.children.splice(childIndex, 1);
      }
    }
  });
  
  // Remove from path if it's in the current path
  const pathIndex = state.path.indexOf(nodeId);
  if (pathIndex !== -1) {
    state.path.splice(pathIndex);
  }
  
  save();
  return true;
}

export function renderNodes(onRender, onSelectNode) {
  const nodes = getCurrentNodes();
  
  canvas.innerHTML = '';

  nodes.forEach(n => {
    const el = document.createElement('div');
    el.dataset.id = n.id;
    el.className = 'node';
    
    // Add special styling for terminal nodes
    if (isTerminalNode(n)) {
      el.classList.add('terminal-node');
    }
    
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.backgroundColor = n.color || '#ffffff';

    // Add drag-to-connect handle
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.dataset.nodeId = n.id;
    el.appendChild(handle);

    // Add title input (read-only for terminal nodes)
    const input = document.createElement('input');
    input.name = 'title_' + n.id;
    input.value = n.title;
    input.readOnly = isTerminalNode(n); // Terminal nodes can't be renamed
    input.className = isTerminalNode(n) ? 'terminal-title' : '';
    if (!isTerminalNode(n)) {
      input.oninput = e => { n.title = e.target.value; save(); };
    }
    el.appendChild(input);

    // Add delete button (hidden for terminal nodes)
    if (!isTerminalNode(n)) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Delete Node';
      deleteBtn.onclick = e => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${n.title}"? This will also remove all connections to this node.`)) {
          deleteNode(n.id);
          onRender();
        }
      };
      el.appendChild(deleteBtn);
    }

    // Add examine button (hidden for terminal nodes)
    if (!isTerminalNode(n)) {
      const examineBtn = document.createElement('button');
      examineBtn.textContent = 'Examine';
      examineBtn.className = n.children.length ? '' : 'hidden';
      examineBtn.onclick = e => {
        e.stopPropagation();
        state.path.push(n.id);
        onRender();
      };
      el.appendChild(examineBtn);
    }

    // Add expand/collapse toggle for children (hidden for terminal nodes)
    if (!isTerminalNode(n)) {
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = n.expanded ? '−' : '+';
      toggleBtn.className = n.children.length ? '' : 'hidden';
      toggleBtn.onclick = e => {
        e.stopPropagation();
        n.expanded = !n.expanded;
        onRender();
      };
      el.appendChild(toggleBtn);
    }

    // Add attributes toggle button
    const attrToggleBtn = document.createElement('button');
    attrToggleBtn.textContent = n.attributesExpanded ? '−' : '+';
    attrToggleBtn.className = isTerminalNode(n) ? 'attr-toggle terminal-attr-toggle' : 'attr-toggle';
    attrToggleBtn.title = isTerminalNode(n) ? 'Toggle Level Attributes' : 'Toggle Attributes';
    attrToggleBtn.onclick = e => {
      e.stopPropagation();
      n.attributesExpanded = !n.attributesExpanded;
      onRender();
    };
    el.appendChild(attrToggleBtn);

    // Show children inline if expanded (only for non-terminal nodes)
    if (!isTerminalNode(n) && n.expanded && n.children.length) {
      const list = document.createElement('ul');
      list.className = 'child-list';
      
      // Filter out terminal nodes from children display
      const nonTerminalChildren = n.children.filter(child => !isTerminalNode(child));
      
      nonTerminalChildren.forEach((child, i) => {
        const li = document.createElement('li');
        li.textContent = child.title;

        const rm = document.createElement('button');
        rm.textContent = 'x';
        rm.onclick = e => {
          e.stopPropagation();
          // Find the actual index in the original children array
          const actualIndex = n.children.findIndex(c => c.id === child.id);
          if (actualIndex !== -1) {
            n.children.splice(actualIndex, 1);
            onRender();
          }
        };
        li.appendChild(rm);

        list.appendChild(li);
      });
      el.appendChild(list);
    }

    // Show attributes inline if expanded
    if (n.attributesExpanded && n.attributes && n.attributes.length > 0) {
      const attrList = document.createElement('div');
      attrList.className = isTerminalNode(n) ? 'attributes-list terminal-attributes-list' : 'attributes-list';
      n.attributes.forEach(attribute => {
        const attrItem = document.createElement('div');
        attrItem.className = isTerminalNode(n) ? 'node-attribute-item terminal-node-attribute-item' : 'node-attribute-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'attr-name';
        nameSpan.textContent = attribute.name + ':';
        
        const valueInput = document.createElement('input');
        valueInput.className = 'attr-value';
        valueInput.type = attribute.type === ATTRIBUTE_TYPES.INTEGER || attribute.type === ATTRIBUTE_TYPES.FLOAT ? 'number' : 'text';
        valueInput.step = attribute.type === ATTRIBUTE_TYPES.FLOAT ? '0.1' : '1';
        valueInput.value = attribute.value;
        valueInput.onchange = e => {
          if (isTerminalNode(n)) {
            updateTerminalAttributeValue(attribute.id, e.target.value);
          } else {
            updateAttributeValue(n, attribute.id, e.target.value);
          }
          save();
          refreshAttributesPanel();
        };
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-attr';
        removeBtn.textContent = '×';
        removeBtn.onclick = e => {
          e.stopPropagation();
          if (isTerminalNode(n)) {
            removeTerminalAttribute(attribute.id);
          } else {
            removeAttributeFromNode(n, attribute.id);
          }
          save();
          refreshAttributesPanel();
          onRender();
        };
        
        attrItem.appendChild(nameSpan);
        attrItem.appendChild(valueInput);
        attrItem.appendChild(removeBtn);
        attrList.appendChild(attrItem);
      });
      el.appendChild(attrList);
    }

    canvas.appendChild(el);
  });
} 