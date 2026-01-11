// Application state management - Modular node framework
export const state = {
  // Core data (mode-agnostic)
  nodes: [],              // All nodes (flat array, hierarchy stored in node.children)
  connections: [],        // All connections (separate from nodes)
  selectedNodes: [],      // Multi-select support
  groups: [],             // Group metadata

  // Viewport state
  viewport: {
    x: 0,                 // Pan X
    y: 0,                 // Pan Y
    zoom: 1               // Zoom level (1 = 100%)
  },

  // Legacy support (will be removed in Phase 8)
  path: [],
  currentMode: 'hierarchical', // 'hierarchical' | 'flow' | 'notes'

  // Parsing configuration (legacy - to be integrated with node types)
  parsingConfig: {
    maxDepth: 6,
    enableASTParsing: true,
    astCache: new Map()
  },

  flowConfig: {
    layoutDirection: 'top-down',
    entryPoint: null,
    executionGraph: null,
    flowType: 'entry-point',
    tracedNode: null,
    traceDirection: 'forward',
    traceDepth: 10
  },

  // Notes mode (legacy - notes will become regular node types)
  notesData: {
    nodes: [],
    connections: []
  },

  // Legacy pan offset (replaced by viewport)
  panX: 0,
  panY: 0
};

export function save() {
  // Custom replacer to exclude non-serializable properties
  const replacer = (key, value) => {
    // Exclude fileObject (File object can't be serialized - we store fileContent instead)
    // Exclude parent (creates circular reference, use parentId instead)
    if (key === 'fileObject' || key === 'parent') {
      return undefined;
    }
    return value;
  };

  // Serialize execution graph nodes with their original node references
  let serializedExecutionGraph = null;
  if (state.flowConfig.executionGraph) {
    serializedExecutionGraph = {
      nodes: state.flowConfig.executionGraph.nodes.map(gn => ({
        id: gn.id,
        depth: gn.depth,
        executionOrder: gn.executionOrder,
        structure: gn.structure
        // originalNode will be restored by ID reference
      })),
      edges: state.flowConfig.executionGraph.edges
    };
  }

  const saveData = {
    nodes: state.nodes,
    currentMode: state.currentMode,
    flowConfig: {
      layoutDirection: state.flowConfig.layoutDirection,
      entryPoint: state.flowConfig.entryPoint,
      executionGraph: serializedExecutionGraph
    },
    panX: state.panX,
    panY: state.panY,
    savedAt: new Date().toISOString() // Timestamp for future DIFF functionality
  };

  localStorage.setItem('mindmap', JSON.stringify(saveData, replacer));
}

// Separate save/load for notes mode (for stability during development)
export function saveNotes() {
  const notesData = {
    nodes: state.notesData.nodes,
    connections: state.notesData.connections,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('mindmap-notes', JSON.stringify(notesData));
  console.log('Notes saved:', notesData.nodes.length, 'nodes');
}

export function loadNotes() {
  const saved = localStorage.getItem('mindmap-notes');
  if (saved) {
    try {
      const notesData = JSON.parse(saved);
      state.notesData.nodes = notesData.nodes || [];
      state.notesData.connections = notesData.connections || [];
      console.log('Notes loaded:', state.notesData.nodes.length, 'nodes from', notesData.savedAt);
    } catch (e) {
      console.error('Failed to load notes:', e);
      state.notesData = { nodes: [], connections: [] };
    }
  }
}

export function load() {
  const saved = localStorage.getItem('mindmap');
  if (saved) {
    try {
      const saveData = JSON.parse(saved);

      // Handle legacy format (just nodes array)
      if (Array.isArray(saveData)) {
        state.nodes = saveData;
        state.currentMode = 'hierarchical';
        state.flowConfig = {
          layoutDirection: 'top-down',
          entryPoint: null,
          executionGraph: null
        };
      } else {
        // New format with mode and config
        state.nodes = saveData.nodes || [];
        state.currentMode = saveData.currentMode || 'hierarchical';
        state.panX = saveData.panX || 0;
        state.panY = saveData.panY || 0;

        // Restore execution graph if it was saved
        let restoredExecutionGraph = null;
        if (saveData.flowConfig?.executionGraph) {
          // Reconstruct execution graph by reconnecting node references
          restoredExecutionGraph = {
            nodes: saveData.flowConfig.executionGraph.nodes.map(gn => ({
              id: gn.id,
              depth: gn.depth,
              executionOrder: gn.executionOrder,
              structure: gn.structure,
              originalNode: findNodeById(state.nodes, gn.id)
            })),
            edges: saveData.flowConfig.executionGraph.edges
          };
        }

        state.flowConfig = {
          layoutDirection: saveData.flowConfig?.layoutDirection || 'top-down',
          entryPoint: saveData.flowConfig?.entryPoint || null,
          executionGraph: restoredExecutionGraph
        };

        console.log('Loaded state from:', saveData.savedAt || 'unknown time');
        if (restoredExecutionGraph) {
          console.log(`Restored execution graph: ${restoredExecutionGraph.nodes.length} nodes, ${restoredExecutionGraph.edges.length} edges`);
        }

        // Also load notes data
        loadNotes();
      }
    } catch (e) {
      console.error('Failed to load saved mindmap:', e);
      state.nodes = [];
      state.currentMode = 'hierarchical';
      state.flowConfig = {
        layoutDirection: 'top-down',
        entryPoint: null,
        executionGraph: null
      };
    }
  }
}

// Helper function to find a node by ID in the hierarchical tree
function findNodeById(nodes, nodeId) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    // Search children
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
    // Search childNodes (lazy-loaded children)
    if (node.childNodes && node.childNodes.length > 0) {
      const found = findNodeById(node.childNodes, nodeId);
      if (found) return found;
    }
  }
  return null;
}

