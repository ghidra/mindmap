import { state, save, getCurrentNodes } from './state.js';
import { render } from './render.js';
import { FlowAnalyzer } from './flow-analysis/flow-analyzer.js';

/**
 * Advanced Flow Layout Algorithm
 * Handles both top-down and left-right layouts with analytical spacing
 */
class FlowLayout {
  constructor(config = {}) {
    this.nodeWidth = config.nodeWidth || 140;
    this.nodeHeight = config.nodeHeight || 80;
    this.minHorizontalSpacing = config.minHorizontalSpacing || 40;
    this.minVerticalSpacing = config.minVerticalSpacing || 80;
    this.levelSpacing = config.levelSpacing || 150;
    this.startX = config.startX || 100;
    this.startY = config.startY || 100;
    this.maxWidth = config.maxWidth || 1600;
    this.direction = config.direction || 'top-down';
  }

  layout(executionGraph) {
    console.log(`Applying ${this.direction} flow layout...`);
    const nodesByDepth = this.groupByDepth(executionGraph);
    this.optimizeNodeOrder(nodesByDepth, executionGraph.edges);

    if (this.direction === 'top-down') {
      this.applyTopDownLayout(nodesByDepth);
    } else {
      this.applyLeftRightLayout(nodesByDepth);
    }

    this.applyPositions(nodesByDepth);
    console.log(`Layout complete: ${executionGraph.nodes.length} nodes positioned`);
  }

  groupByDepth(executionGraph) {
    const nodesByDepth = new Map();
    executionGraph.nodes.forEach(graphNode => {
      const depth = graphNode.depth || 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(graphNode);
    });
    return nodesByDepth;
  }

  optimizeNodeOrder(nodesByDepth, edges) {
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    const incoming = new Map();

    edges.forEach(edge => {
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to).push(edge.from);
    });

    for (let i = 1; i < depths.length; i++) {
      const nodes = nodesByDepth.get(depths[i]);
      nodes.forEach(graphNode => {
        const connectedNodes = incoming.get(graphNode.id) || [];
        if (connectedNodes.length > 0) {
          let sumX = 0, count = 0;
          connectedNodes.forEach(connectedId => {
            const connected = this.findNodeById(nodesByDepth, connectedId);
            if (connected && connected.layoutX !== undefined) {
              sumX += connected.layoutX;
              count++;
            }
          });
          graphNode.barycenter = count > 0 ? sumX / count : 0;
        } else {
          graphNode.barycenter = 0;
        }
      });
      nodes.sort((a, b) => a.barycenter - b.barycenter);
    }
  }

  applyTopDownLayout(nodesByDepth) {
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalWidth = nodes.length * this.nodeWidth + (nodes.length - 1) * this.minHorizontalSpacing;
      const levelStartX = this.startX + Math.max(0, (this.maxWidth - totalWidth) / 2);
      const y = this.startY + depth * this.levelSpacing;

      nodes.forEach((graphNode, index) => {
        graphNode.layoutX = levelStartX + index * (this.nodeWidth + this.minHorizontalSpacing);
        graphNode.layoutY = y;
      });
    });
  }

  applyLeftRightLayout(nodesByDepth) {
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalHeight = nodes.length * this.nodeHeight + (nodes.length - 1) * this.minVerticalSpacing;
      const levelStartY = this.startY + Math.max(0, (800 - totalHeight) / 2);
      const x = this.startX + depth * this.levelSpacing;

      nodes.forEach((graphNode, index) => {
        graphNode.layoutX = x;
        graphNode.layoutY = levelStartY + index * (this.nodeHeight + this.minVerticalSpacing);
      });
    });
  }

  applyPositions(nodesByDepth) {
    nodesByDepth.forEach(nodes => {
      nodes.forEach(graphNode => {
        const node = graphNode.originalNode;
        if (graphNode.layoutX !== undefined) {
          node.flowX = graphNode.layoutX;
          node.flowY = graphNode.layoutY;
          if (!node.flowMetadata) node.flowMetadata = {};
          node.flowMetadata.depth = graphNode.depth;
          node.flowMetadata.executionOrder = graphNode.executionOrder;
        }
      });
    });
  }

  findNodeById(nodesByDepth, nodeId) {
    for (const nodes of nodesByDepth.values()) {
      const found = nodes.find(n => n.id === nodeId);
      if (found) return found;
    }
    return null;
  }
}

