import { load, state, save } from './state.js';
import { ensureTerminalNode } from './terminal-nodes.js';

// Import new modular framework
import { registerCoreNodeTypes } from './node-types/registerCoreTypes.js';
import { nodeRenderer } from './core/NodeRenderer.js';
import { connectionSystem } from './core/ConnectionSystem.js';
import { eventManager } from './core/EventManager.js';
import { simpleNodeMenu } from './ui/SimpleNodeMenu.js';
import { detailsPanel } from './ui/DetailsPanel.js';
import { keyboardShortcuts } from './core/KeyboardShortcuts.js';
import { minimap } from './ui/Minimap.js';

// Import legacy systems for backward compatibility during transition
import { updateBreadcrumb } from './ui.js';

// Register all core node types
registerCoreNodeTypes();

// Initialize the application
load();

// Sync viewport with legacy pan values
if (state.panX !== undefined || state.panY !== undefined) {
  state.viewport.x = state.panX || 0;
  state.viewport.y = state.panY || 0;
}

ensureTerminalNode(); // Ensure terminal node exists on startup

// Get DOM elements
const canvas = document.getElementById('canvas');
const svg = document.getElementById('connections');

// Initialize new modular systems
eventManager.init(canvas);
connectionSystem.init(svg);
simpleNodeMenu.init();
detailsPanel.init();
keyboardShortcuts.init();
minimap.init();

// Set up render callback for the new event manager
eventManager.setRenderCallback(() => {
  renderNodes();
  connectionSystem.renderConnections();
  updateBreadcrumb(renderAll);
  minimap.render(); // Update minimap on render
});

// Set up save callback
eventManager.setSaveCallback(() => {
  save();
});

// Set up node creator callback
eventManager.setNodeCreatorCallback((x, y) => {
  // Convert canvas coordinates to screen coordinates for menu positioning
  const rect = canvas.getBoundingClientRect();
  const screenX = rect.left + x + state.viewport.x;
  const screenY = rect.top + y + state.viewport.y;

  simpleNodeMenu.show(screenX, screenY, (node) => {
    // Node is already added to state by simpleNodeMenu
    renderAll();
  });
});

// Set up node selected callback for details panel
eventManager.setNodeSelectedCallback((nodeId) => {
  detailsPanel.show(nodeId);
});

// Set up render callback for details panel (for live updates)
detailsPanel.setRenderCallback(() => {
  renderAll();
});

// Set up minimap pan callback
minimap.setPanChangedCallback(() => {
  renderAll();
});

// New render function using modular framework
function renderNodes() {
  // Get current nodes based on mode
  const nodesToRender = getCurrentNodesForMode();

  // Get existing node IDs in the canvas
  const existingNodeIds = new Set(
    Array.from(canvas.querySelectorAll('.node')).map(el => el.dataset.id)
  );

  // Get IDs of nodes that should be rendered
  const shouldRenderIds = new Set(nodesToRender.map(n => n.id));

  // Remove nodes that shouldn't be there anymore
  existingNodeIds.forEach(id => {
    if (!shouldRenderIds.has(id)) {
      const el = canvas.querySelector(`[data-id="${id}"]`);
      if (el) el.remove();
    }
  });

  // Render/update nodes
  nodesToRender.forEach(node => {
    nodeRenderer.render(node, canvas);
  });
}

// Render both nodes and connections
function renderAll() {
  renderNodes();
  connectionSystem.renderConnections();
  updateBreadcrumb(renderAll);
  minimap.render();
  save();
}

// Helper function to get nodes based on current mode
function getCurrentNodesForMode() {
  // For notes mode, return notes nodes
  if (state.currentMode === 'notes') {
    return state.notesData.nodes;
  }

  // For flow mode with execution graph
  if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
    const allFlowNodes = state.flowConfig.executionGraph.nodes.map(gn => gn.originalNode);

    // If no path, return all non-synthetic nodes
    if (state.path.length === 0) {
      return allFlowNodes.filter(n => !n.syntheticNode);
    }

    // Navigate through path
    const lastId = state.path[state.path.length - 1];
    const currentNode = allFlowNodes.find(n => n.id === lastId);

    if (currentNode && currentNode.children && currentNode.children.length > 0) {
      return currentNode.children;
    }

    return allFlowNodes.filter(n => !n.syntheticNode);
  }

  // For hierarchical mode, navigate through path
  return state.path.reduce(
    (a, id) => a.find(n => n.id === id)?.children ?? a,
    state.nodes
  );
}