export function getCurrentNodes() {
  // In notes mode, return notes nodes (no hierarchy, flat list)
  if (state.currentMode === 'notes') {
    return state.notesData.nodes;
  }

  // In flow mode, navigate through execution graph with path support
  if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
    const allFlowNodes = state.flowConfig.executionGraph.nodes.map(gn => gn.originalNode);

    // If no path, return all non-synthetic nodes (real files)
    // Synthetic nodes (functions, classes, methods) are only shown when examining their parent
    if (state.path.length === 0) {
      return allFlowNodes.filter(n => !n.syntheticNode);
    }

    // Navigate through path - show children of the current node
    const lastId = state.path[state.path.length - 1];
    const currentNode = allFlowNodes.find(n => n.id === lastId);

    if (currentNode && currentNode.children && currentNode.children.length > 0) {
      return currentNode.children;
    }

    // Fallback to all nodes if navigation fails
    return allFlowNodes.filter(n => !n.syntheticNode);
  }

  // In hierarchical mode, navigate through path
  return state.path.reduce(
    (a, id) => a.find(n => n.id === id)?.children ?? a,
    state.nodes
  );
}

// ============ Notes Mode Functions ============

/**
 * Create a new note node with enhanced properties
 */
export function createNoteNode(x, y) {
  return {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
    type: 'note', // Node type
    x,
    y,
    title: 'New Note',
    description: '', // Multiline text field
    showDescription: false, // Toggle for description visibility
    titleFontSize: 14, // Title font size
    descriptionFontSize: 14, // Description font size
    titleColor: '#000000', // Title text color
    descriptionColor: '#000000', // Description text color
    width: 200, // Resizable width
    height: 120, // Resizable height
    color: '#ffffff',
    connections: [],
    children: [], // Notes can have children too
    attributes: [],
    isNote: true // Mark as note node (for backwards compatibility)
  };
}

/**
 * Add a note node to the notes data
 */
export function addNoteNode(x, y) {
  const node = createNoteNode(x, y);
  state.notesData.nodes.push(node);
  saveNotes();
  return node;
}

/**
 * Delete a note node
 */
export function deleteNoteNode(nodeId) {
  const index = state.notesData.nodes.findIndex(n => n.id === nodeId);
  if (index !== -1) {
    state.notesData.nodes.splice(index, 1);

    // Remove connections to this node
    state.notesData.connections = state.notesData.connections.filter(
      conn => conn.from !== nodeId && conn.to !== nodeId
    );

    saveNotes();
    return true;
  }
  return false;
}

/**
 * Update note node description
 */
export function updateNoteDescription(nodeId, description) {
  const node = state.notesData.nodes.find(n => n.id === nodeId);
  if (node) {
    node.description = description;
    saveNotes();
  }
}

/**
 * Update note node font size
 */
export function updateNoteFontSize(nodeId, fontSize) {
  const node = state.notesData.nodes.find(n => n.id === nodeId);
  if (node) {
    node.fontSize = parseInt(fontSize) || 14;
    saveNotes();
  }
}

/**
 * Update note node size
 */
export function updateNoteSize(nodeId, width, height) {
  const node = state.notesData.nodes.find(n => n.id === nodeId);
  if (node) {
    node.width = Math.max(100, width); // Minimum 100px
    node.height = Math.max(60, height); // Minimum 60px
    saveNotes();
  }
}

// ============ Modular Framework Functions ============

/**
 * Add a node to the state (respects current mode and path context)
 * @param {Object} node - Node to add
 */
