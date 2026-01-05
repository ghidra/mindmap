import { getCurrentNodes, state } from './state.js';
import { isTerminalNode } from './terminal-nodes.js';

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

  // In flow mode, use execution graph edges
  if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
    const edges = state.flowConfig.executionGraph.edges;

    // Filter edges to only show connections between currently visible nodes
    const visibleNodeIds = new Set(nodes.map(n => n.id));
    const visibleEdges = edges.filter(edge =>
      visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    );

    console.log(`Rendering ${visibleEdges.length} flow connections (${edges.length - visibleEdges.length} hidden)`);

    visibleEdges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return; // Skip if nodes not found (shouldn't happen after filtering)
      }

      if (fromNode.handleX === undefined || toNode.handleX === undefined) {
        return; // Skip if handle positions not set
      }

      if (fromNode && toNode && fromNode.handleX !== undefined && toNode.handleX !== undefined) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.handleX);
        line.setAttribute('y1', fromNode.handleY);
        line.setAttribute('x2', toNode.handleX);
        line.setAttribute('y2', toNode.handleY);

        // Style based on edge type
        if (edge.type === 'structure') {
          // Structure connections (file -> class -> method)
          line.setAttribute('stroke', '#8b5cf6');
          line.setAttribute('stroke-width', '1.5');
          line.setAttribute('stroke-dasharray', '3,3');
        } else if (edge.type === 'extends') {
          // Class inheritance connections
          line.setAttribute('stroke', '#f59e0b');
          line.setAttribute('stroke-width', '3');
          line.setAttribute('stroke-dasharray', '8,4');
        } else if (edge.type === 'instantiates') {
          // Class instantiation connections
          line.setAttribute('stroke', '#ef4444');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '4,2');
        } else if (edge.type === 'entry') {
          // Entry point connections (index.html -> main.js)
          line.setAttribute('stroke', '#06b6d4');
          line.setAttribute('stroke-width', '3');
          line.setAttribute('stroke-dasharray', '10,3');
        } else if (edge.type === 'import' || edge.type === 'dynamic-import') {
          // Import/dependency connections
          line.setAttribute('stroke', '#28a745');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5,2');
        } else if (edge.type === 'script') {
          // HTML script tag connections
          line.setAttribute('stroke', '#007bff');
          line.setAttribute('stroke-width', '2');
        } else {
          // Default
          line.setAttribute('stroke', '#666');
          line.setAttribute('stroke-width', '2');
        }

        svg.appendChild(line);
      }
    });
  } else {
    // In hierarchical mode, use node connections
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

            // Use different styling for connections involving terminal nodes
            if (isTerminalNode(n) || isTerminalNode(toNode)) {
              line.setAttribute('stroke', '#17a2b8');
              line.setAttribute('stroke-width', '2');
              line.setAttribute('stroke-dasharray', '5,5');
            } else {
              line.setAttribute('stroke', 'black');
              line.setAttribute('stroke-width', '2');
            }

            svg.appendChild(line);
          }
        });
      }
    });
  }

  // Draw temporary connection line if dragging
  if (window.draggingFromId && window.mouseX !== undefined && window.mouseY !== undefined) {
    const fromNode = nodes.find(n => n.id === window.draggingFromId);
    if (fromNode) {
      const rect = canvas.getBoundingClientRect();
      const x2 = window.mouseX - rect.left;
      const y2 = window.mouseY - rect.top;

      // Use the actual port position instead of always using handle position
      let x1, y1;
      if (window.draggingFromPort) {
        const portRect = window.draggingFromPort.getBoundingClientRect();
        x1 = portRect.left - rect.left + portRect.width / 2;
        y1 = portRect.top - rect.top + portRect.height / 2;
      } else if (fromNode.handleX !== undefined) {
        // Fallback to handle position if port not stored
        x1 = fromNode.handleX;
        y1 = fromNode.handleY;
      }

      if (x1 !== undefined && y1 !== undefined) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);

        // Use different styling for terminal node connections
        if (isTerminalNode(fromNode)) {
          line.setAttribute('stroke', '#17a2b8');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5,5');
        } else {
          line.setAttribute('stroke', '#666');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5,5');
        }

        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);
      }
    }
  }
}

export function addConnection(fromId, toId) {
  const nodes = getCurrentNodes();
  const fromNode = nodes.find(n => n.id === fromId);
  const toNode = nodes.find(n => n.id === toId);

  if (fromNode && fromNode.id !== toId && !fromNode.connections.includes(toId)) {
    fromNode.connections.push(toId);
    return true;
  }
  return false;
}

export function toggleConnection(fromId, toId) {
  const nodes = getCurrentNodes();
  const fromNode = nodes.find(n => n.id === fromId);

  if (!fromNode || fromNode.id === toId) {
    return false; // Can't connect to self
  }

  const connectionIndex = fromNode.connections.indexOf(toId);
  if (connectionIndex !== -1) {
    // Connection exists - remove it
    fromNode.connections.splice(connectionIndex, 1);
    console.log('Connection removed:', fromId, '->', toId);
    return true;
  } else {
    // Connection doesn't exist - add it
    fromNode.connections.push(toId);
    console.log('Connection added:', fromId, '->', toId);
    return true;
  }
} 