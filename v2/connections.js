import { getCurrentNodes } from './state.js';

const canvas = document.getElementById('canvas');
const svg = document.getElementById('connections');

// Global state for connection dragging
window.draggingFromId = null;
window.mouseX = undefined;
window.mouseY = undefined;

function debugHandlePosition(handle, nodeId) {
  const handleRect = handle.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const nodeEl = canvas.querySelector(`[data-id="${nodeId}"]`);
  const nodeRect = nodeEl ? nodeEl.getBoundingClientRect() : null;
  
  /*console.log('Debug handle position for node', nodeId, ':', {
    handleRect: { left: handleRect.left, top: handleRect.top, width: handleRect.width, height: handleRect.height },
    canvasRect: { left: canvasRect.left, top: canvasRect.top },
    nodeRect: nodeRect ? { left: nodeRect.left, top: nodeRect.top, width: nodeRect.width, height: nodeRect.height } : null,
    handleComputedStyle: window.getComputedStyle(handle),
    nodeComputedStyle: nodeEl ? window.getComputedStyle(nodeEl) : null
  });*/
}

export function calculateHandlePositions() {
  const nodes = getCurrentNodes();
  
  nodes.forEach(n => {
    const nodeEl = canvas.querySelector(`[data-id="${n.id}"]`);
    if (nodeEl) {
      const handle = nodeEl.querySelector('.handle');
      if (handle) {
        debugHandlePosition(handle, n.id);
        
        const handleRect = handle.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        n.handleX = handleRect.left - canvasRect.left + handleRect.width / 2;
        n.handleY = handleRect.top - canvasRect.top + handleRect.height / 2;
        
        /*console.log('Calculated handle position for node', n.id, ':', { 
          handleX: n.handleX, 
          handleY: n.handleY,
          nodeX: n.x, 
          nodeY: n.y
        });*/
      }
    }
  });
}

export function renderConnections() {
  const nodes = getCurrentNodes();

  // Clear existing connections
  svg.innerHTML = '';

  // Draw permanent connections
  nodes.forEach(n => {
    if (n.connections && n.connections.length) {
      n.connections.forEach(toId => {
        const toNode = nodes.find(target => target.id === toId);
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

  // Draw temporary connection line if dragging
  if (window.draggingFromId && window.mouseX !== undefined && window.mouseY !== undefined) {
    const fromNode = nodes.find(n => n.id === window.draggingFromId);
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
}

export function addConnection(fromId, toId) {
  const nodes = getCurrentNodes();
  const fromNode = nodes.find(n => n.id === fromId);
  if (fromNode && fromNode.id !== toId && !fromNode.connections.includes(toId)) {
    fromNode.connections.push(toId);
    return true;
  }
  return false;
} 