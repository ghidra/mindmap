import { state, save, getCurrentNodes } from './state.js';
import { nodeRenderer } from './core/NodeRenderer.js';
import { connectionSystem } from './core/ConnectionSystem.js';
import { updateBreadcrumb } from './ui.js';
import { ensureTerminalNode } from './terminal-nodes.js';

/**
 * Legacy render function - now uses new modular framework
 * This is called by mode-manager.js and ParserIntegrationModule.js
 */
export function render() {
  // Ensure terminal node exists and is positioned before rendering
  ensureTerminalNode();

  // Get canvas element
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Clear canvas and renderer cache
  nodeRenderer.clearAll();
  canvas.innerHTML = '';

  // Get nodes to render based on current mode
  const nodesToRender = getCurrentNodes();

  // Render using new modular framework
  nodesToRender.forEach(node => {
    nodeRenderer.render(node, canvas);
  });

  // Render connections (ensure state.connections exists)
  requestAnimationFrame(() => {
    if (!Array.isArray(state.connections)) {
      state.connections = [];
    }
    connectionSystem.renderConnections();
  });

  // Update UI
  updateBreadcrumb(render);
  save();
}
