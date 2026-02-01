import { state, save, getCurrentNodes } from './state.js';
import { render } from './render.js';
import { FlowAnalyzer } from './flow-analysis/flow-analyzer.js';
import { NodeFlowTracer } from './flow-analysis/node-tracer.js';

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

  // If switching to flow mode
  if (newMode === 'flow') {
    // If there's a focused node set, reinitialize focused mode
    // Otherwise, initialize entry-point flow if no graph exists
    if (state.flowConfig.focusedNode && state.flowConfig.flowType === 'focused') {
      try {
        await initializeFocusedFlowMode(state.flowConfig.focusedNode);
      } catch (error) {
        console.error('Failed to initialize focused flow mode:', error);
        // Fall back to entry-point mode
        state.flowConfig.focusedNode = null;
        state.flowConfig.flowType = 'entry-point';
      }
    } else if (!state.flowConfig.executionGraph) {
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
 * Initialize node-specific flow mode (trace from selected node)
 * @param {string} nodeId - ID of node to trace from
 * @param {string} direction - 'forward', 'backward', or 'both'
 */
export async function initializeNodeFlowMode(nodeId, direction = 'forward') {
  console.log(`Initializing node flow mode for ${nodeId} (direction: ${direction})`);

  try {
    // Create NodeFlowTracer
    const tracer = new NodeFlowTracer();

    // Trace from the selected node
    const executionGraph = await tracer.traceFromNode(
      nodeId,
      direction,
      state.flowConfig.traceDepth
    );

    // Update flow config
    state.flowConfig.executionGraph = executionGraph;
    state.flowConfig.flowType = 'node-trace';
    state.flowConfig.tracedNode = nodeId;
    state.flowConfig.traceDirection = direction;

    // Apply layout to traced graph
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

    save();

    console.log(`Node flow mode initialized: ${executionGraph.nodes.length} nodes in trace`);

  } catch (error) {
    console.error('Failed to initialize node flow mode:', error);
    throw error;
  }
}

/**
 * Clear node trace and return to entry-point flow mode
 */
export async function clearNodeTrace() {
  console.log('Clearing node trace, returning to entry-point flow');

  state.flowConfig.flowType = 'entry-point';
  state.flowConfig.tracedNode = null;
  state.flowConfig.traceDirection = 'forward';
  state.flowConfig.focusedNode = null;
  state.flowConfig.navigationStack = [];

  // Rebuild entry-point flow
  await initializeFlowMode();

  save();
}

/**
 * Resolve a path string like "src/iso/scene.js:draw" to a node
 * Format: "path/to/file.js" for files, "path/to/file.js:symbolName" for functions/classes
 * @param {string} pathStr - The path string to resolve
 * @returns {Object|null} The resolved node or null
 */
export function resolveNodeByPath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') return null;

  // Split on ":" to separate file path from symbol name
  const colonIndex = pathStr.lastIndexOf(':');
  let filePath, symbolName;

  if (colonIndex > 0 && colonIndex < pathStr.length - 1) {
    filePath = pathStr.substring(0, colonIndex);
    symbolName = pathStr.substring(colonIndex + 1);
  } else {
    filePath = pathStr;
    symbolName = null;
  }

  // Normalize path - remove leading ./ or /
  filePath = filePath.replace(/^\.?\//, '');
  const pathParts = filePath.split('/');

  // Search through the node hierarchy
  function searchNodes(nodeList, depth = 0) {
    for (const node of nodeList) {
      const nodeTitle = node.title ? node.title.toLowerCase() : '';
      const targetPart = pathParts[depth] ? pathParts[depth].toLowerCase() : '';

      // Check if this node matches the current path part
      if (nodeTitle === targetPart || nodeTitle.includes(targetPart)) {
        // If this is the last path part (the file)
        if (depth === pathParts.length - 1) {
          // If no symbol specified, return the file node
          if (!symbolName) {
            return node;
          }

          // Otherwise, search children for the symbol
          const symbolLower = symbolName.toLowerCase();
          const children = node.children || node.childNodes || [];

          for (const child of children) {
            const childTitle = child.title ? child.title.toLowerCase() : '';
            const childName = child.metadata?.name?.toLowerCase() ||
                             child.attributes?.name?.toLowerCase() || '';

            if (childTitle === symbolLower ||
                childTitle.includes(symbolLower) ||
                childName === symbolLower) {
              return child;
            }
          }

          // Symbol not found in children, return the file
          console.log(`Symbol "${symbolName}" not found in ${node.title}, returning file node`);
          return node;
        }

        // Continue searching in children
        const children = node.children || node.childNodes || [];
        if (children.length > 0) {
          const found = searchNodes(children, depth + 1);
          if (found) return found;
        }
      }

      // Also search children even if current node doesn't match (for flexible matching)
      const children = node.children || node.childNodes || [];
      if (children.length > 0) {
        const found = searchNodes(children, depth);
        if (found) return found;
      }
    }

    return null;
  }

  const result = searchNodes(state.nodes);

  if (!result) {
    console.log(`Node not found for path: ${pathStr}`);
  } else {
    console.log(`Resolved path "${pathStr}" to node: ${result.title} (${result.type})`);
  }

  return result;
}

/**
 * Initialize focused flow mode - single-layer graph centered on a specific node
 * Finds code references: what this node uses (outgoing→right) and what uses it (incoming→left)
 * @param {string} nodeId - ID of the center node
 */
export async function initializeFocusedFlowMode(nodeId) {
  console.log(`Initializing focused flow mode for node: ${nodeId}`);

  const centerNode = findNodeById(state.nodes, nodeId);
  if (!centerNode) {
    throw new Error(`Node ${nodeId} not found`);
  }

  // Flatten all nodes for searching
  const allNodes = flattenNodeTree(state.nodes);
  const allFileNodes = allNodes.filter(n => n.type === 'file');

  // Find connections based on code references
  const incomingNodes = []; // Nodes that reference the center (goes LEFT)
  const outgoingNodes = []; // Nodes that center references (goes RIGHT)
  const edges = [];
  const addedIncoming = new Set();
  const addedOutgoing = new Set();

  // Get names to search for from the center node
  const centerNames = getCenterNodeNames(centerNode);
  console.log(`Center node: ${centerNode.title}, searching for references to:`, centerNames);

  // Read center file content to find what it references (outgoing)
  let centerContent = await getFileContent(centerNode);

  if (centerContent) {
    // Find what this file references
    for (const fileNode of allFileNodes) {
      if (fileNode.id === centerNode.id) continue;

      const fileNames = getFileExportedNames(fileNode);
      for (const name of fileNames) {
        // Check if center content references this name
        if (contentReferencesName(centerContent, name)) {
          if (!addedOutgoing.has(fileNode.id)) {
            addedOutgoing.add(fileNode.id);
            outgoingNodes.push(fileNode);
            edges.push({
              from: centerNode.id,
              to: fileNode.id,
              type: 'references',
              label: name
            });
          }
        }
      }
    }
  }

  // Search all files to find which ones reference the center node (incoming)
  for (const fileNode of allFileNodes) {
    if (fileNode.id === centerNode.id) continue;

    const fileContent = await getFileContent(fileNode);
    if (!fileContent) continue;

    // Check if this file references any of the center's names
    for (const name of centerNames) {
      if (contentReferencesName(fileContent, name)) {
        if (!addedIncoming.has(fileNode.id)) {
          addedIncoming.add(fileNode.id);
          incomingNodes.push(fileNode);
          edges.push({
            from: fileNode.id,
            to: centerNode.id,
            type: 'references',
            label: name
          });
        }
        break; // One match is enough
      }
    }
  }

  // Mark directions on nodes
  centerNode.flowDirection = 'center';
  incomingNodes.forEach(n => { n.flowDirection = 'incoming'; });
  outgoingNodes.forEach(n => { n.flowDirection = 'outgoing'; });

  // Group nodes by directory path
  const incomingGroups = groupNodesByPath(incomingNodes);
  const outgoingGroups = groupNodesByPath(outgoingNodes);

  // Build execution graph
  const nodeMap = new Map();

  // Add center node
  nodeMap.set(centerNode.id, {
    id: centerNode.id,
    originalNode: centerNode,
    depth: 0,
    executionOrder: 0,
    structure: null
  });

  // Add incoming nodes
  incomingNodes.forEach((node, idx) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, {
        id: node.id,
        originalNode: node,
        depth: 1,
        executionOrder: idx + 1,
        structure: null
      });
    }
  });

  // Add outgoing nodes
  outgoingNodes.forEach((node, idx) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, {
        id: node.id,
        originalNode: node,
        depth: 1,
        executionOrder: incomingNodes.length + idx + 1,
        structure: null
      });
    }
  });

  const executionGraph = {
    nodes: Array.from(nodeMap.values()),
    edges: edges
  };

  console.log(`Focused flow graph: ${executionGraph.nodes.length} nodes (${incomingNodes.length} incoming←, ${outgoingNodes.length} →outgoing), ${edges.length} edges`);

  // Create flow groups and add them to the graph
  const flowGroups = createFlowGroups(incomingGroups, outgoingGroups, executionGraph);

  // Apply horizontal layout: LEFT (incoming) - CENTER - RIGHT (outgoing)
  applyHorizontalFlowLayout(executionGraph, incomingNodes, outgoingNodes, incomingGroups, outgoingGroups, flowGroups);

  // Update state
  state.flowConfig.executionGraph = executionGraph;
  state.flowConfig.flowGroups = flowGroups; // Store groups for rendering
  state.flowConfig.flowType = 'focused';
  state.flowConfig.focusedNode = nodeId;

  save();
}

