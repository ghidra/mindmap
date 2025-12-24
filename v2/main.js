import { load } from './state.js';
import { render } from './render.js';
import { wireEvents } from './handlers.js';
import { initAttributesPanel, hideAttributesPanel } from './attributes-panel.js';
import { ensureTerminalNode } from './terminal-nodes.js';

// Initialize the application
load();
ensureTerminalNode(); // Ensure terminal node exists on startup
render();
wireEvents();
initAttributesPanel(render);

// Add close button event handler
document.getElementById('close-attributes').onclick = hideAttributesPanel;
