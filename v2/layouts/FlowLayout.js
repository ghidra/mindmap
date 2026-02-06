/**
 * Flow Layout Algorithm
 *
 * Positions nodes based on execution graph depth levels.
 * Supports top-down and left-right layouts with barycenter optimization.
 *
 * @see ARCHITECTURE_PLAN.md Module 5.6 for full documentation
 */

/**
 * @typedef {Object} FlowLayoutConfig
 * @property {number} [nodeWidth=140] - Default node width
 * @property {number} [nodeHeight=80] - Default node height
 * @property {number} [minHorizontalSpacing=40] - Min horizontal spacing
 * @property {number} [minVerticalSpacing=80] - Min vertical spacing
 * @property {number} [levelSpacing=150] - Spacing between depth levels
 * @property {number} [startX=100] - Starting X position
 * @property {number} [startY=100] - Starting Y position
 * @property {number} [maxWidth=1600] - Max layout width
 * @property {number} [maxHeight=800] - Max layout height
 * @property {'top-down'|'left-right'} [direction='top-down'] - Layout direction
 */

/**
 * Flow Layout class.
 * Positions nodes in an execution graph using depth-based layout.
 */
export class FlowLayout {
  /**
   * Create a new FlowLayout instance.
   *
   * @param {FlowLayoutConfig} [config]
   */
  constructor(config = {}) {
    this.nodeWidth = config.nodeWidth || 140;
    this.nodeHeight = config.nodeHeight || 80;
    this.minHorizontalSpacing = config.minHorizontalSpacing || 40;
    this.minVerticalSpacing = config.minVerticalSpacing || 80;
    this.levelSpacing = config.levelSpacing || 150;
    this.startX = config.startX || 100;
    this.startY = config.startY || 100;
    this.maxWidth = config.maxWidth || 1600;
    this.maxHeight = config.maxHeight || 800;
    this.direction = config.direction || 'top-down';
  }

  /**
   * Apply layout to an execution graph.
   *
   * @param {Object} executionGraph - Graph with nodes and edges
   * @param {Object} [options] - Layout options
   */
  layout(executionGraph, options = {}) {
    if (!executionGraph || !executionGraph.nodes) {
      console.warn('FlowLayout: No execution graph provided');
      return;
    }

    const direction = options.direction || this.direction;
    console.log(`FlowLayout: Applying ${direction} layout...`);

    // Group nodes by depth
    const nodesByDepth = this.groupByDepth(executionGraph);

    // Optimize node ordering using barycenter method
    this.optimizeNodeOrder(nodesByDepth, executionGraph.edges || []);

    // Apply position based on direction
    if (direction === 'top-down') {
      this.applyTopDownLayout(nodesByDepth, options);
    } else {
      this.applyLeftRightLayout(nodesByDepth, options);
    }

    // Apply calculated positions to original nodes
    this.applyPositions(nodesByDepth, options);

    console.log(`FlowLayout: Positioned ${executionGraph.nodes.length} nodes`);
  }

  /**
   * Group nodes by their depth level.
   *
   * @param {Object} executionGraph - Execution graph
   * @returns {Map<number, Array>} Nodes grouped by depth
   */
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

  /**
   * Optimize node ordering within levels using barycenter method.
   * Reduces edge crossings by positioning nodes near their connected nodes.
   *
   * @param {Map<number, Array>} nodesByDepth - Grouped nodes
   * @param {Array} edges - Graph edges
   */
  optimizeNodeOrder(nodesByDepth, edges) {
    // Build incoming edges map
    const incoming = new Map();
    edges.forEach(edge => {
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to).push(edge.from);
    });

    // Process each depth level (skip first level)
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    for (let i = 1; i < depths.length; i++) {
      const nodes = nodesByDepth.get(depths[i]);

      // Calculate barycenter for each node
      nodes.forEach(graphNode => {
        const connectedNodes = incoming.get(graphNode.id) || [];

        if (connectedNodes.length > 0) {
          let sumX = 0;
          let count = 0;

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

      // Sort by barycenter
      nodes.sort((a, b) => a.barycenter - b.barycenter);
    }
  }

  /**
   * Apply top-down layout (depth increases downward).
   *
   * @param {Map<number, Array>} nodesByDepth - Grouped nodes
   * @param {Object} [options] - Layout options
   */
  applyTopDownLayout(nodesByDepth, options = {}) {
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const maxWidth = options.maxWidth ?? this.maxWidth;

    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalWidth = nodes.length * this.nodeWidth +
                         (nodes.length - 1) * this.minHorizontalSpacing;
      const levelStartX = startX + Math.max(0, (maxWidth - totalWidth) / 2);
      const y = startY + depth * this.levelSpacing;

      nodes.forEach((graphNode, index) => {
        graphNode.layoutX = levelStartX + index * (this.nodeWidth + this.minHorizontalSpacing);
        graphNode.layoutY = y;
      });
    });
  }