export function addNode(node) {
  // In notes mode, add to notes data
  if (state.currentMode === 'notes') {
    if (!state.notesData.nodes) {
      state.notesData.nodes = [];
    }
    state.notesData.nodes.push(node);
    return;
  }

  // If we're inside a node (path has items), add as child of current context
  if (state.path.length > 0) {
    const parentId = state.path[state.path.length - 1];
    const parentNode = findNode(parentId);
    if (parentNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      node.parentId = parentId;
      node.parent = parentNode;
      parentNode.children.push(node);
      return;
    }
  }
  // Otherwise add to root
  state.nodes.push(node);
}

/**
 * Remove a node from the state
 * @param {string} nodeId - Node ID to remove
 * @returns {boolean} Whether node was removed
 */
export function removeNode(nodeId) {
  const index = state.nodes.findIndex(n => n.id === nodeId);
  if (index !== -1) {
    state.nodes.splice(index, 1);
    // Also remove any connections involving this node
    state.connections = state.connections.filter(
      conn => conn.from.nodeId !== nodeId && conn.to.nodeId !== nodeId
    );
    return true;
  }
  return false;
}

/**
 * Find a node by ID (searches recursively through children)
 * Also searches notes data when in notes mode
 * @param {string} nodeId - Node ID
 * @returns {Object|null} Node or null
 */
export function findNode(nodeId) {
  function searchNodes(nodes) {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.children) {
        const found = searchNodes(node.children);
        if (found) return found;
      }
    }
    return null;
  }

  // Search main nodes first
  const found = searchNodes(state.nodes);
  if (found) return found;

  // Also search notes data (for notes mode)
  if (state.notesData?.nodes) {
    const noteNode = state.notesData.nodes.find(n => n.id === nodeId);
    if (noteNode) return noteNode;
  }

  return null;
}

/**
 * Add a connection
 * @param {Object} connection - Connection object
 */
export function addConnection(connection) {
  // Check if connection already exists
  const exists = state.connections.some(
    c => c.from.nodeId === connection.from.nodeId &&
         c.from.portId === connection.from.portId &&
         c.to.nodeId === connection.to.nodeId &&
         c.to.portId === connection.to.portId
  );

  if (!exists) {
    state.connections.push(connection);
  }
}

/**
 * Remove a connection
 * @param {string} connectionId - Connection ID
 * @returns {boolean} Whether connection was removed
 */
export function removeConnection(connectionId) {
  const index = state.connections.findIndex(c => c.id === connectionId);
  if (index !== -1) {
    state.connections.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get connections for a specific node
 * @param {string} nodeId - Node ID
 * @returns {Array} Array of connections
 */
export function getNodeConnections(nodeId) {
  return state.connections.filter(
    c => c.from.nodeId === nodeId || c.to.nodeId === nodeId
  );
}

/**
 * Select a node
 * @param {string} nodeId - Node ID
 * @param {boolean} multiSelect - Whether to add to selection or replace
 */
export function selectNode(nodeId, multiSelect = false) {
  if (multiSelect) {
    if (!state.selectedNodes.includes(nodeId)) {
      state.selectedNodes.push(nodeId);
    }
  } else {
    state.selectedNodes = [nodeId];
  }
}

/**
 * Deselect a node
 * @param {string} nodeId - Node ID
 */
export function deselectNode(nodeId) {
  const index = state.selectedNodes.indexOf(nodeId);
  if (index !== -1) {
    state.selectedNodes.splice(index, 1);
  }
}

/**
 * Clear all selections
 */
export function clearSelection() {
  state.selectedNodes = [];
}

/**
 * Check if a node is selected
 * @param {string} nodeId - Node ID
 * @returns {boolean}
 */
export function isNodeSelected(nodeId) {
  return state.selectedNodes.includes(nodeId);
}

/**
 * Add a group
 * @param {Object} group - Group object
 */
export function addGroup(group) {
  state.groups.push(group);
}

/**
 * Remove a group
 * @param {string} groupId - Group ID
 * @returns {boolean} Whether group was removed
 */
export function removeGroup(groupId) {
  const index = state.groups.findIndex(g => g.id === groupId);
  if (index !== -1) {
    state.groups.splice(index, 1);
    // Also clear group references in nodes
    state.nodes.forEach(node => {
      if (node.containedIn === groupId) {
        node.containedIn = null;
      }
    });
    return true;
  }
  return false;
}

/**
 * Find a group by ID
 * @param {string} groupId - Group ID
 * @returns {Object|null} Group or null
 */
export function findGroup(groupId) {
  return state.groups.find(g => g.id === groupId) || null;
}

/**
 * Get all nodes in a group
 * @param {string} groupId - Group ID
 * @returns {Array} Array of nodes
 */
export function getGroupNodes(groupId) {
  return state.nodes.filter(n => n.containedIn === groupId);
} 