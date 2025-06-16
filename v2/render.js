//import { state, save } from './core.js';

const canvas = document.getElementById('canvas');
const svg    = document.getElementById('connections');
const breadcrumbEl = document.getElementById('breadcrumb');

function render() {
  const arr = state.path.reduce(
    (a, id) => a.find(n => n.id === id)?.children ?? a,
    state.nodes
  );

  canvas.innerHTML = '';
  svg.innerHTML = '';

  // Draw permanent connections first
  arr.forEach(n => {
    if (n.connections && n.connections.length) {
      n.connections.forEach(toId => {
        const toNode = arr.find(target => target.id === toId);
        if (toNode && n.handleX !== undefined && toNode.handleX !== undefined) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', n.handleX);
          line.setAttribute('y1', n.handleY);
          line.setAttribute('x2', toNode.handleX);
          line.setAttribute('y2', toNode.handleY);
          line.setAttribute('stroke', 'black');
          line.setAttribute('stroke-width', '2');
          svg.appendChild(line);
        }
      });
    }
  });

  // Draw temporary connection line if draggingFromId is active
  if (window.draggingFromId && window.mouseX !== undefined && window.mouseY !== undefined) {
    const fromNode = arr.find(n => n.id === window.draggingFromId);
    const rect = canvas.getBoundingClientRect();
    const x2 = window.mouseX - rect.left;
    const y2 = window.mouseY - rect.top;
    if (fromNode && fromNode.handleX !== undefined) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromNode.handleX);
      line.setAttribute('y1', fromNode.handleY);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5,5');
      line.setAttribute('pointer-events', 'none');
      svg.appendChild(line);
    }
  }

  arr.forEach(n => {
    const el = document.createElement('div');
    el.dataset.id = n.id;
    el.className = 'node';
    el.style.left = n.x + 'px';
    el.style.top  = n.y + 'px';
    el.style.backgroundColor = n.color || '#ffffff';

    // Add drag-to-connect handle
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.dataset.nodeId = n.id;
    el.appendChild(handle);

    // After appending to DOM, get handle's actual position
    canvas.appendChild(el);
    const handleRect = handle.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const handleX = handleRect.left - canvasRect.left + handleRect.width/2;
    const handleY = handleRect.top - canvasRect.top + handleRect.height/2;
    console.log('Handle position for node', n.id, ':', { handleX, handleY, nodeX: n.x, nodeY: n.y });

    // Store handle position for connection lines
    n.handleX = handleX;
    n.handleY = handleY;

    const input = document.createElement('input');
    input.name = 'title_' + n.id;
    input.value = n.title;
    input.oninput = e => { n.title = e.target.value; save(); };
    el.appendChild(input);

    // Add color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = n.color || '#ffffff';
    colorInput.onchange = e => {
      n.color = e.target.value;
      render();
    };
    el.appendChild(colorInput);

    // Add child node button
    const childBtn = document.createElement('button');
    childBtn.textContent = '+ Child';
    childBtn.onclick = e => {
      e.stopPropagation();
      n.children.push({
        id: Date.now().toString(36),
        x: n.x + 40,
        y: n.y + 40,
        title: 'Child Node',
        color: '#ffffff',
        expanded: true,
        connections: [],
        children: []
      });
      render();
    };
    el.appendChild(childBtn);

    // Add examine button
    const examineBtn = document.createElement('button');
    examineBtn.textContent = 'Examine';
    examineBtn.className = n.children.length ? '' : 'hidden';
    examineBtn.onclick = e => {
      e.stopPropagation();
      state.path.push(n.id);
      render();
    };
    el.appendChild(examineBtn);

    // Add expand/collapse toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = n.expanded ? '−' : '+';
    toggleBtn.className = n.children.length ? '' : 'hidden';
    toggleBtn.onclick = e => {
      e.stopPropagation();
      n.expanded = !n.expanded;
      render();
    };
    el.appendChild(toggleBtn);

    // Show children inline if expanded
    if (n.expanded && n.children.length) {
      const list = document.createElement('ul');
      list.className = 'child-list';
      n.children.forEach((child, i) => {
        const li = document.createElement('li');
        li.textContent = child.title;

        const rm = document.createElement('button');
        rm.textContent = 'x';
        rm.onclick = e => {
          e.stopPropagation();
          n.children.splice(i, 1);
          render();
        };
        li.appendChild(rm);

        list.appendChild(li);
      });
      el.appendChild(list);
    }
  });

  updateBreadcrumb(arr);
  save();
}

function updateBreadcrumb() {
  breadcrumbEl.innerHTML = '';
  const rootBtn = document.createElement('button');
  rootBtn.textContent = 'Root';
  rootBtn.onclick = () => { state.path = []; render(); };
  breadcrumbEl.appendChild(rootBtn);

  let walker = state.nodes;
  state.path.forEach((id, idx) => {
    const n = walker.find(nn => nn.id === id);
    if (!n) return;
    walker = n.children;
    const btn = document.createElement('button');
    btn.textContent = ' > ' + n.title;
    btn.onclick = () => { state.path = state.path.slice(0, idx + 1); render(); };
    breadcrumbEl.appendChild(btn);
  });
}