// Set up UI button handlers (not canvas handlers - EventManager handles those)
setupUIHandlers();

// Initial render
renderAll();

// ============ UI Button Handlers ============
async function setupUIHandlers() {
  const { parserIntegration } = await import('./ParserIntegrationModule.js');
  const { switchMode, setLayoutDirection, initializeFlowMode } = await import('./mode-manager.js');

  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const loadCodeBtn = document.getElementById('loadCodeBtn');
  const codeFileInput = document.getElementById('codeFileInput');
  const hierarchicalTab = document.getElementById('hierarchical-tab');
  const flowTab = document.getElementById('flow-tab');
  const notesTab = document.getElementById('notes-tab');
  const flowControls = document.getElementById('flow-controls');
  const flowLayoutSelect = document.getElementById('flow-layout-select');
  const refreshFlowBtn = document.getElementById('refresh-flow-btn');
  const clearTraceBtn = document.getElementById('clear-trace-btn');

  // Clear button
  clearBtn.onclick = () => {
    localStorage.removeItem('mindmap');
    state.nodes = [];
    state.path = [];
    state.currentMode = 'hierarchical';
    state.flowConfig = {
      layoutDirection: 'top-down',
      entryPoint: null,
      executionGraph: null
    };
    state.panX = 0;
    state.panY = 0;
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'none';
    renderAll();
  };

  // Export button
  exportBtn.onclick = () => {
    const data = localStorage.getItem('mindmap');
    if (!data) {
      alert('No map to export');
      return;
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import
  importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        localStorage.setItem('mindmap', evt.target.result);
        location.reload();
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  // Load Code button
  loadCodeBtn.onclick = () => {
    codeFileInput.click();
  };

  codeFileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      await parserIntegration.loadFromDirectory(files);
      hierarchicalTab.classList.add('active');
      flowTab.classList.remove('active');
      notesTab.classList.remove('active');
      flowControls.style.display = 'none';
    } catch (error) {
      console.error('Error loading directory:', error);
      alert('Error loading directory: ' + error.message);
    }
  };

  // Mode tabs
  hierarchicalTab.onclick = async () => {
    await switchMode('hierarchical');
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'none';
  };

  flowTab.onclick = async () => {
    await switchMode('flow');
    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'inline-flex';
    updateFlowModeIndicator();
  };

  notesTab.onclick = async () => {
    state.currentMode = 'notes';
    state.path = [];
    notesTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    flowTab.classList.remove('active');
    flowControls.style.display = 'none';
    renderAll();
  };

  // Flow controls
  flowLayoutSelect.onchange = async (e) => {
    await setLayoutDirection(e.target.value);
  };

  refreshFlowBtn.onclick = async () => {
    try {
      state.flowConfig.executionGraph = null;
      await initializeFlowMode();
      renderAll();
      updateFlowModeIndicator();
    } catch (error) {
      console.error('Error refreshing flow:', error);
      alert('Error refreshing flow: ' + error.message);
    }
  };

  clearTraceBtn.onclick = async () => {
    try {
      const { clearNodeTrace } = await import('./mode-manager.js');
      await clearNodeTrace();
      renderAll();
      updateFlowModeIndicator();
    } catch (error) {
      console.error('Error clearing trace:', error);
      alert('Error clearing trace: ' + error.message);
    }
  };

  // Always enable dark mode
  document.body.classList.add('dark-mode');

  // Initialize mode UI
  if (state.currentMode === 'flow') {
    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'inline-flex';
    flowLayoutSelect.value = state.flowConfig.layoutDirection;
  } else if (state.currentMode === 'notes') {
    notesTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    flowTab.classList.remove('active');
    flowControls.style.display = 'none';
  } else {
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'none';
  }

  function updateFlowModeIndicator() {
    const indicator = document.getElementById('flow-mode-indicator');
    const clearBtn = document.getElementById('clear-trace-btn');

    if (state.currentMode !== 'flow') {
      indicator.textContent = '';
      clearBtn.style.display = 'none';
      return;
    }

    if (state.flowConfig.flowType === 'entry-point') {
      indicator.textContent = 'Entry Point Flow';
      clearBtn.style.display = 'none';
    } else if (state.flowConfig.flowType === 'node-trace') {
      const findNodeById = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const tracedNode = findNodeById(state.nodes, state.flowConfig.tracedNode);
      const nodeTitle = tracedNode ? tracedNode.title : 'Unknown';
      indicator.textContent = `Tracing: ${nodeTitle}`;
      clearBtn.style.display = 'inline-block';
    }
  }
}
