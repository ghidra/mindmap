import { state, save } from './state.js';
import { renderNodes } from './nodes.js';
import { calculateHandlePositions, renderConnections } from './connections.js';
import { updateBreadcrumb } from './ui.js';
import { selectNode } from './attributes-panel.js';
import { ensureTerminalNode } from './terminal-nodes.js';

export function render() {
  // Ensure terminal node exists and is positioned before rendering
  ensureTerminalNode();
  
  // Render nodes first
  renderNodes(render, selectNode);
  
  // Calculate handle positions after DOM is rendered
  requestAnimationFrame(() => {
    calculateHandlePositions();
    renderConnections();
  });
  
  // Update UI
  updateBreadcrumb(render);
  save();
}
