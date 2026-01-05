// Application state management
export const state = {
  nodes: [],
  path: [],
  currentMode: 'hierarchical', // 'hierarchical' | 'flow' | 'notes'
  flowConfig: {
    layoutDirection: 'top-down', // 'top-down' | 'left-right'
    entryPoint: null,
    executionGraph: null // cached execution flow graph
  },
  // Notes mode - separate sketch pad for planning
  notesData: {
    nodes: [],
    connections: []
  },
  // Canvas panning
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