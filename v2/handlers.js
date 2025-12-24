import { state, save, getCurrentNodes } from './state.js';
import { render } from './render.js';
import { renderConnections, addConnection } from './connections.js';
import { createNode } from './nodes.js';
import { selectNode } from './attributes-panel.js';
import { ensureTerminalNode } from './terminal-nodes.js';
import { parserIntegration } from './ParserIntegrationModule.js';

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
    // Drag if clicking on header OR node background (but not buttons/inputs/handles)
    const isHeader = e.target.classList.contains('node-header') || e.target.closest('.node-header');
    const isBackground = target && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('handle');

    if (target && (isHeader || isBackground)) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const nodes = getCurrentNodes();
      draggingNode = nodes.find(n => n.id === target.dataset.id);

      if (draggingNode) {
        // Select the node for attributes panel
        selectNode(draggingNode.id);

        // Calculate offset from mouse to node position
        offsetX = mouseX - draggingNode.x;
        offsetY = mouseY - draggingNode.y;
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
    // Always restore text selection
    document.body.style.userSelect = '';

    // Handle connection dragging end
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
      return;
    }

    // Handle node dragging end
    if (draggingNode) {
      save();
      draggingNode = null;
      offsetX = 0;
      offsetY = 0;
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

  // Load Code button
  const loadCodeBtn = document.getElementById('loadCodeBtn');
  const codeFileInput = document.getElementById('codeFileInput');

  loadCodeBtn.onclick = () => {
    codeFileInput.click();
  };

  codeFileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      await parserIntegration.loadFromDirectory(files);
    } catch (error) {
      console.error('Error loading directory:', error);
      alert('Error loading directory: ' + error.message);
    }
  };
}

export { wireEvents };
