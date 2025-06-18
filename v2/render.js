import { state, save } from './state.js';
import { renderNodes } from './nodes.js';
import { calculateHandlePositions, renderConnections } from './connections.js';
import { updateBreadcrumb } from './ui.js';
import { selectNode } from './attributes-panel.js';

export function render() {
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