/**
 * Get names that represent the center node (class names, function names, file name)
 */
function getCenterNodeNames(node) {
  const names = [];

  // Add node title (often the class/file name)
  if (node.title) {
    const baseName = node.title.replace(/\.(js|ts|jsx|tsx|html)$/, '');
    names.push(baseName);
    // Also add lowercase version
    if (baseName !== baseName.toLowerCase()) {
      names.push(baseName.toLowerCase());
    }
  }

  // For files, add names of classes/functions defined in it
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'class' || child.type === 'function') {
        if (child.title) names.push(child.title);
        if (child.metadata?.name) names.push(child.metadata.name);
      }
    }
  }

  // Check metadata for class/function names
  if (node.metadata?.name) names.push(node.metadata.name);
  if (node.metadata?.className) names.push(node.metadata.className);

  // For class nodes
  if (node.type === 'class' && node.title) {
    names.push(node.title);
  }

  return [...new Set(names)]; // Deduplicate
}

/**
 * Get names exported/defined by a file node
 */
function getFileExportedNames(fileNode) {
  const names = [];

  // File name itself (without extension)
  if (fileNode.title) {
    names.push(fileNode.title.replace(/\.(js|ts|jsx|tsx|html)$/, ''));
  }

  // Names from children (classes, functions)
  if (fileNode.children) {
    for (const child of fileNode.children) {
      if (child.title) names.push(child.title);
      if (child.metadata?.name) names.push(child.metadata.name);
    }
  }

  // From metadata
  if (fileNode.metadata?.name) names.push(fileNode.metadata.name);

  return [...new Set(names)];
}

