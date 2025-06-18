import { state, save, getCurrentNodes } from './state.js';
import { render } from './render.js';
import { renderConnections, addConnection } from './connections.js';
import { createNode } from './nodes.js';
import { selectNode } from './attributes-panel.js';
import { ensureTerminalNode } from './terminal-nodes.js';

let draggingNode = null;
window.draggingFromId = null;
window.mouseX = undefined;
window.mouseY = undefined;
let wasConnectionDragging = false; // Flag to track if we just finished connection dragging
document.body.style.userSelect = '';
let offsetX = 0, offsetY = 0;

function wireEvents() {
  if (typeof startLineLoop === 'function') startLineLoop();
  const canvas = document.getElementById('canvas');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');

  canvas.addEventListener('click', e => {
    if (e.target !== canvas) return;
    
    // Don't create a node if we just finished connection dragging
    if (wasConnectionDragging) {
      wasConnectionDragging = false;
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const nodes = getCurrentNodes();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Ensure terminal node exists before adding new nodes
    ensureTerminalNode();
    
    nodes.push(createNode(x, y));
    save();
    render();
  });

  clearBtn.onclick = () => {
    localStorage.removeItem('mindmap');
    state.nodes = [];
    state.path = [];
    render();
  };

  // Handle both node dragging and connection dragging
  canvas.addEventListener('mousedown', e => {
    const target = e.target.closest('.node');
    
    // Handle connection dragging
    if (e.target.classList.contains('handle')) {
      window.draggingFromId = e.target.dataset.nodeId;
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Handle node selection and dragging
    if (target && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const nodes = getCurrentNodes();
      draggingNode = nodes.find(n => n.id === target.dataset.id);
      
      if (draggingNode) {
        // Select the node for attributes panel
        selectNode(draggingNode.id);
        
        offsetX = x - draggingNode.x;
        offsetY = y - draggingNode.y;
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }
    }
  });

  document.addEventListener('mousemove', e => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;

    if (window.draggingFromId) {
      renderConnections();
      return;
    }

    if (!draggingNode) return;
    const rect = canvas.getBoundingClientRect();
    draggingNode.x = e.clientX - rect.left - offsetX;
    draggingNode.y = e.clientY - rect.top - offsetY;
    render();
  });

  document.addEventListener('mouseup', e => {
    document.body.style.userSelect = '';
    
    if (window.draggingFromId) {
      const wasDragging = window.draggingFromId;
      window.draggingFromId = null;
      window.mouseX = undefined;
      window.mouseY = undefined;
      wasConnectionDragging = true; // Set flag to prevent node creation

      if (e.target.closest('.node')) {
        const toId = e.target.closest('.node').dataset.id;
        if (addConnection(wasDragging, toId)) {
          save();
        }
      }
      renderConnections();
      
      // Prevent the canvas click event from firing when connection dragging ends
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (draggingNode) {
      save();
      draggingNode = null;
    }
  });

  importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = ev => {
      try {
        state.nodes = JSON.parse(ev.target.result);
        state.path = [];
        render();
      } catch (err) {
        alert('Invalid file');
      }
    };
    fr.readAsText(file);
  };
}

export { wireEvents };
