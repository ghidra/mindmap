import { state } from './state.js';

/**
 * Layout Manager - Strategy pattern for different layout algorithms
 * Delegates to specific layout implementations based on mode and config
 */

/**
 * Layout nodes based on current mode and configuration
 * @param {Array} nodes - Nodes to layout
 * @param {string} mode - 'hierarchical' or 'flow'
 * @param {Object} config - Layout configuration
 * @returns {Map} Position map (nodeId -> {x, y})
 */
export function layoutNodes(nodes, mode, config = {}) {
  if (mode === 'hierarchical') {
    // Hierarchical mode uses manual positioning - no automatic layout
    return getManualPositions(nodes);
  } else if (mode === 'flow') {
    const direction = config.layoutDirection || state.flowConfig.layoutDirection;
    const executionGraph = config.executionGraph || state.flowConfig.executionGraph;

    if (!executionGraph) {
      throw new Error('Flow mode requires an execution graph');
    }

    if (direction === 'top-down') {
      return layoutTopDown(nodes, executionGraph, config);
    } else if (direction === 'left-right') {
      return layoutLeftRight(nodes, executionGraph, config);
    } else {
      throw new Error('Unknown layout direction: ' + direction);
    }
  } else {
    throw new Error('Unknown layout mode: ' + mode);
  }
}

/**
 * Get manual positions for hierarchical mode
 */
function getManualPositions(nodes) {
  const positions = new Map();

  function collectPositions(nodeList) {
    nodeList.forEach(node => {
      positions.set(node.id, {
        x: node.x || 0,
        y: node.y || 0
      });

      if (node.children && node.children.length > 0) {
        collectPositions(node.children);
      }
    });
  }

  collectPositions(nodes);
  return positions;
}

/**
 * Top-down flow layout
 * TODO Phase 4: Import actual implementation from layouts/top-down-layout.js
 */
function layoutTopDown(nodes, executionGraph, config) {
  const positions = new Map();

  // Default configuration
  const nodeWidth = config.nodeWidth || 140;
  const nodeHeight = config.nodeHeight || 60;
  const horizontalSpacing = config.horizontalSpacing || 60;
  const verticalSpacing = config.verticalSpacing || 100;
  const startX = config.startX || 100;
  const startY = config.startY || 100;

  // Group nodes by depth
  const nodesByDepth = new Map();

  executionGraph.nodes.forEach(graphNode => {
    const depth = graphNode.depth || 0;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth).push(graphNode);
  });

  // Position nodes level by level
  const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

  depths.forEach(depth => {
    const nodesAtDepth = nodesByDepth.get(depth);
    const totalWidth = nodesAtDepth.length * nodeWidth + (nodesAtDepth.length - 1) * horizontalSpacing;
    const levelStartX = startX + (800 - totalWidth) / 2; // Center horizontally (assuming canvas ~1000px wide)

    nodesAtDepth.forEach((graphNode, index) => {
      const x = levelStartX + index * (nodeWidth + horizontalSpacing);
      const y = startY + depth * verticalSpacing;

      positions.set(graphNode.id, { x, y });
    });
  });

  return positions;
}

/**
 * Left-right flow layout
 * TODO Phase 4: Import actual implementation from layouts/left-right-layout.js
 */
function layoutLeftRight(nodes, executionGraph, config) {
  const positions = new Map();

  // Default configuration
  const nodeWidth = config.nodeWidth || 140;
  const nodeHeight = config.nodeHeight || 60;
  const horizontalSpacing = config.horizontalSpacing || 150;
  const verticalSpacing = config.verticalSpacing || 50;
  const startX = config.startX || 100;
  const startY = config.startY || 100;

  // Group nodes by depth (depth becomes horizontal position in left-right layout)
  const nodesByDepth = new Map();

  executionGraph.nodes.forEach(graphNode => {
    const depth = graphNode.depth || 0;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth).push(graphNode);
  });

  // Position nodes level by level (rotated 90° from top-down)
  const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

  depths.forEach(depth => {
    const nodesAtDepth = nodesByDepth.get(depth);

    nodesAtDepth.forEach((graphNode, index) => {
      const x = startX + depth * horizontalSpacing;
      const y = startY + index * (nodeHeight + verticalSpacing);

      positions.set(graphNode.id, { x, y });
    });
  });

  return positions;
}

/**
 * Resolve overlapping nodes
 * TODO Phase 4: Import actual implementation from layouts/overlap-resolver.js
 */
export function resolveOverlaps(positions, config = {}) {
  const nodeWidth = config.nodeWidth || 140;
  const nodeHeight = config.nodeHeight || 60;
  const minDistance = config.minDistance || 20;
  const maxIterations = config.maxIterations || 50;

  // Simple overlap detection and resolution
  const positionArray = Array.from(positions.entries());

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hadOverlap = false;

    for (let i = 0; i < positionArray.length; i++) {
      for (let j = i + 1; j < positionArray.length; j++) {
        const [id1, pos1] = positionArray[i];
        const [id2, pos2] = positionArray[j];

        // Check for overlap
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const requiredDistance = Math.sqrt(
          Math.pow(nodeWidth + minDistance, 2) + Math.pow(nodeHeight + minDistance, 2)
        ) / 2;

        if (distance < requiredDistance && distance > 0) {
          hadOverlap = true;

          // Push nodes apart
          const separation = requiredDistance - distance;
          const normalizedDx = dx / distance;
          const normalizedDy = dy / distance;

          pos1.x -= normalizedDx * separation / 2;
          pos1.y -= normalizedDy * separation / 2;
          pos2.x += normalizedDx * separation / 2;
          pos2.y += normalizedDy * separation / 2;
        }
      }
    }

    if (!hadOverlap) {
      break; // No more overlaps
    }
  }

  return positions;
}

/**
 * Apply positions to nodes
 */
export function applyPositions(nodes, positions, mode) {
  function applyToNodeList(nodeList) {
    nodeList.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) {
        if (mode === 'hierarchical') {
          node.x = pos.x;
          node.y = pos.y;
        } else if (mode === 'flow') {
          node.flowX = pos.x;
          node.flowY = pos.y;
        }
      }

      // Recursively apply to children
      if (node.children && node.children.length > 0) {
        applyToNodeList(node.children);
      }
    });
  }

  applyToNodeList(nodes);
}
