//import { state, save } from './core.js';
//import { render } from './render.js';

let draggingNode = null;
let draggingFromId = null;
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

  // Node dragging
  canvas.addEventListener('mousedown', e => {
    if (e.target.classList.contains('handle')) {
      draggingFromId = e.target.dataset.nodeId;
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  });

  document.addEventListener('mousedown', e => {
    const target = e.target.closest('.node');
    if (!target || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const arr = state.path.reduce((a, id) => a.find(n => n.id === id)?.children ?? a, state.nodes);
    draggingNode = arr.find(n => {
      const dx = n.x - parseInt(target.style.left);
      const dy = n.y - parseInt(target.style.top);
      return Math.abs(dx) < 2 && Math.abs(dy) < 2;
    });
    if (draggingNode) {
      offsetX = x - draggingNode.x;
      offsetY = y - draggingNode.y;
    }
  });

  document.addEventListener('mousemove', e => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;

    if (draggingFromId) {
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
    if (draggingFromId && e.target.closest('.node')) {
      const toId = e.target.closest('.node').dataset.id;
      const arr = state.path.reduce((a, id) => a.find(n => n.id === id)?.children ?? a, state.nodes);
      const fromNode = arr.find(n => n.id === draggingFromId);
      if (fromNode && fromNode.id !== toId && !fromNode.connections.includes(toId)) {
        fromNode.connections.push(toId);
        save();
        render();
      }
    }
    draggingFromId = null;
    window.mouseX = undefined;
    window.mouseY = undefined;
    if (draggingNode) {
      save();
    }
    draggingNode = null;
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