  /**
   * Apply left-right layout (depth increases rightward).
   *
   * @param {Map<number, Array>} nodesByDepth - Grouped nodes
   * @param {Object} [options] - Layout options
   */
  applyLeftRightLayout(nodesByDepth, options = {}) {
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const maxHeight = options.maxHeight ?? this.maxHeight;

    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalHeight = nodes.length * this.nodeHeight +
                          (nodes.length - 1) * this.minVerticalSpacing;
      const levelStartY = startY + Math.max(0, (maxHeight - totalHeight) / 2);
      const x = startX + depth * this.levelSpacing;

      nodes.forEach((graphNode, index) => {
        graphNode.layoutX = x;
        graphNode.layoutY = levelStartY + index * (this.nodeHeight + this.minVerticalSpacing);
      });
    });
  }

  /**
   * Apply calculated layout positions to original nodes.
   *
   * @param {Map<number, Array>} nodesByDepth - Grouped nodes with layout positions
   * @param {Object} [options] - Options
   * @param {string} [options.xProp='flowX'] - X position property name
   * @param {string} [options.yProp='flowY'] - Y position property name
   */
  applyPositions(nodesByDepth, options = {}) {
    const xProp = options.xProp || 'flowX';
    const yProp = options.yProp || 'flowY';

    nodesByDepth.forEach(nodes => {
      nodes.forEach(graphNode => {
        const node = graphNode.originalNode;
        if (node && graphNode.layoutX !== undefined) {
          node[xProp] = graphNode.layoutX;
          node[yProp] = graphNode.layoutY;

          // Store metadata
          if (!node.flowMetadata) node.flowMetadata = {};
          node.flowMetadata.depth = graphNode.depth;
          node.flowMetadata.executionOrder = graphNode.executionOrder;
        }
      });
    });
  }

  /**
   * Find a node by ID across all depth levels.
   *
   * @param {Map<number, Array>} nodesByDepth - Grouped nodes
   * @param {string} nodeId - Node ID to find
   * @returns {Object|null}
   */
  findNodeById(nodesByDepth, nodeId) {
    for (const nodes of nodesByDepth.values()) {
      const found = nodes.find(n => n.id === nodeId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get configuration.
   *
   * @returns {FlowLayoutConfig}
   */
  getConfig() {
    return {
      nodeWidth: this.nodeWidth,
      nodeHeight: this.nodeHeight,
      minHorizontalSpacing: this.minHorizontalSpacing,
      minVerticalSpacing: this.minVerticalSpacing,
      levelSpacing: this.levelSpacing,
      startX: this.startX,
      startY: this.startY,
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
      direction: this.direction
    };
  }

  /**
   * Update configuration.
   *
   * @param {Partial<FlowLayoutConfig>} config
   */
  setConfig(config) {
    Object.assign(this, config);
  }
}

/**
 * Radial Flow Layout.
 * Positions nodes in a radial pattern around a center node.
 */
export class RadialFlowLayout {
  /**
   * Create a new RadialFlowLayout instance.
   *
   * @param {Object} [config]
   */
  constructor(config = {}) {
    this.centerX = config.centerX || 500;
    this.centerY = config.centerY || 300;
    this.horizontalGap = config.horizontalGap || 300;
    this.verticalGap = config.verticalGap || 20;
    this.nodeHeight = config.nodeHeight || 80;
    this.groupPadding = config.groupPadding || 20;
    this.groupHeaderHeight = config.groupHeaderHeight || 40;
  }

  /**
   * Apply radial layout with center node, incoming left, outgoing right.
   *
   * @param {Object} executionGraph - Execution graph
   * @param {string} centerNodeId - ID of the center node
   * @param {Object} [options] - Layout options
   */
  layout(executionGraph, centerNodeId, options = {}) {
    if (!executionGraph || !executionGraph.nodes) {
      console.warn('RadialFlowLayout: No execution graph provided');
      return;
    }

    const centerX = options.centerX ?? this.centerX;
    const centerY = options.centerY ?? this.centerY;
    const horizontalGap = options.horizontalGap ?? this.horizontalGap;

    const incomingNodes = [];
    const outgoingNodes = [];

    // Separate nodes by flow direction
    executionGraph.nodes.forEach(graphNode => {
      const node = graphNode.originalNode;
      if (!node) return;

      if (node.id === centerNodeId) {
        // Position center node
        node.flowX = centerX;
        node.flowY = centerY;
      } else if (node.flowDirection === 'incoming') {
        incomingNodes.push(node);
      } else if (node.flowDirection === 'outgoing') {
        outgoingNodes.push(node);
      }
    });

    // Position incoming nodes on left
    this.positionColumn(incomingNodes, centerX - horizontalGap, centerY, options);

    // Position outgoing nodes on right
    this.positionColumn(outgoingNodes, centerX + horizontalGap, centerY, options);

    console.log(`RadialFlowLayout: Positioned center + ${incomingNodes.length} incoming + ${outgoingNodes.length} outgoing`);
  }

  /**
   * Position a column of nodes centered around a Y coordinate.
   *
   * @param {Array} nodes - Nodes to position
   * @param {number} x - X position
   * @param {number} centerY - Center Y position
   * @param {Object} [options] - Layout options
   */
  positionColumn(nodes, x, centerY, options = {}) {
    const verticalGap = options.verticalGap ?? this.verticalGap;
    const nodeHeight = options.nodeHeight ?? this.nodeHeight;

    if (nodes.length === 0) return;

    const totalHeight = nodes.length * nodeHeight + (nodes.length - 1) * verticalGap;
    const startY = centerY - totalHeight / 2;

    nodes.forEach((node, idx) => {
      node.flowX = x;
      node.flowY = startY + idx * (nodeHeight + verticalGap);
    });
  }

  /**
   * Layout with grouped nodes (by directory path).
   *
   * @param {Object} executionGraph - Execution graph
   * @param {string} centerNodeId - Center node ID
   * @param {Map} incomingGroups - Incoming nodes grouped by path
   * @param {Map} outgoingGroups - Outgoing nodes grouped by path
   * @param {Array} flowGroups - Flow group nodes
   * @param {Object} [options] - Layout options
   */
  layoutWithGroups(executionGraph, centerNodeId, incomingGroups, outgoingGroups, flowGroups, options = {}) {
    const centerX = options.centerX ?? this.centerX;
    const centerY = options.centerY ?? this.centerY;
    const horizontalGap = options.horizontalGap ?? this.horizontalGap;
    const verticalGap = options.verticalGap ?? this.verticalGap;
    const nodeHeight = options.nodeHeight ?? this.nodeHeight;
    const groupGap = options.groupGap || 50;
    const groupPadding = options.groupPadding ?? this.groupPadding;
    const groupHeaderHeight = options.groupHeaderHeight ?? this.groupHeaderHeight;

    // Position center node
    const centerGraphNode = executionGraph.nodes.find(n => n.id === centerNodeId);
    if (centerGraphNode && centerGraphNode.originalNode) {
      centerGraphNode.originalNode.flowX = centerX;
      centerGraphNode.originalNode.flowY = centerY;
    }

    // Position incoming groups on left
    let incomingY = 50;
    const incomingX = centerX - horizontalGap;

    incomingGroups.forEach((nodes, path) => {
      const group = flowGroups.find(g => g.flowDirection === 'incoming' && g.title === path);

      if (group) {
        group.flowX = incomingX - groupPadding;
        group.flowY = incomingY - groupPadding;

        const nodesStartY = incomingY + groupHeaderHeight;
        nodes.forEach((node, idx) => {
          node.flowX = incomingX;
          node.flowY = nodesStartY + idx * (nodeHeight + verticalGap);
        });

        const contentHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap;
        group.size.height = contentHeight + groupPadding * 2 + groupHeaderHeight;
        incomingY += group.size.height + groupGap;
      } else {
        nodes.forEach(node => {
          node.flowX = incomingX;
          node.flowY = incomingY;
          incomingY += nodeHeight + verticalGap;
        });
      }
    });

    // Position outgoing groups on right
    let outgoingY = 50;
    const outgoingX = centerX + horizontalGap;

    outgoingGroups.forEach((nodes, path) => {
      const group = flowGroups.find(g => g.flowDirection === 'outgoing' && g.title === path);

      if (group) {
        group.flowX = outgoingX - groupPadding;
        group.flowY = outgoingY - groupPadding;

        const nodesStartY = outgoingY + groupHeaderHeight;
        nodes.forEach((node, idx) => {
          node.flowX = outgoingX;
          node.flowY = nodesStartY + idx * (nodeHeight + verticalGap);
        });

        const contentHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap;
        group.size.height = contentHeight + groupPadding * 2 + groupHeaderHeight;
        outgoingY += group.size.height + groupGap;
      } else {
        nodes.forEach(node => {
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

    // Apply offset
    incomingGroups.forEach(nodes => {
      nodes.forEach(node => { node.flowY += verticalOffset; });
    });
    outgoingGroups.forEach(nodes => {
      nodes.forEach(node => { node.flowY += verticalOffset; });
    });
    flowGroups.forEach(group => {
      if (group.flowY !== undefined) {
        group.flowY += verticalOffset;
      }
    });

    console.log(`RadialFlowLayout: Positioned with ${flowGroups.length} groups`);
  }
}
