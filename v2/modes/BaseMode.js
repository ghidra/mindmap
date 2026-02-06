/**
 * Base Mode
 *
 * Abstract base class for visualization modes.
 * Each mode defines how nodes are retrieved, rendered, and interacted with.
 *
 * Modes:
 * - Hierarchical: Tree-like navigation of code structure
 * - Flow: Execution graph showing code relationships
 * - Notes: Free-form notes and diagrams
 *
 * @see ARCHITECTURE_PLAN.md Module 5 for full documentation
 */

import { state } from '../state.js';

/**
 * @typedef {Object} ModeViewState
 * @property {Array} nodes - Nodes for this mode
 * @property {Array} connections - Connections for this mode
 * @property {Object} viewport - Viewport state {x, y, zoom}
 * @property {Array} selection - Selected node IDs
 * @property {Object} [modeSpecific] - Mode-specific state
 */

/**
 * @typedef {Object} ModeConfig
 * @property {string} id - Mode identifier
 * @property {string} name - Display name
 * @property {string} icon - Mode icon (emoji)
 * @property {string} [description] - Mode description
 * @property {Object} [defaultViewport] - Default viewport settings
 * @property {Object} [controls] - Mode-specific controls configuration
 */

/**
 * Base Mode class.
 * Extend this class to implement mode-specific behavior.
 */
export class BaseMode {
  // =========================================================================
  // Static Properties
  // =========================================================================

  /**
   * Mode identifier.
   * @type {string}
   */
  static id = '';

  /**
   * Display name.
   * @type {string}
   */
  static name = '';

  /**
   * Mode icon (emoji or class).
   * @type {string}
   */
  static icon = '';

  /**
   * Mode description.
   * @type {string}
   */
  static description = '';

  /**
   * Default viewport settings.
   * @type {Object}
   */
  static defaultViewport = {
    x: 0,
    y: 0,
    zoom: 1
  };

  /**
   * Whether this mode supports connections.
   * @type {boolean}
   */
  static supportsConnections = true;

  /**
   * Whether this mode supports node creation.
   * @type {boolean}
   */
  static supportsNodeCreation = true;

  /**
   * Whether nodes can be dragged in this mode.
   * @type {boolean}
   */
  static supportsDragging = true;

  // =========================================================================
  // Constructor
  // =========================================================================

