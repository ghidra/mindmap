/**
 * Flow Mode
 *
 * Execution graph showing code relationships.
 * Visualizes how code flows between nodes.
 *
 * Features:
 * - Entry-point analysis (trace from main entry)
 * - Node tracing (trace from any selected node)
 * - Focused mode (single-layer around a center node)
 * - Multiple layout directions (top-down, left-right)
 * - Flow-specific positioning (flowX, flowY)
 *
 * @see ARCHITECTURE_PLAN.md Module 5 for full documentation
 */

import { BaseMode } from '../BaseMode.js';
import { state, save, findNode } from '../../state.js';

/**
 * Flow Type enum.
 * @enum {string}
 */
export const FlowType = {
  ENTRY_POINT: 'entry-point',
  NODE_TRACE: 'node-trace',
  FOCUSED: 'focused'
};

/**
 * Layout Direction enum.
 * @enum {string}
 */
export const LayoutDirection = {
  TOP_DOWN: 'top-down',
  LEFT_RIGHT: 'left-right'
};

/**
 * Flow Mode class.
 */
export class FlowMode extends BaseMode {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'flow';
  static name = 'Flow';
  static icon = '🔄';
  static description = 'Execution graph showing code relationships';
  static supportsConnections = true;
  static supportsNodeCreation = false; // Flow nodes are computed
  static supportsDragging = true;

  static defaultViewport = {
    x: 0,
    y: 0,
    zoom: 1
  };

  // =========================================================================
  // Constructor
  // =========================================================================

