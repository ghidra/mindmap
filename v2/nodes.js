import { state, save, getCurrentNodes, saveNotes } from './state.js';
import { ATTRIBUTE_TYPES, updateAttributeValue, removeAttributeFromNode } from './attributes.js';
import { refreshAttributesPanel } from './attributes-panel.js';
import { isTerminalNode, updateTerminalAttributeValue, removeTerminalAttribute } from './terminal-nodes.js';

const canvas = document.getElementById('canvas');

export function createNode(x, y, title = 'New Node', type = 'file') {
  return {
    id: Date.now().toString(36),
    type, // Node type: 'file', 'class', 'function', 'note'
    x,
    y,
    flowX: x, // Flow mode X position
    flowY: y, // Flow mode Y position
    title,
    color: '#ffffff',
    expanded: true,
    attributesExpanded: false,
    connections: [],
    children: [],
    attributes: [],
    flowMetadata: {
      depth: 0,
      executionOrder: 0,
      globalVariables: [],
      classMembersMap: {}
    }
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

    // Add note-specific class
    if (n.isNote || state.currentMode === 'notes') {
      el.classList.add('note-node');
    }

    // Add special styling for terminal nodes
    if (isTerminalNode(n)) {
      el.classList.add('terminal-node');
    }

    // Add flow mode styling
    if (state.currentMode === 'flow') {
      el.classList.add('flow-mode');

      // Highlight entry point
      if (state.flowConfig.entryPoint === n.id) {
        el.classList.add('flow-entry-point');
      }

      // Add styling for synthetic structure nodes
      if (n.syntheticNode) {
        el.classList.add('synthetic-node');
        if (n.type === 'class') {
          el.classList.add('synthetic-class');
        } else if (n.type === 'method') {
          el.classList.add('synthetic-method');
        } else if (n.type === 'function') {
          el.classList.add('synthetic-function');
        }
      }
    }

    // Use appropriate position based on mode
    const posX = state.currentMode === 'flow' ? (n.flowX || n.x) : n.x;
    const posY = state.currentMode === 'flow' ? (n.flowY || n.y) : n.y;

    // Apply pan offset
    el.style.left = (posX + state.panX) + 'px';
    el.style.top = (posY + state.panY) + 'px';

    // Apply custom size for note nodes
    if (n.isNote || state.currentMode === 'notes') {
      if (n.width) el.style.width = n.width + 'px';
      if (n.height) el.style.height = n.height + 'px';
      if (n.fontSize) el.style.fontSize = n.fontSize + 'px';
    }

    // Adjust node height based on number of input ports (attributes)
    if (n.attributes && n.attributes.length > 0) {
      // Calculate min height needed for all ports
      // Header: 40px, First port starts at 30px, Each port needs 25px spacing, Bottom padding: 20px
      const minHeight = Math.max(120, 30 + (n.attributes.length * 25) + 20);
      el.style.minHeight = minHeight + 'px';
    }

    // Only apply custom background color if it's not the default white
    // This allows CSS dark mode styles to take effect
    if (n.color && n.color !== '#ffffff') {
      el.style.backgroundColor = n.color;
    }

    // Add output port (drag-to-connect handle) - right side, center
    const handle = document.createElement('span');
    handle.className = 'handle output-port';
    handle.dataset.nodeId = n.id;
    handle.title = 'Output Port - Drag to connect';
    el.appendChild(handle);

    // Add input ports for attributes - left side, stacked
    if (n.attributes && n.attributes.length > 0) {
      const inputPortsContainer = document.createElement('div');
      inputPortsContainer.className = 'input-ports-container';

      n.attributes.forEach((attr, index) => {
        const inputPort = document.createElement('span');
        inputPort.className = 'input-port';
        inputPort.dataset.nodeId = n.id;
        inputPort.dataset.attributeId = attr.id;
        inputPort.title = `Input: ${attr.name}`;
        inputPort.style.top = `${30 + (index * 25)}px`; // Stack vertically, starting below header
        inputPortsContainer.appendChild(inputPort);
      });

      el.appendChild(inputPortsContainer);
    }

    // Add 4-sided ports for note nodes
    if (n.type === 'note' || n.isNote) {
      ['top', 'right', 'bottom', 'left'].forEach(side => {
        const port = document.createElement('span');
        port.className = `note-port note-port-${side}`;
        port.dataset.nodeId = n.id;
        port.dataset.side = side;
        port.title = `Connection Port (${side})`;
        el.appendChild(port);
      });
    }

    // Add draggable header
    const header = document.createElement('div');
    header.className = 'node-header';

    // Add title input (read-only for terminal nodes)
    const input = document.createElement('input');
    input.name = 'title_' + n.id;
    input.value = n.title;
    input.readOnly = isTerminalNode(n); // Terminal nodes can't be renamed
    input.className = isTerminalNode(n) ? 'terminal-title' : '';

    // Apply note-specific title styling
    if (n.isNote || state.currentMode === 'notes') {
      if (n.titleFontSize) input.style.fontSize = n.titleFontSize + 'px';
      if (n.titleColor) input.style.color = n.titleColor;
    }

    if (!isTerminalNode(n)) {
      input.oninput = e => {
        n.title = e.target.value;
      };

      // Save when leaving the input field or pressing Enter
      input.onblur = () => {
        if (n.isNote || state.currentMode === 'notes') {
          console.log('Note title saved:', n.id, n.title);
          saveNotes();
        } else {
          save();
        }
      };

      input.onkeydown = e => {
        if (e.key === 'Enter') {
          e.target.blur(); // Trigger blur to save
        }
      };
    }
    header.appendChild(input);
    el.appendChild(header);

    // Add description field for note nodes (only if enabled)
    if ((n.isNote || state.currentMode === 'notes') && n.showDescription) {
      const descArea = document.createElement('textarea');
      descArea.className = 'note-description';
      descArea.placeholder = 'Add notes here...';
      descArea.value = n.description || '';

      // Apply description styling
      if (n.descriptionFontSize) descArea.style.fontSize = n.descriptionFontSize + 'px';
      if (n.descriptionColor) descArea.style.color = n.descriptionColor;

      descArea.oninput = (e) => {
        n.description = e.target.value;
      };

      // Save when leaving the textarea or pressing Ctrl+Enter
      descArea.onblur = () => {
        console.log('Note description saved:', n.id, n.description.substring(0, 50));
        saveNotes();
      };

      descArea.onkeydown = (e) => {
        // Ctrl+Enter or Cmd+Enter to save and blur
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.target.blur();
        }
      };

      el.appendChild(descArea);
    }

    // Add resize handle for note nodes
    if (n.isNote || state.currentMode === 'notes') {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.title = 'Drag to resize';
      el.appendChild(resizeHandle);
    }

    // Add body container for buttons and content
    const body = document.createElement('div');
    body.className = 'node-body';

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
      body.appendChild(deleteBtn);
    }

    // Add examine button (hidden for terminal nodes)
    if (!isTerminalNode(n)) {
      const examineBtn = document.createElement('button');
      examineBtn.textContent = 'Examine';
      examineBtn.className = (n.children && n.children.length) || n.fileObject ? '' : 'hidden';
      examineBtn.onclick = async (e) => {
        e.stopPropagation();

        // In flow mode, if the node has children, just navigate to them
        // Don't re-parse because FlowAnalyzer already created the structure
        if (state.currentMode === 'flow' && n.children && n.children.length > 0) {
          state.path.push(n.id);
          onRender();
          return;
        }

        // If this is a file node that hasn't been parsed yet (hierarchical mode)
        if (n.fileObject && n.type === 'file' && !(n.metadata && n.metadata.parsed)) {
          const { parserIntegration } = await import('./ParserIntegrationModule.js');
          try {
            await parserIntegration.examineFile(n);
            onRender();
          } catch (error) {
            console.error('Error examining file:', error);
            alert('Error parsing file: ' + error.message);
          }
        } else {
          // Normal examine behavior for directories
          state.path.push(n.id);
          onRender();
        }
      };
      body.appendChild(examineBtn);
    }

    // Add expand/collapse toggle for children (hidden for terminal nodes)
    if (!isTerminalNode(n)) {
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = n.expanded ? '−' : '+';
      toggleBtn.className = (n.children && n.children.length) ? '' : 'hidden';
      toggleBtn.onclick = e => {
        e.stopPropagation();
        n.expanded = !n.expanded;
        onRender();
      };
      body.appendChild(toggleBtn);
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
    body.appendChild(attrToggleBtn);

    // Show children inline if expanded (only for non-terminal nodes)
    if (!isTerminalNode(n) && n.expanded && n.children && n.children.length) {
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
      body.appendChild(list);
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
      body.appendChild(attrList);
    }

    // Append body to node
    el.appendChild(body);

    canvas.appendChild(el);
  });
} 