// Store positions for each mode
const positionCache = {
  hierarchical: new Map(), // nodeId -> {x, y}
  flow: new Map(),
  notes: new Map() // nodeId -> {x, y}
};

/**
 * Switch between hierarchical and flow visualization modes
 * @param {string} newMode - 'hierarchical' or 'flow'
 */
export async function switchMode(newMode) {
  if (newMode === state.currentMode) {
    return; // Already in this mode
  }

  const oldMode = state.currentMode;

  // Save current positions before switching
  savePositions(oldMode);

  // Switch mode
  state.currentMode = newMode;

  // Reset path to root when switching modes
  state.path = [];

  // If switching to flow mode and no execution graph exists, initialize it
  if (newMode === 'flow') {
    if (!state.flowConfig.executionGraph) {
      try {
        await initializeFlowMode();
      } catch (error) {
        console.error('Failed to initialize flow mode:', error);
        alert('Failed to initialize flow mode: ' + error.message);
        // Revert to hierarchical mode
        state.currentMode = 'hierarchical';
        return;
      }
    }
  }

  // Restore positions for new mode
  restorePositions(newMode);

  // Save state and re-render
  save();
  render();
}

/**
 * Initialize flow mode by building execution graph and calculating layout
 */
export async function initializeFlowMode() {
  // Phase 2 will implement the full flow analysis
  // For now, create a placeholder that we'll fill in later

  const nodes = getCurrentNodes();

  if (nodes.length === 0) {
    throw new Error('No nodes to analyze. Please load a project first.');
  }

  // Check if entry point was already detected during project load
  if (!state.flowConfig.entryPoint) {
    // TODO Phase 2: Detect entry point from current nodes
    const entryPoint = await detectEntryPoint(nodes);

    if (!entryPoint) {
      throw new Error('Could not detect entry point. Flow mode requires an entry point (index.html or main.js).');
    }

    state.flowConfig.entryPoint = entryPoint.id;
    save();
  }

  // Build execution graph using FlowAnalyzer
  const entryNode = findNodeById(state.nodes, state.flowConfig.entryPoint);

  if (!entryNode) {
    throw new Error('Entry point node not found');
  }

  console.log('Building execution graph from:', entryNode.title);

  // Use FlowAnalyzer to trace execution flow
  const analyzer = new FlowAnalyzer();
  const executionGraph = await analyzer.analyze(entryNode, state.nodes);

  console.log('Execution graph built:', executionGraph.nodes.length, 'nodes,', executionGraph.edges.length, 'edges');

  state.flowConfig.executionGraph = executionGraph;

  // Apply analytical flow layout
  const layoutEngine = new FlowLayout({
    direction: state.flowConfig.layoutDirection,
    nodeWidth: 140,
    nodeHeight: 80,
    minHorizontalSpacing: 40,
    minVerticalSpacing: 80,
    levelSpacing: 150,
    startX: 100,
    startY: 100,
    maxWidth: 1600
  });

  layoutEngine.layout(state.flowConfig.executionGraph);
}

/**
 * Find a node by file path (e.g., "v2/main.js")
 */
function findNodeByPath(nodes, path) {
  const pathParts = path.split('/');

  function searchNodes(nodeList, parts) {
    if (parts.length === 0) return null;

    const targetName = parts[parts.length - 1];

    for (const node of nodeList) {
      // Check if this node matches the target filename
      if (node.title && node.title.toLowerCase() === targetName.toLowerCase()) {
        // If it's the last part, we found it
        if (parts.length === 1) {
          return node;
        }
        // Otherwise, verify the path matches
        // (simplified - just check filename for now)
        return node;
      }

      // Recursively search children (in-memory children)
      if (node.children && node.children.length > 0) {
        const found = searchNodes(node.children, parts);
        if (found) return found;
      }

      // Recursively search childNodes (lazy-loaded children)
      if (node.childNodes && node.childNodes.length > 0) {
        const found = searchNodes(node.childNodes, parts);
        if (found) return found;
      }
    }

    return null;
  }

  return searchNodes(nodes, pathParts);
}

/**
 * Find a node by ID in the hierarchical tree
 */