  constructor(config = {}) {
    super(config);

    /**
     * Flow type.
     * @type {FlowType}
     */
    this._flowType = FlowType.ENTRY_POINT;

    /**
     * Layout direction.
     * @type {LayoutDirection}
     */
    this._layoutDirection = LayoutDirection.TOP_DOWN;

    /**
     * Traced node ID (for node-trace mode).
     * @type {string|null}
     */
    this._tracedNode = null;

    /**
     * Focused node ID (for focused mode).
     * @type {string|null}
     */
    this._focusedNode = null;

    /**
     * Navigation stack for focused mode.
     * @type {string[]}
     */
    this._navigationStack = [];

    /**
     * Execution graph reference.
     * @type {Object|null}
     */
    this._executionGraph = null;

    /**
     * Flow analysis callback.
     * @type {Function|null}
     */
    this._flowAnalyzer = null;
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  async onEnter(previousMode) {
    await super.onEnter(previousMode);

    // Sync state from global flowConfig
    this._flowType = state.flowConfig.flowType || FlowType.ENTRY_POINT;
    this._layoutDirection = state.flowConfig.layoutDirection || LayoutDirection.TOP_DOWN;
    this._tracedNode = state.flowConfig.tracedNode;
    this._focusedNode = state.flowConfig.focusedNode;
    this._navigationStack = state.flowConfig.navigationStack || [];
    this._executionGraph = state.flowConfig.executionGraph;

    console.log(`FlowMode: Entered (type: ${this._flowType})`);
  }

  async onExit(nextMode) {
    // Sync state back to global flowConfig
    state.flowConfig.flowType = this._flowType;
    state.flowConfig.layoutDirection = this._layoutDirection;
    state.flowConfig.tracedNode = this._tracedNode;
    state.flowConfig.focusedNode = this._focusedNode;
    state.flowConfig.navigationStack = this._navigationStack;

    await super.onExit(nextMode);
  }

  onActivate() {
    super.onActivate();
  }

  onDeactivate() {
    super.onDeactivate();
  }

  // =========================================================================
  // Node Methods
  // =========================================================================

  /**
   * Get nodes from execution graph.
   *
   * @returns {Array}
   */
  getNodes() {
    if (!this._executionGraph || !this._executionGraph.nodes) {
      return [];
    }

    // Return original nodes from the graph
    return this._executionGraph.nodes
      .filter(gn => gn.originalNode && !gn.originalNode.syntheticNode)
      .map(gn => gn.originalNode);
  }

  /**
   * Get all nodes including synthetic ones.
   *
   * @returns {Array}
   */
  getAllFlowNodes() {
    if (!this._executionGraph || !this._executionGraph.nodes) {
      return [];
    }
    return this._executionGraph.nodes.map(gn => gn.originalNode);
  }

  /**
   * Get a node by ID.
   *
   * @param {string} nodeId - Node ID
   * @returns {Object|null}
   */
  getNodeById(nodeId) {
    // First check execution graph
    if (this._executionGraph && this._executionGraph.nodes) {
      const graphNode = this._executionGraph.nodes.find(gn => gn.id === nodeId);
      if (graphNode && graphNode.originalNode) {
        return graphNode.originalNode;
      }
    }

    // Fall back to global find
    return findNode(nodeId);
  }

  /**
   * Add a node - not supported in flow mode.
   *
   * @throws {Error} Always throws
   */
  addNode(node, options = {}) {
    throw new Error('FlowMode does not support adding nodes directly');
  }

  /**
   * Remove a node - not supported in flow mode.
   *
   * @throws {Error} Always throws
   */
  removeNode(nodeId) {
    throw new Error('FlowMode does not support removing nodes directly');
  }

  // =========================================================================
  // Connection Methods
  // =========================================================================

  /**
   * Get connections (edges) from execution graph.
   *
   * @returns {Array}
   */
  getConnections() {
    if (!this._executionGraph || !this._executionGraph.edges) {
      return [];
    }

    // Convert edges to connection format
    return this._executionGraph.edges.map((edge, idx) => ({
      id: edge.id || `flow-edge-${idx}`,
      from: { nodeId: edge.from, portId: 'output' },
      to: { nodeId: edge.to, portId: 'input' },
      type: edge.type || 'flow',
      label: edge.label,
      metadata: edge.metadata
    }));
  }

  // =========================================================================
  // Flow Configuration
  // =========================================================================

  /**
   * Get current flow type.
   *
   * @returns {FlowType}
   */
  getFlowType() {
    return this._flowType;
  }

  /**
   * Set flow type.
   *
   * @param {FlowType} flowType
   */
  setFlowType(flowType) {
    this._flowType = flowType;
    state.flowConfig.flowType = flowType;
  }

  /**
   * Get layout direction.
   *
   * @returns {LayoutDirection}
   */
  getLayoutDirection() {
    return this._layoutDirection;
  }

  /**
   * Set layout direction.
   *
   * @param {LayoutDirection} direction
   */
  setLayoutDirection(direction) {
    this._layoutDirection = direction;
    state.flowConfig.layoutDirection = direction;
    this._triggerSave();
  }

  /**
   * Get execution graph.
   *
   * @returns {Object|null}
   */
  getExecutionGraph() {
    return this._executionGraph;
  }

  /**
   * Set execution graph (from external analysis).
   *
   * @param {Object} graph - Execution graph {nodes, edges}
   */
  setExecutionGraph(graph) {
    this._executionGraph = graph;
    state.flowConfig.executionGraph = graph;
  }

  /**
   * Set flow analyzer callback.
   *
   * @param {Function} analyzer - Function to perform flow analysis
   */
  setFlowAnalyzer(analyzer) {
    this._flowAnalyzer = analyzer;
  }

  // =========================================================================
  // Focused Mode
  // =========================================================================

  /**
   * Get focused node ID.
   *
   * @returns {string|null}
   */
  getFocusedNode() {
    return this._focusedNode;
  }

  /**
   * Set focused node and enter focused mode.
   *
   * @param {string} nodeId - Node ID to focus on
   */
  setFocusedNode(nodeId) {
    this._focusedNode = nodeId;
    this._flowType = FlowType.FOCUSED;
    state.flowConfig.focusedNode = nodeId;
    state.flowConfig.flowType = FlowType.FOCUSED;
  }

  /**
   * Navigate to a new center node in focused mode.
   *
   * @param {string} nodeId - Node ID to navigate to
   */
  navigateToNode(nodeId) {
    if (this._focusedNode) {
      this._navigationStack.push(this._focusedNode);
      state.flowConfig.navigationStack = this._navigationStack;
    }
    this.setFocusedNode(nodeId);
  }

  /**
   * Navigate back in focused mode.
   *
   * @returns {boolean} Whether navigation succeeded
   */
  navigateBack() {
    if (this._navigationStack.length === 0) {
      return false;
    }

    const previousNode = this._navigationStack.pop();
    state.flowConfig.navigationStack = this._navigationStack;
    this.setFocusedNode(previousNode);
    return true;
  }

  /**
   * Check if back navigation is available.
   *
   * @returns {boolean}
   */
  canNavigateBack() {
    return this._navigationStack.length > 0;
  }

  /**
   * Clear focused mode and navigation stack.
   */
  clearFocusedMode() {
    this._focusedNode = null;
    this._navigationStack = [];
    this._flowType = FlowType.ENTRY_POINT;

    state.flowConfig.focusedNode = null;
    state.flowConfig.navigationStack = [];
    state.flowConfig.flowType = FlowType.ENTRY_POINT;
  }

  // =========================================================================
  // Node Trace Mode
  // =========================================================================

  /**
   * Get traced node ID.
   *
   * @returns {string|null}
   */
  getTracedNode() {
    return this._tracedNode;
  }

  /**
   * Set traced node and enter node-trace mode.
   *
   * @param {string} nodeId - Node ID to trace from
   * @param {string} [direction] - 'forward', 'backward', or 'both'
   */
  setTracedNode(nodeId, direction = 'forward') {
    this._tracedNode = nodeId;
    this._flowType = FlowType.NODE_TRACE;

    state.flowConfig.tracedNode = nodeId;
    state.flowConfig.traceDirection = direction;
    state.flowConfig.flowType = FlowType.NODE_TRACE;
  }

  /**
   * Clear node trace mode.
   */
  clearNodeTrace() {
    this._tracedNode = null;
    this._flowType = FlowType.ENTRY_POINT;

    state.flowConfig.tracedNode = null;
    state.flowConfig.flowType = FlowType.ENTRY_POINT;
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Handle double-click on a node.
   * In focused flow mode, drill down into the node.
   *
   * @param {Object} node - Clicked node
   * @param {Event} event - Click event
   */
  onNodeDoubleClick(node, event) {
    if (this._flowType === FlowType.FOCUSED) {
      // Don't drill into center node
      if (node.id === this._focusedNode) {
        return;
      }

      // Navigate to clicked node
      this.navigateToNode(node.id);

      // Trigger re-analysis if callback available
      if (this._flowAnalyzer) {
        this._flowAnalyzer(node.id, FlowType.FOCUSED);
      }

      this._triggerRender();
    }
  }

  /**
   * Handle keyboard event.
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean} Whether event was handled
   */
  onKeyDown(event) {
    // Backspace or Escape to go back in focused mode
    if (event.key === 'Backspace' || event.key === 'Escape') {
      if (this._flowType === FlowType.FOCUSED && this.canNavigateBack()) {
        this.navigateBack();

        if (this._flowAnalyzer) {
          this._flowAnalyzer(this._focusedNode, FlowType.FOCUSED);
        }

        this._triggerRender();
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // Position Methods
  // =========================================================================

  /**
   * Get position property names for flow mode.
   * Flow mode uses flowX/flowY to keep positions separate from hierarchical.
   *
   * @returns {{x: string, y: string}}
   */
  getPositionProperties() {
    return { x: 'flowX', y: 'flowY' };
  }

  // =========================================================================
  // Layout Methods
  // =========================================================================

  /**
   * Apply flow layout to execution graph.
   *
   * @param {Object} [options] - Layout options
   */
  applyLayout(options = {}) {
    if (!this._executionGraph || !this._executionGraph.nodes) {
      console.warn('FlowMode: No execution graph to layout');
      return;
    }

    const direction = options.direction || this._layoutDirection;

    if (this._flowType === FlowType.FOCUSED) {
      this._applyRadialLayout(options);
    } else if (direction === LayoutDirection.TOP_DOWN) {
      this._applyTopDownLayout(options);
    } else {
      this._applyLeftRightLayout(options);
    }

    this._triggerRender();
    this._triggerSave();
  }

  /**
   * Apply top-down flow layout.
   * @private
   */
  _applyTopDownLayout(options = {}) {
    const nodeWidth = options.nodeWidth || 140;
    const nodeHeight = options.nodeHeight || 80;
    const hSpacing = options.hSpacing || 40;
    const vSpacing = options.vSpacing || 80;
    const levelSpacing = options.levelSpacing || 150;
    const startX = options.startX || 100;
    const startY = options.startY || 100;
    const maxWidth = options.maxWidth || 1600;

    // Group nodes by depth
    const nodesByDepth = new Map();
    this._executionGraph.nodes.forEach(graphNode => {
      const depth = graphNode.depth || 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(graphNode);
    });

    // Position each depth level
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * hSpacing;
      const levelStartX = startX + Math.max(0, (maxWidth - totalWidth) / 2);
      const y = startY + depth * levelSpacing;

      nodes.forEach((graphNode, index) => {
        if (graphNode.originalNode) {
          graphNode.originalNode.flowX = levelStartX + index * (nodeWidth + hSpacing);
          graphNode.originalNode.flowY = y;
        }
      });
    });
  }

  /**
   * Apply left-right flow layout.
   * @private
   */
  _applyLeftRightLayout(options = {}) {
    const nodeWidth = options.nodeWidth || 140;
    const nodeHeight = options.nodeHeight || 80;
    const hSpacing = options.hSpacing || 40;
    const vSpacing = options.vSpacing || 80;
    const levelSpacing = options.levelSpacing || 150;
    const startX = options.startX || 100;
    const startY = options.startY || 100;
    const maxHeight = options.maxHeight || 800;

    // Group nodes by depth
    const nodesByDepth = new Map();
    this._executionGraph.nodes.forEach(graphNode => {
      const depth = graphNode.depth || 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(graphNode);
    });

    // Position each depth level
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    depths.forEach(depth => {
      const nodes = nodesByDepth.get(depth);
      const totalHeight = nodes.length * nodeHeight + (nodes.length - 1) * vSpacing;
      const levelStartY = startY + Math.max(0, (maxHeight - totalHeight) / 2);
      const x = startX + depth * levelSpacing;

      nodes.forEach((graphNode, index) => {
        if (graphNode.originalNode) {
          graphNode.originalNode.flowX = x;
          graphNode.originalNode.flowY = levelStartY + index * (nodeHeight + vSpacing);
        }
      });
    });
  }

  /**
   * Apply radial layout for focused mode.
   * Center node in middle, incoming left, outgoing right.
   * @private
   */
  _applyRadialLayout(options = {}) {
    const centerX = options.centerX || 500;
    const centerY = options.centerY || 300;
    const horizontalGap = options.horizontalGap || 300;
    const verticalGap = options.verticalGap || 20;
    const nodeHeight = options.nodeHeight || 80;

    const incomingNodes = [];
    const outgoingNodes = [];

    // Separate nodes by flow direction
    this._executionGraph.nodes.forEach(graphNode => {
      const node = graphNode.originalNode;
      if (!node) return;

      if (node.id === this._focusedNode) {
        // Center node
        node.flowX = centerX;
        node.flowY = centerY;
      } else if (node.flowDirection === 'incoming') {
        incomingNodes.push(node);
      } else if (node.flowDirection === 'outgoing') {
        outgoingNodes.push(node);
      }
    });

    // Position incoming nodes on the left
    const incomingX = centerX - horizontalGap;
    const incomingStartY = centerY - ((incomingNodes.length - 1) * (nodeHeight + verticalGap)) / 2;
    incomingNodes.forEach((node, idx) => {
      node.flowX = incomingX;
      node.flowY = incomingStartY + idx * (nodeHeight + verticalGap);
    });

    // Position outgoing nodes on the right
    const outgoingX = centerX + horizontalGap;
    const outgoingStartY = centerY - ((outgoingNodes.length - 1) * (nodeHeight + verticalGap)) / 2;
    outgoingNodes.forEach((node, idx) => {
      node.flowX = outgoingX;
      node.flowY = outgoingStartY + idx * (nodeHeight + verticalGap);
    });
  }

  /**
   * Get layout configuration.
   *
   * @returns {Object}
   */
  getLayoutConfig() {
    return {
      type: 'flow',
      directions: ['top-down', 'left-right'],
      defaultDirection: this._layoutDirection,
      flowTypes: Object.values(FlowType)
    };
  }

  // =========================================================================
  // Controls
  // =========================================================================

  /**
   * Get mode-specific controls.
   *
   * @returns {Object[]}
   */
  getControls() {
    const controls = [
      {
        id: 'layout-direction',
        type: 'toggle',
        label: 'Direction',
        options: [
          { value: LayoutDirection.TOP_DOWN, label: '↓', title: 'Top-Down' },
          { value: LayoutDirection.LEFT_RIGHT, label: '→', title: 'Left-Right' }
        ],
        value: this._layoutDirection,
        action: (value) => {
          this.setLayoutDirection(value);
          this.applyLayout();
        }
      },
      {
        id: 're-layout',
        type: 'button',
        label: 'Re-layout',
        icon: '🔄',
        action: () => this.applyLayout()
      }
    ];

    // Add back button for focused mode
    if (this._flowType === FlowType.FOCUSED) {
      controls.unshift({
        id: 'navigate-back',
        type: 'button',
        label: '← Back',
        icon: '⬅️',
        disabled: !this.canNavigateBack(),
        action: () => {
          if (this.navigateBack() && this._flowAnalyzer) {
            this._flowAnalyzer(this._focusedNode, FlowType.FOCUSED);
          }
        }
      });

      controls.push({
        id: 'clear-focus',
        type: 'button',
        label: 'Clear Focus',
        icon: '❌',
        action: () => {
          this.clearFocusedMode();
          this._triggerRender();
        }
      });
    }

    // Add clear trace button for node-trace mode
    if (this._flowType === FlowType.NODE_TRACE) {
      controls.push({
        id: 'clear-trace',
        type: 'button',
        label: 'Clear Trace',
        icon: '❌',
        action: () => {
          this.clearNodeTrace();
          this._triggerRender();
        }
      });
    }

    return controls;
  }

  /**
   * Handle control action.
   *
   * @param {string} controlId - Control ID
   * @param {*} value - Control value
   */
  onControlAction(controlId, value) {
    const control = this.getControls().find(c => c.id === controlId);
    if (control && control.action) {
      control.action(value);
    }
  }

  // =========================================================================
  // Flow Direction Helpers
  // =========================================================================

  /**
   * Check if a node is the center node in focused mode.
   *
   * @param {string} nodeId - Node ID
   * @returns {boolean}
   */
  isCenterNode(nodeId) {
    return this._flowType === FlowType.FOCUSED && nodeId === this._focusedNode;
  }

  /**
   * Get flow direction for a node.
   *
   * @param {string} nodeId - Node ID
   * @returns {'center'|'incoming'|'outgoing'|null}
   */
  getNodeFlowDirection(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return null;

    if (node.id === this._focusedNode) return 'center';
    return node.flowDirection || null;
  }
}
