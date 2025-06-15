//import { state, save } from './core.js';
//import { render } from './render.js';

let draggingNode = null;
window.draggingFromId = null;
window.mouseX = undefined;
window.mouseY = undefined;
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
    const rect = canvas.getBoundingClientRect();
    const arr = state.path.reduce((a, id) => a.find(n => n.id === id)?.children ?? a, state.nodes);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    arr.push({
      id: Date.now().toString(36),
      x,
      y,
      title: 'New Node',
      color: '#ffffff',
      expanded: true,
      connections: [],
      children: []
    });
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
    
    // Handle node dragging
    if (target && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const arr = state.path.reduce((a, id) => a.find(n => n.id === id)?.children ?? a, state.nodes);
      draggingNode = arr.find(n => n.id === target.dataset.id);
      
      if (draggingNode) {
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
      render();
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

      if (e.target.closest('.node')) {
        const toId = e.target.closest('.node').dataset.id;
        const arr = state.path.reduce((a, id) => a.find(n => n.id === id)?.children ?? a, state.nodes);
        const fromNode = arr.find(n => n.id === wasDragging);
        if (fromNode && fromNode.id !== toId && !fromNode.connections.includes(toId)) {
          fromNode.connections.push(toId);
          save();
        }
      }
      render();
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