function findNodeById(nodes, nodeId) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    // Search children (in-memory children)
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, nodeId);
      if (found) {
        return found;
      }
    }
    // Search childNodes (lazy-loaded children)
    if (node.childNodes && node.childNodes.length > 0) {
      const found = findNodeById(node.childNodes, nodeId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Detect the entry point of the application
 * Prioritizes files at higher levels of the hierarchy
 */
async function detectEntryPoint(nodes) {
  const entryPointNames = [
    { name: 'index.html', priority: 1 },
    { name: 'main.js', priority: 2 },
    { name: 'app.js', priority: 3 },
    { name: 'index.js', priority: 4 }
  ];

  let bestCandidate = null;
  let bestDepth = Infinity;
  let bestPriority = Infinity;

  // Breadth-first search to prioritize files at higher levels
  const searchLevel = (nodeList, depth) => {
    for (const node of nodeList) {
      const title = node.title ? node.title.toLowerCase() : '';

      // Check if this is an entry point candidate
      for (const candidate of entryPointNames) {
        if (title === candidate.name) {
          // Prefer files at shallower depth, or higher priority if same depth
          if (depth < bestDepth || (depth === bestDepth && candidate.priority < bestPriority)) {
            bestCandidate = node;
            bestDepth = depth;
            bestPriority = candidate.priority;
          }
        }
      }
    }

    // Search children at next depth level
    for (const node of nodeList) {
      if (node.children && node.children.length > 0) {
        searchLevel(node.children, depth + 1);
      }
      if (node.childNodes && node.childNodes.length > 0) {
        searchLevel(node.childNodes, depth + 1);
      }
    }
  };

  // Start breadth-first search from root
  searchLevel(nodes, 0);

  return bestCandidate;
}

// Old applyFlowLayout function removed - now using FlowLayout class from layouts/flow-layout.js

/**
 * Save current node positions to cache
 */
function savePositions(mode) {
  // Get nodes based on mode
  const nodes = mode === 'notes' ? state.notesData.nodes : state.nodes;
  const cache = positionCache[mode];

  if (!cache) return; // Safety check

  function saveNodePositions(nodeList) {
    nodeList.forEach(node => {
      if (mode === 'hierarchical' || mode === 'notes') {
        cache.set(node.id, { x: node.x, y: node.y });
      } else {
        cache.set(node.id, { x: node.flowX, y: node.flowY });
      }

      // Recursively save children positions
      if (node.children && node.children.length > 0) {
        saveNodePositions(node.children);
      }
    });
  }

  saveNodePositions(nodes);
}

/**
 * Restore node positions from cache
 */
function restorePositions(mode) {
  // Get nodes based on mode
  const nodes = mode === 'notes' ? state.notesData.nodes : state.nodes;
  const cache = positionCache[mode];

  if (!cache) return; // Safety check

  function restoreNodePositions(nodeList) {
    nodeList.forEach(node => {
      const cached = cache.get(node.id);
      if (cached) {
        if (mode === 'hierarchical' || mode === 'notes') {
          node.x = cached.x;
          node.y = cached.y;
        } else {
          node.flowX = cached.x;
          node.flowY = cached.y;
        }
      } else {
        // Initialize positions if not cached
        if (mode === 'flow' && (node.flowX === undefined || node.flowY === undefined)) {
          node.flowX = node.x;
          node.flowY = node.y;
        }
      }

      // Recursively restore children positions
      if (node.children && node.children.length > 0) {
        restoreNodePositions(node.children);
      }
    });
  }

  restoreNodePositions(nodes);
}

/**
 * Get the current layout direction
 */
export function getLayoutDirection() {
  return state.flowConfig.layoutDirection;
}

/**
 * Set the layout direction and re-layout
 */
export async function setLayoutDirection(direction) {
  if (direction !== 'top-down' && direction !== 'left-right') {
    throw new Error('Invalid layout direction: ' + direction);
  }

  state.flowConfig.layoutDirection = direction;

  // Re-apply layout if in flow mode
  if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
    const layoutEngine = new FlowLayout({
      direction: direction,
      nodeWidth: 140,
      nodeHeight: 80,
      minHorizontalSpacing: 40,
      minVerticalSpacing: 80,
      levelSpacing: 150,
      startX: 100,
      startY: 100,
      maxWidth: 1600
    });

    layoutEngine.layout(state.flowConfig.executionGraph);
    save();
    render();
  }
}