/**
 * Check if content references a name (class instantiation, function call, variable)
 */
function contentReferencesName(content, name) {
  if (!name || name.length < 2) return false;

  // Patterns to check:
  // - new ClassName(
  // - ClassName.
  // - = ClassName
  // - : ClassName
  // - functionName(
  // - _variableName
  // - .methodName(

  const patterns = [
    new RegExp(`\\bnew\\s+${escapeRegex(name)}\\s*\\(`, 'i'),  // new ClassName(
    new RegExp(`\\b${escapeRegex(name)}\\s*\\.`, 'i'),          // ClassName.
    new RegExp(`\\b${escapeRegex(name)}\\s*\\(`, 'i'),          // functionName(
    new RegExp(`[=:]\\s*${escapeRegex(name)}\\b`, 'i'),         // = ClassName or : ClassName
    new RegExp(`\\b_${escapeRegex(name)}\\b`, 'i'),             // _variableName (global convention)
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get file content from node (tries fileObject, then cached content)
 */
async function getFileContent(node) {
  // Try cached content first
  if (node.fileContent) return node.fileContent;
  if (node.content) return node.content;

  // Try to read from fileObject
  if (node.fileObject) {
    try {
      const content = await node.fileObject.text();
      node.fileContent = content; // Cache it
      return content;
    } catch (e) {
      // File object no longer valid
    }
  }

  return null;
}

/**
 * Group nodes by their directory path
 * @param {Array} nodes - Nodes to group
 * @returns {Map} Map of directory path -> array of nodes
 */
function groupNodesByPath(nodes) {
  const groups = new Map();

  nodes.forEach(node => {
    // Get directory path from node
    const dirPath = getNodeDirectoryPath(node);

    if (!groups.has(dirPath)) {
      groups.set(dirPath, []);
    }
    groups.get(dirPath).push(node);
  });

  return groups;
}

/**
 * Get the directory path for a node
 * @param {Object} node - Node to get path for
 * @returns {string} Directory path (e.g., "src/iso" or "root")
 */
function getNodeDirectoryPath(node) {
  // Try filePath first
  if (node.filePath) {
    const parts = node.filePath.split('/');
    parts.pop(); // Remove filename
    return parts.length > 0 ? parts.join('/') : 'root';
  }

  // Build path by traversing parents
  const pathParts = [];
  let current = node.parent;

  while (current) {
    if (current.type === 'directory' && current.title) {
      pathParts.unshift(current.title);
    }
    current = current.parent;
  }

  return pathParts.length > 0 ? pathParts.join('/') : 'root';
}

/**
 * Create flow group nodes using the standard group node type
 * @param {Map} incomingGroups - Grouped incoming nodes
 * @param {Map} outgoingGroups - Grouped outgoing nodes
 * @param {Object} executionGraph - The execution graph to add groups to
 * @returns {Array} Array of actual group node objects
 */
function createFlowGroups(incomingGroups, outgoingGroups, executionGraph) {
  const flowGroups = [];
  const groupPadding = 20;
  const nodeWidth = 160;
  const nodeHeight = 80;
  const verticalGap = 20;

  // Create groups for incoming (only if more than 1 node in a path)
  incomingGroups.forEach((nodes, path) => {
    if (nodes.length > 1) {
      const groupHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap + groupPadding * 2 + 40;
      const group = {
        id: `flow-group-incoming-${path.replace(/[\/\s]/g, '-')}-${Date.now()}`,
        type: 'group',
        title: path || 'root',
        flowDirection: 'incoming',
        containedNodes: nodes.map(n => n.id),
        size: {
          width: nodeWidth + groupPadding * 2,
          height: groupHeight
        },
        style: {
          color: 'rgba(230, 126, 34, 0.15)',
          borderColor: '#e67e22',
          borderWidth: 2,
          borderRadius: 8
        },
        isFlowGroup: true // Mark as flow-specific group
      };
      flowGroups.push(group);

      // Mark nodes as belonging to this group
      nodes.forEach(n => {
        n.flowGroupId = group.id;
        n.containedIn = group.id;
      });

      // Add to execution graph
      executionGraph.nodes.push({
        id: group.id,
        originalNode: group,
        depth: 1,
        executionOrder: -1, // Groups render first (behind nodes)
        structure: null
      });
    }
  });

  // Create groups for outgoing (only if more than 1 node in a path)
  outgoingGroups.forEach((nodes, path) => {
    if (nodes.length > 1) {
      const groupHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap + groupPadding * 2 + 40;
      const group = {
        id: `flow-group-outgoing-${path.replace(/[\/\s]/g, '-')}-${Date.now()}`,
        type: 'group',
        title: path || 'root',
        flowDirection: 'outgoing',
        containedNodes: nodes.map(n => n.id),
        size: {
          width: nodeWidth + groupPadding * 2,
          height: groupHeight
        },
        style: {
          color: 'rgba(39, 174, 96, 0.15)',
          borderColor: '#27ae60',
          borderWidth: 2,
          borderRadius: 8
        },
        isFlowGroup: true
      };
      flowGroups.push(group);

      // Mark nodes as belonging to this group
      nodes.forEach(n => {
        n.flowGroupId = group.id;
        n.containedIn = group.id;
      });

      // Add to execution graph
      executionGraph.nodes.push({
        id: group.id,
        originalNode: group,
        depth: 1,
        executionOrder: -1,
        structure: null
      });
    }
  });

  return flowGroups;
}

/**
 * Apply horizontal flow layout: incoming LEFT, center MIDDLE, outgoing RIGHT
 * Groups nodes by directory and positions them accordingly
 */
function applyHorizontalFlowLayout(executionGraph, incomingNodes, outgoingNodes, incomingGroups, outgoingGroups, flowGroups) {
  const centerX = 500;
  const centerY = 300;
  const horizontalGap = 300; // Gap between columns (increased for groups)
  const verticalGap = 20;    // Gap between nodes in same column
  const groupGap = 50;       // Gap between groups
  const nodeHeight = 80;
  const nodeWidth = 160;
  const groupPadding = 20;
  const groupHeaderHeight = 40; // Space for group title

  // Find center node and position it
  const centerGraphNode = executionGraph.nodes.find(n => n.depth === 0);
  if (centerGraphNode && centerGraphNode.originalNode) {
    centerGraphNode.originalNode.flowX = centerX;
    centerGraphNode.originalNode.flowY = centerY;
  }

  // Position incoming nodes on the LEFT, grouped by path
  let incomingY = 50;
  const incomingX = centerX - horizontalGap;

  incomingGroups.forEach((nodes, path) => {
    const group = flowGroups.find(g => g.flowDirection === 'incoming' && g.title === path);

    if (group) {
      // Position the group (account for header)
      group.flowX = incomingX - groupPadding;
      group.flowY = incomingY - groupPadding;

      // Position nodes within group (below the header)
      const nodesStartY = incomingY + groupHeaderHeight;
      nodes.forEach((node, idx) => {
        node.flowX = incomingX;
        node.flowY = nodesStartY + idx * (nodeHeight + verticalGap);
      });

      // Update group size based on actual nodes
      const contentHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap;
      group.size.height = contentHeight + groupPadding * 2 + groupHeaderHeight;
      incomingY += group.size.height + groupGap;
    } else {
      // No group, just position nodes
      nodes.forEach((node) => {
        node.flowX = incomingX;
        node.flowY = incomingY;
        incomingY += nodeHeight + verticalGap;
      });
    }
  });

  // Position outgoing nodes on the RIGHT, grouped by path
  let outgoingY = 50;
  const outgoingX = centerX + horizontalGap;

  outgoingGroups.forEach((nodes, path) => {
    const group = flowGroups.find(g => g.flowDirection === 'outgoing' && g.title === path);

    if (group) {
      // Position the group
      group.flowX = outgoingX - groupPadding;
      group.flowY = outgoingY - groupPadding;

      // Position nodes within group (below the header)
      const nodesStartY = outgoingY + groupHeaderHeight;
      nodes.forEach((node, idx) => {
        node.flowX = outgoingX;
        node.flowY = nodesStartY + idx * (nodeHeight + verticalGap);
      });

      // Update group size based on actual nodes
      const contentHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap;
      group.size.height = contentHeight + groupPadding * 2 + groupHeaderHeight;
      outgoingY += group.size.height + groupGap;
    } else {
      // No group, just position nodes
      nodes.forEach((node) => {
        node.flowX = outgoingX;
        node.flowY = outgoingY;
        outgoingY += nodeHeight + verticalGap;
      });
    }
  });

  // Center the layout vertically
  const maxY = Math.max(incomingY, outgoingY);
  const totalHeight = maxY - 50;
  const verticalOffset = Math.max(0, (centerY - totalHeight / 2) - 50);

  // Adjust all positions by vertical offset to center
  incomingNodes.forEach(node => { node.flowY += verticalOffset; });
  outgoingNodes.forEach(node => { node.flowY += verticalOffset; });
  flowGroups.forEach(group => { group.flowY += verticalOffset; });

  console.log(`Horizontal layout applied: center at (${centerX}, ${centerY}), ${flowGroups.length} groups`);
}

/**
 * Flatten node tree into array
 */
function flattenNodeTree(nodes) {
  const flat = [];

  const traverse = (nodeList) => {
    for (const node of nodeList) {
      flat.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
      if (node.childNodes && node.childNodes.length > 0) {
        traverse(node.childNodes);
      }
    }
  };

  traverse(nodes);
  return flat;
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