  /**
   * Create a new mode instance.
   *
   * @param {Object} [config] - Mode configuration
   */
  constructor(config = {}) {
    /**
     * Mode-specific state.
     * @type {Object}
     * @protected
     */
    this._state = {};

    /**
     * Position cache for this mode.
     * @type {Map<string, {x: number, y: number}>}
     * @protected
     */
    this._positionCache = new Map();

    /**
     * Render callback.
     * @type {Function|null}
     * @protected
     */
    this._renderCallback = null;

    /**
     * Save callback.
     * @type {Function|null}
     * @protected
     */
    this._saveCallback = null;

    // Apply config
    if (config.renderCallback) this._renderCallback = config.renderCallback;
    if (config.saveCallback) this._saveCallback = config.saveCallback;
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Called when entering this mode.
   * Override to perform mode-specific initialization.
   *
   * @param {string} previousMode - Previous mode ID
   * @returns {Promise<void>}
   */
  async onEnter(previousMode) {
    console.log(`${this.constructor.name}: Entering from ${previousMode || 'none'}`);
    this.restorePositions();
  }

  /**
   * Called when exiting this mode.
   * Override to perform mode-specific cleanup.
   *
   * @param {string} nextMode - Next mode ID
   * @returns {Promise<void>}
   */
  async onExit(nextMode) {
    console.log(`${this.constructor.name}: Exiting to ${nextMode}`);
    this.savePositions();
  }

  /**
   * Called when mode is activated (after enter, before first render).
   * Override for additional setup.
   */
  onActivate() {
    // Override in subclass
  }

  /**
   * Called when mode is deactivated (before exit).
   * Override for cleanup.
   */
  onDeactivate() {
    // Override in subclass
  }

  // =========================================================================
  // Node Methods
  // =========================================================================

  /**
   * Get nodes to render for current state.
   * Override to implement mode-specific node retrieval.
   *
   * @returns {Array} Array of nodes
   */
  getNodes() {
    return [];
  }

  /**
   * Get a node by ID.
   *
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Node or null
   */
  getNodeById(nodeId) {
    const nodes = this.getNodes();
    return this._findNodeRecursive(nodes, nodeId);
  }

  /**
   * Find a node recursively in a node tree.
   *
   * @param {Array} nodes - Nodes to search
   * @param {string} nodeId - Node ID to find
   * @returns {Object|null}
   * @protected
   */
  _findNodeRecursive(nodes, nodeId) {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.children) {
        const found = this._findNodeRecursive(node.children, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get all nodes flattened (including children).
   *
   * @returns {Array} Flattened node array
   */
  getAllNodesFlatttened() {
    const flat = [];
    const traverse = (nodes) => {
      for (const node of nodes) {
        flat.push(node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(this.getNodes());
    return flat;
  }

  /**
   * Add a node.
   * Override to implement mode-specific node addition.
   *
   * @param {Object} node - Node to add
   * @param {Object} [options] - Options
   * @returns {Object} Added node
   */
  addNode(node, options = {}) {
    throw new Error('addNode not implemented');
  }

  /**
   * Remove a node.
   * Override to implement mode-specific node removal.
   *
   * @param {string} nodeId - Node ID to remove
   * @returns {boolean} Whether removed
   */
  removeNode(nodeId) {
    throw new Error('removeNode not implemented');
  }

  /**
   * Update a node.
   *
   * @param {string} nodeId - Node ID
   * @param {Object} updates - Properties to update
   * @returns {boolean} Whether updated
   */
  updateNode(nodeId, updates) {
    const node = this.getNodeById(nodeId);
    if (!node) return false;

    Object.assign(node, updates);
    return true;
  }

  // =========================================================================
  // Connection Methods
  // =========================================================================

  /**
   * Get connections to render.
   * Override to implement mode-specific connection retrieval.
   *
   * @returns {Array} Array of connections
   */
  getConnections() {
    return state.connections || [];
  }

  /**
   * Add a connection.
   *
   * @param {Object} connection - Connection to add
   * @returns {Object} Added connection
   */
  addConnection(connection) {
    state.connections.push(connection);
    return connection;
  }

  /**
   * Remove a connection.
   *
   * @param {string} connectionId - Connection ID
   * @returns {boolean} Whether removed
   */
  removeConnection(connectionId) {
    const idx = state.connections.findIndex(c => c.id === connectionId);
    if (idx !== -1) {
      state.connections.splice(idx, 1);
      return true;
    }
    return false;
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Handle double-click on a node.
   * Override for mode-specific behavior.
   *
   * @param {Object} node - Clicked node
   * @param {Event} event - Click event
   */
  onNodeDoubleClick(node, event) {
    // Override in subclass
  }

  /**
   * Handle double-click on canvas.
   * Override for mode-specific behavior.
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Event} event - Click event
   */
  onCanvasDoubleClick(x, y, event) {
    // Override in subclass
  }

  /**
   * Handle node selection.
   *
   * @param {string} nodeId - Selected node ID
   * @param {Object} [options] - Options
   * @param {boolean} [options.addToSelection] - Add to existing selection
   */
  onNodeSelect(nodeId, options = {}) {
    // Override in subclass
  }

  /**
   * Handle node drag start.
   *
   * @param {string} nodeId - Dragged node ID
   * @param {Object} position - Start position {x, y}
   */
  onNodeDragStart(nodeId, position) {
    // Override in subclass
  }

  /**
   * Handle node drag.
   *
   * @param {string} nodeId - Dragged node ID
   * @param {Object} position - Current position {x, y}
   * @param {Object} delta - Position delta {dx, dy}
   */
  onNodeDrag(nodeId, position, delta) {
    const node = this.getNodeById(nodeId);
    if (node) {
      this.setNodePosition(node, position.x, position.y);
    }
  }

  /**
   * Handle node drag end.
   *
   * @param {string} nodeId - Dragged node ID
   * @param {Object} position - Final position {x, y}
   */
  onNodeDragEnd(nodeId, position) {
    this._triggerSave();
  }

  /**
   * Handle keyboard event.
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean} Whether event was handled
   */
  onKeyDown(event) {
    return false; // Not handled
  }

  // =========================================================================
  // Position Methods
  // =========================================================================

  /**
   * Get position property names for this mode.
   * Override for modes that use different property names (e.g., flowX/flowY).
   *
   * @returns {{x: string, y: string}}
   */
  getPositionProperties() {
    return { x: 'x', y: 'y' };
  }

  /**
   * Get node position.
   *
   * @param {Object} node - Node
   * @returns {{x: number, y: number}}
   */
  getNodePosition(node) {
    const props = this.getPositionProperties();
    return {
      x: node[props.x] ?? 0,
      y: node[props.y] ?? 0
    };
  }

  /**
   * Set node position.
   *
   * @param {Object} node - Node
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setNodePosition(node, x, y) {
    const props = this.getPositionProperties();
    node[props.x] = x;
    node[props.y] = y;
  }

  /**
   * Save current positions to cache.
   */
  savePositions() {
    const nodes = this.getAllNodesFlatttened();
    const props = this.getPositionProperties();

    for (const node of nodes) {
      this._positionCache.set(node.id, {
        x: node[props.x],
        y: node[props.y]
      });
    }
  }

  /**
   * Restore positions from cache.
   */
  restorePositions() {
    const nodes = this.getAllNodesFlatttened();
    const props = this.getPositionProperties();

    for (const node of nodes) {
      const cached = this._positionCache.get(node.id);
      if (cached) {
        node[props.x] = cached.x;
        node[props.y] = cached.y;
      }
    }
  }

  // =========================================================================
  // Layout Methods
  // =========================================================================

  /**
   * Apply layout to nodes.
   * Override to implement mode-specific layout algorithms.
   *
   * @param {Object} [options] - Layout options
   */
  applyLayout(options = {}) {
    // Override in subclass
  }

  /**
   * Get layout configuration.
   *
   * @returns {Object}
   */
  getLayoutConfig() {
    return {};
  }

  // =========================================================================
  // View State
  // =========================================================================

  /**
   * Get current view state.
   *
   * @returns {ModeViewState}
   */
  getViewState() {
    return {
      nodes: this.getNodes(),
      connections: this.getConnections(),
      viewport: this.getViewport(),
      selection: this.getSelection(),
      modeSpecific: this._state
    };
  }

  /**
   * Set view state.
   *
   * @param {ModeViewState} viewState - View state to restore
   */
  setViewState(viewState) {
    if (viewState.viewport) {
      this.setViewport(viewState.viewport);
    }
    if (viewState.selection) {
      this.setSelection(viewState.selection);
    }
    if (viewState.modeSpecific) {
      this._state = { ...this._state, ...viewState.modeSpecific };
    }
  }

  /**
   * Get current viewport.
   *
   * @returns {Object} Viewport {x, y, zoom}
   */
  getViewport() {
    return {
      x: state.viewport?.x ?? 0,
      y: state.viewport?.y ?? 0,
      zoom: state.viewport?.zoom ?? 1
    };
  }

  /**
   * Set viewport.
   *
   * @param {Object} viewport - Viewport {x, y, zoom}
   */
  setViewport(viewport) {
    if (!state.viewport) state.viewport = {};
    if (viewport.x !== undefined) state.viewport.x = viewport.x;
    if (viewport.y !== undefined) state.viewport.y = viewport.y;
    if (viewport.zoom !== undefined) state.viewport.zoom = viewport.zoom;
  }

  /**
   * Get current selection.
   *
   * @returns {string[]} Selected node IDs
   */
  getSelection() {
    return state.selectedNodes || [];
  }

  /**
   * Set selection.
   *
   * @param {string[]} nodeIds - Node IDs to select
   */
  setSelection(nodeIds) {
    state.selectedNodes = nodeIds;
  }

  /**
   * Clear selection.
   */
  clearSelection() {
    state.selectedNodes = [];
  }

  // =========================================================================
  // Controls
  // =========================================================================

  /**
   * Get mode-specific controls configuration.
   * Override to provide custom controls for the mode toolbar.
   *
   * @returns {Object[]} Array of control definitions
   */
  getControls() {
    return [];
  }

  /**
   * Handle control action.
   *
   * @param {string} controlId - Control ID
   * @param {*} value - Control value
   */
  onControlAction(controlId, value) {
    // Override in subclass
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Trigger a render.
   * @protected
   */
  _triggerRender() {
    if (this._renderCallback) {
      this._renderCallback();
    }
  }

  /**
   * Trigger a save.
   * @protected
   */
  _triggerSave() {
    if (this._saveCallback) {
      this._saveCallback();
    }
  }

  /**
   * Get mode info.
   *
   * @returns {ModeConfig}
   */
  static getInfo() {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      description: this.description,
      supportsConnections: this.supportsConnections,
      supportsNodeCreation: this.supportsNodeCreation,
      supportsDragging: this.supportsDragging
    };
  }

  /**
   * Get instance info.
   *
   * @returns {ModeConfig}
   */
  getInfo() {
    return this.constructor.getInfo();
  }
}
