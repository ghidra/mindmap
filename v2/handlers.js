import { state, save, getCurrentNodes, saveNotes, addNoteNode } from './state.js';
import { render } from './render.js';
import { renderConnections, addConnection, toggleConnection } from './connections.js';
import { createNode } from './nodes.js';
import { selectNode } from './attributes-panel.js';
import { ensureTerminalNode } from './terminal-nodes.js';
import { parserIntegration } from './ParserIntegrationModule.js';
import { switchMode, setLayoutDirection, initializeFlowMode } from './mode-manager.js';

let draggingNode = null;
window.draggingFromId = null;
window.mouseX = undefined;
window.mouseY = undefined;
let wasConnectionDragging = false; // Flag to track if we just finished connection dragging
document.body.style.userSelect = '';
let offsetX = 0, offsetY = 0;

// Note resizing
let resizingNode = null;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartX = 0;
let resizeStartY = 0;

// Canvas panning
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let spaceKeyPressed = false;

function wireEvents() {
  if (typeof startLineLoop === 'function') startLineLoop();
  const canvas = document.getElementById('canvas');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');

  // Track space key for panning (but not when typing in inputs/textareas)
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat && !isPanning) {
      // Don't intercept space if user is typing in an input or textarea
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      spaceKeyPressed = true;
      canvas.style.cursor = 'grab';
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      spaceKeyPressed = false;
      isPanning = false;
      canvas.style.cursor = '';
    }
  });

  // Right-click to create new node
  canvas.addEventListener('contextmenu', e => {
    if (e.target !== canvas) return;

    // Prevent default context menu
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const nodes = getCurrentNodes();

    // Account for pan offset when creating new nodes
    let x = e.clientX - rect.left - state.panX;
    let y = e.clientY - rect.top - state.panY;

    // In notes mode, create note nodes
    if (state.currentMode === 'notes') {
      addNoteNode(x, y);
      render();
      return;
    }

    // Keep nodes within reasonable bounds (visible area)
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const nodeWidth = 140;
    const nodeHeight = 100;

    // Clamp to visible area accounting for pan offset
    x = Math.max(20 - state.panX, Math.min(x, canvasWidth - nodeWidth - state.panX));
    y = Math.max(20 - state.panY, Math.min(y, canvasHeight - nodeHeight - state.panY));

    // Ensure terminal node exists before adding new nodes
    ensureTerminalNode();

    nodes.push(createNode(x, y));
    save();
    render();
  });

  clearBtn.onclick = () => {
    localStorage.removeItem('mindmap');
    state.nodes = [];
    state.path = [];

    // Reset to hierarchical mode
    state.currentMode = 'hierarchical';
    state.flowConfig = {
      layoutDirection: 'top-down',
      entryPoint: null,
      executionGraph: null
    };

    // Reset pan offset
    state.panX = 0;
    state.panY = 0;

    // Update UI
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    flowControls.style.display = 'none';

    render();
  };

  // Handle both node dragging and connection dragging
  canvas.addEventListener('mousedown', e => {
    const target = e.target.closest('.node');

    // Handle canvas panning (left-click on canvas, middle mouse, or space+left mouse)
    if (e.button === 1 || (e.button === 0 && e.target === canvas) || (e.button === 0 && spaceKeyPressed && e.target === canvas)) {
      isPanning = true;
      panStartX = e.clientX - state.panX;
      panStartY = e.clientY - state.panY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Handle connection dragging from any port type
    const isPort = e.target.classList.contains('handle') ||
                   e.target.classList.contains('input-port') ||
                   e.target.classList.contains('note-port');

    if (isPort) {
      window.draggingFromId = e.target.dataset.nodeId;
      window.draggingFromPort = e.target; // Store the port element
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Handle note node resizing
    if (e.target.classList.contains('resize-handle') && target) {
      const nodes = getCurrentNodes();
      resizingNode = nodes.find(n => n.id === target.dataset.id);

      if (resizingNode) {
        resizeStartWidth = resizingNode.width || 200;
        resizeStartHeight = resizingNode.height || 120;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // Handle node selection and dragging
    // Drag if clicking on header OR node background (but not buttons/inputs/textareas/handles)
    const isHeader = e.target.classList.contains('node-header') || e.target.closest('.node-header');
    const isBackground = target && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('handle');

    if (target && (isHeader || isBackground)) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const nodes = getCurrentNodes();
      draggingNode = nodes.find(n => n.id === target.dataset.id);

      if (draggingNode) {
        // Select the node for attributes panel
        selectNode(draggingNode.id);

        // Calculate offset from mouse to node position (use appropriate position based on mode)
        const nodeX = state.currentMode === 'flow' ? (draggingNode.flowX || draggingNode.x) : draggingNode.x;
        const nodeY = state.currentMode === 'flow' ? (draggingNode.flowY || draggingNode.y) : draggingNode.y;
        offsetX = mouseX - nodeX - state.panX;
        offsetY = mouseY - nodeY - state.panY;
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }
    }
  });

  document.addEventListener('mousemove', e => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;

    // Handle canvas panning
    if (isPanning) {
      state.panX = e.clientX - panStartX;
      state.panY = e.clientY - panStartY;
      render();
      return;
    }

    if (window.draggingFromId) {
      renderConnections();
      return;
    }

    // Handle note resizing
    if (resizingNode) {
      const deltaX = e.clientX - resizeStartX;
      const deltaY = e.clientY - resizeStartY;

      resizingNode.width = Math.max(100, resizeStartWidth + deltaX);
      resizingNode.height = Math.max(60, resizeStartHeight + deltaY);

      render();
      return;
    }

    if (!draggingNode) return;
    const rect = canvas.getBoundingClientRect();
    const newX = e.clientX - rect.left - offsetX - state.panX;
    const newY = e.clientY - rect.top - offsetY - state.panY;

    // Update appropriate position based on current mode
    if (state.currentMode === 'flow') {
      draggingNode.flowX = newX;
      draggingNode.flowY = newY;
    } else {
      draggingNode.x = newX;
      draggingNode.y = newY;
    }
    render();
  });

  document.addEventListener('mouseup', e => {
    // Always restore text selection
    document.body.style.userSelect = '';

    // Handle panning end
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = spaceKeyPressed ? 'grab' : '';
      save();
      return;
    }

    // Handle note resizing end
    if (resizingNode) {
      saveNotes();
      resizingNode = null;
      resizeStartWidth = 0;
      resizeStartHeight = 0;
      resizeStartX = 0;
      resizeStartY = 0;
      return;
    }

    // Handle connection dragging end
    if (window.draggingFromId) {
      const wasDragging = window.draggingFromId;
      window.draggingFromId = null;
      window.draggingFromPort = null;
      window.mouseX = undefined;
      window.mouseY = undefined;
      wasConnectionDragging = true; // Set flag to prevent node creation

      // Check if dropped on a port (not just any part of a node)
      const isTargetPort = e.target.classList.contains('handle') ||
                          e.target.classList.contains('input-port') ||
                          e.target.classList.contains('note-port');

      if (isTargetPort && e.target.dataset.nodeId) {
        const toId = e.target.dataset.nodeId;

        // Toggle connection (add if doesn't exist, remove if exists)
        if (toggleConnection(wasDragging, toId)) {
          // Save based on current mode
          if (state.currentMode === 'notes') {
            saveNotes();
          } else {
            save();
          }
        }
      }
      // If not dropped on a port, the temporary connection is just destroyed (no action needed)

      renderConnections();

      // Prevent the canvas click event from firing when connection dragging ends
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Handle node dragging end
    if (draggingNode) {
      save();
      draggingNode = null;
      offsetX = 0;
      offsetY = 0;
    }
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

  // Mode switching elements (declare early for use in other handlers)
  const hierarchicalTab = document.getElementById('hierarchical-tab');
  const flowTab = document.getElementById('flow-tab');
  const flowControls = document.getElementById('flow-controls');
  const flowLayoutSelect = document.getElementById('flow-layout-select');
  const refreshFlowBtn = document.getElementById('refresh-flow-btn');

  // Load Code button
  const loadCodeBtn = document.getElementById('loadCodeBtn');
  const codeFileInput = document.getElementById('codeFileInput');

  loadCodeBtn.onclick = () => {
    codeFileInput.click();
  };

  codeFileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      await parserIntegration.loadFromDirectory(files);

      // Update UI to show hierarchical mode
      hierarchicalTab.classList.add('active');
      flowTab.classList.remove('active');
      flowControls.style.display = 'none';
    } catch (error) {
      console.error('Error loading directory:', error);
      alert('Error loading directory: ' + error.message);
    }
  };

  hierarchicalTab.onclick = async () => {
    await switchMode('hierarchical');

    // Update tab styling
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    notesTab.classList.remove('active');

    // Hide flow controls
    flowControls.style.display = 'none';
  };

  flowTab.onclick = async () => {
    await switchMode('flow');

    // Update tab styling
    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    notesTab.classList.remove('active');

    // Show flow controls
    flowControls.style.display = 'inline-flex';
  };

  // Notes tab
  const notesTab = document.getElementById('notes-tab');

  notesTab.onclick = async () => {
    state.currentMode = 'notes';
    state.path = [];

    // Update tab styling
    notesTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    flowTab.classList.remove('active');

    // Hide flow controls
    flowControls.style.display = 'none';

    render();
  };

  // Layout direction change
  flowLayoutSelect.onchange = async (e) => {
    await setLayoutDirection(e.target.value);
  };

  // Refresh flow button
  refreshFlowBtn.onclick = async () => {
    try {
      // Clear execution graph and rebuild
      state.flowConfig.executionGraph = null;
      await initializeFlowMode();
      render();
    } catch (error) {
      console.error('Error refreshing flow:', error);
      alert('Error refreshing flow: ' + error.message);
    }
  };

  // Initialize mode on load
  if (state.currentMode === 'flow') {
    flowTab.classList.add('active');
    hierarchicalTab.classList.remove('active');
    flowControls.style.display = 'inline-flex';
    flowLayoutSelect.value = state.flowConfig.layoutDirection;
  } else {
    hierarchicalTab.classList.add('active');
    flowTab.classList.remove('active');
    flowControls.style.display = 'none';
  }

  // Dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');

  // Load dark mode preference (default to true for dark mode)
  const darkModePreference = localStorage.getItem('darkMode');
  const isDarkMode = darkModePreference === null ? true : darkModePreference === 'true';

  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    darkModeToggle.textContent = '☀️';
  } else {
    darkModeToggle.textContent = '🌙';
  }

  darkModeToggle.onclick = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDark);
  };
}

export { wireEvents };
