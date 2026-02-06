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

// Command system for undo/redo
import { commandManager } from './commands/CommandManager.js';

// Settings and theme
import { settingsPanel } from './settings/SettingsPanel.js';
import { themeManager } from './ui/ThemeManager.js';
import { shortcutHints } from './ui/ShortcutHints.js';

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

  // Render/update nodes (groups are now part of nodesToRender in flow mode)
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

  // For flow mode
  if (state.currentMode === 'flow') {
    // If no execution graph, return empty (waiting for user to enter a path)
    if (!state.flowConfig.executionGraph) {
      return [];
    }

    const allFlowNodes = state.flowConfig.executionGraph.nodes.map(gn => gn.originalNode);

    // If no path, return all non-synthetic nodes
    if (state.path.length === 0) {
      const nodes = allFlowNodes.filter(n => !n.syntheticNode);
      // Sort so groups render first (behind other nodes)
      return nodes.sort((a, b) => {
        if (a.type === 'group' && b.type !== 'group') return -1;
        if (a.type !== 'group' && b.type === 'group') return 1;
        return 0;
      });
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
  const { switchMode, initializeFlowMode, resolveNodeByPath, initializeFocusedFlowMode } = await import('./mode-manager.js');

  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const loadCodeBtn = document.getElementById('loadCodeBtn');
  const codeFileInput = document.getElementById('codeFileInput');
  const hierarchicalTab = document.getElementById('hierarchical-tab');
  const flowTab = document.getElementById('flow-tab');
  const notesTab = document.getElementById('notes-tab');
  const flowControls = document.getElementById('flow-controls');
  const clearTraceBtn = document.getElementById('clear-trace-btn');
  const flowPathInput = document.getElementById('flow-path-input');
  const flowPathGoBtn = document.getElementById('flow-path-go-btn');
  const flowBackBtn = document.getElementById('flow-back-btn');

  // Undo/Redo buttons
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  // Set up undo/redo button handlers
  undoBtn.onclick = () => {
    if (commandManager.canUndo()) {
      const description = commandManager.getUndoDescription();
      commandManager.undo();
      console.log(`↩️ Undo: ${description}`);
      renderAll();
    }
  };

  redoBtn.onclick = () => {
    if (commandManager.canRedo()) {
      const description = commandManager.getRedoDescription();
      commandManager.redo();
      console.log(`↪️ Redo: ${description}`);
      renderAll();
    }
  };

  // Set up state change callback to update button states
  commandManager.setStateChangeCallback(({ canUndo, canRedo, undoDescription, redoDescription }) => {
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;

    // Update tooltips with action descriptions
    undoBtn.title = canUndo ? `Undo: ${undoDescription} (Ctrl+Z)` : 'Nothing to undo (Ctrl+Z)';
    redoBtn.title = canRedo ? `Redo: ${redoDescription} (Ctrl+Y)` : 'Nothing to redo (Ctrl+Y)';
  });

  // Clear button
  clearBtn.onclick = () => {
    localStorage.removeItem('mindmap');
    state.nodes = [];
    state.path = [];
    state.currentMode = 'hierarchical';
    state.flowConfig = {
      layoutDirection: 'top-down',
      entryPoint: null,
      executionGraph: null,
      flowType: 'entry-point',
      tracedNode: null,
      traceDirection: 'forward',
      traceDepth: 10,
      focusedNode: null,
      navigationStack: [],
      flowGroups: []
    };
    state.panX = 0;
    state.panY = 0;
    state.viewport = { x: 0, y: 0, zoom: 1 };
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'none';
    // Clear command history when map is cleared
    commandManager.clear();
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
    // Clear flow state when leaving flow mode
    state.flowConfig.executionGraph = null;
    state.flowConfig.focusedNode = null;
    state.flowConfig.navigationStack = [];
    state.flowConfig.flowType = 'entry-point';

    await switchMode('hierarchical');
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'none';
  };

  flowTab.onclick = async () => {
    // Clear old flow state when entering flow mode fresh
    state.flowConfig.executionGraph = null;
    state.flowConfig.focusedNode = null;
    state.flowConfig.navigationStack = [];
    state.flowConfig.flowType = 'entry-point';

    // Don't call switchMode - just set the mode and show controls
    state.currentMode = 'flow';
    state.path = [];

    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'inline-flex';

    renderAll();
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

  // Flow path input handler
  flowPathGoBtn.onclick = async () => {
    const path = flowPathInput.value.trim();
    if (!path) {
      alert('Please enter a path (e.g., src/iso/scene.js or src/iso/scene.js:draw)');
      return;
    }

    if (state.nodes.length === 0) {
      alert('No project loaded. Please load a project first using "Load Code".');
      return;
    }

    const node = resolveNodeByPath(path);
    if (!node) {
      alert('Node not found: ' + path);
      return;
    }

    try {
      // Clear old flow state before initializing new focused flow
      state.flowConfig.executionGraph = null;
      state.flowConfig.navigationStack = [];

      await initializeFocusedFlowMode(node.id);

      // Ensure we're in flow mode
      state.currentMode = 'flow';
      flowTab.classList.add('active');
      hierarchicalTab.classList.remove('active');
      notesTab.classList.remove('active');
      flowControls.style.display = 'inline-flex';

      renderAll();
      updateFlowModeIndicator();
    } catch (error) {
      console.error('Error initializing focused flow:', error);
      alert('Error: ' + error.message);
    }
  };

  // Enter key in path input
  flowPathInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      flowPathGoBtn.click();
    }
  };

  // Back button handler
  flowBackBtn.onclick = async () => {
    if (!state.flowConfig.navigationStack || state.flowConfig.navigationStack.length === 0) {
      return;
    }

    const previousNode = state.flowConfig.navigationStack.pop();
    try {
      await initializeFocusedFlowMode(previousNode);
      renderAll();
      updateFlowModeIndicator();
    } catch (error) {
      console.error('Error navigating back:', error);
      alert('Error: ' + error.message);
    }
  };

  // Double-click handler for drill-down in focused flow mode
  canvas.addEventListener('dblclick', async (e) => {
    if (state.currentMode !== 'flow' || state.flowConfig.flowType !== 'focused') {
      return;
    }

    const nodeEl = e.target.closest('.node');
    if (!nodeEl) return;

    const nodeId = nodeEl.dataset.id;
    if (!nodeId || nodeId === state.flowConfig.focusedNode) {
      return; // Don't drill down to the same node
    }

    try {
      // Push current center to navigation stack
      if (!state.flowConfig.navigationStack) {
        state.flowConfig.navigationStack = [];
      }
      state.flowConfig.navigationStack.push(state.flowConfig.focusedNode);

      // Make clicked node the new center
      await initializeFocusedFlowMode(nodeId);
      renderAll();
      updateFlowModeIndicator();
    } catch (error) {
      console.error('Error drilling down:', error);
      alert('Error: ' + error.message);
    }
  });

  // Set up toolbar right buttons
  setupToolbarRightButtons();

  // Initialize mode UI
  if (state.currentMode === 'flow') {
    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    notesTab.classList.remove('active');
    flowControls.style.display = 'inline-flex';
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
    const backBtn = document.getElementById('flow-back-btn');

    if (state.currentMode !== 'flow') {
      indicator.textContent = '';
      clearBtn.style.display = 'none';
      backBtn.style.display = 'none';
      return;
    }

    const findNodeById = (nodes, id) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
        if (node.childNodes) {
          const found = findNodeById(node.childNodes, id);
          if (found) return found;
        }
      }
      return null;
    };

    // If no execution graph, show prompt
    if (!state.flowConfig.executionGraph) {
      indicator.textContent = 'Enter a file path to explore';
      clearBtn.style.display = 'none';
      backBtn.style.display = 'none';
      return;
    }

    if (state.flowConfig.flowType === 'focused') {
      const focusedNode = findNodeById(state.nodes, state.flowConfig.focusedNode);
      const nodeTitle = focusedNode ? focusedNode.title : 'Unknown';
      indicator.textContent = `Focus: ${nodeTitle}`;
      clearBtn.style.display = 'inline-block';
      // Show back button if there's navigation history
      backBtn.style.display = (state.flowConfig.navigationStack && state.flowConfig.navigationStack.length > 0)
        ? 'inline-block' : 'none';
    } else {
      indicator.textContent = '';
      clearBtn.style.display = 'none';
      backBtn.style.display = 'none';
    }
  }
}

// ============ Toolbar Right Buttons ============
function setupToolbarRightButtons() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const helpBtn = document.getElementById('help-btn');

  // Theme toggle button
  if (themeToggleBtn) {
    // Set initial icon
    const updateThemeIcon = () => {
      themeToggleBtn.textContent = themeManager.getIcon();
      themeToggleBtn.title = `Toggle theme (${themeManager.getLabel()})`;
    };

    updateThemeIcon();

    themeToggleBtn.onclick = () => {
      themeManager.toggle();
    };

    // Update icon when theme changes
    themeManager.onChange(() => {
      updateThemeIcon();
    });
  }

  // Settings button
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      settingsPanel.toggle();
    };
  }

  // Help button
  if (helpBtn) {
    helpBtn.onclick = () => {
      shortcutHints.toggle();
    };
  }
}
