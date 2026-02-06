/**
 * Hierarchical Mode
 *
 * Tree-like visualization of code structure.
 * Nodes are navigated via path-based drill-down.
 *
 * Features:
 * - Path-based navigation (click into directories/files)
 * - Breadcrumb trail showing current location
 * - Standard x/y positioning
 * - Support for tree layout algorithms
 *
 * @see ARCHITECTURE_PLAN.md Module 5 for full documentation
 */

import { BaseMode } from '../BaseMode.js';
import { state, save, findNode } from '../../state.js';

/**
 * Hierarchical Mode class.
 */
export class HierarchicalMode extends BaseMode {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'hierarchical';
  static name = 'Hierarchical';
  static icon = '🌳';
  static description = 'Tree-like navigation of code structure';
  static supportsConnections = true;
  static supportsNodeCreation = true;
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
     * Navigation path (node IDs).
     * @type {string[]}
     */
    this._path = [];

    /**
     * Navigation callback.
     * @type {Function|null}
     */
    this._navigationCallback = null;
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  async onEnter(previousMode) {
    await super.onEnter(previousMode);

    // Sync path from global state
    this._path = state.path || [];

    console.log(`HierarchicalMode: Entered with path depth ${this._path.length}`);
  }

  async onExit(nextMode) {
    // Sync path back to global state
    state.path = this._path;

    await super.onExit(nextMode);
  }

  onActivate() {
    super.onActivate();
    // Could set up keyboard shortcuts specific to hierarchical mode
  }

  onDeactivate() {
    super.onDeactivate();
    // Clean up any hierarchical-specific event handlers
  }

  // =========================================================================
  // Node Methods
  // =========================================================================

  /**
   * Get nodes at current path level.
   *
   * @returns {Array}
   */
  getNodes() {
    // Navigate through path to get current nodes
    return this._path.reduce(
      (nodes, id) => {
        const node = nodes.find(n => n.id === id);
        return node?.children ?? nodes;
      },
      state.nodes
    );
  }

  /**
   * Get a node by ID.
   *
   * @param {string} nodeId - Node ID
   * @returns {Object|null}
   */
  getNodeById(nodeId) {
    return findNode(nodeId);
  }

  /**
   * Add a node at current path level.
   *
   * @param {Object} node - Node to add
   * @param {Object} [options] - Options
   * @returns {Object} Added node
   */
  addNode(node, options = {}) {
    // If we're inside a node (path has items), add as child
    if (this._path.length > 0) {
      const parentId = this._path[this._path.length - 1];
      const parentNode = findNode(parentId);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        node.parentId = parentId;
        node.parent = parentNode;
        parentNode.children.push(node);
        this._triggerSave();
        return node;
      }
    }

    // Otherwise add to root
    state.nodes.push(node);
    this._triggerSave();
    return node;
  }

  /**
   * Remove a node.
   *
   * @param {string} nodeId - Node ID to remove
   * @returns {boolean}
   */
  removeNode(nodeId) {
    // Try to remove from current level first
    const currentNodes = this.getNodes();
    const index = currentNodes.findIndex(n => n.id === nodeId);

    if (index !== -1) {
      currentNodes.splice(index, 1);

      // Remove any connections involving this node
      state.connections = state.connections.filter(
        conn => conn.from.nodeId !== nodeId && conn.to.nodeId !== nodeId
      );

      // If this node is in our path, navigate up
      const pathIndex = this._path.indexOf(nodeId);
      if (pathIndex !== -1) {
        this._path = this._path.slice(0, pathIndex);
        state.path = this._path;
      }

      this._triggerSave();
      return true;
    }

    return false;
  }

  // =========================================================================
  // Navigation
  // =========================================================================

  /**
   * Get current navigation path.
   *
   * @returns {string[]} Array of node IDs
   */
  getPath() {
    return [...this._path];
  }

  /**
   * Get path as display-friendly breadcrumb.
   *
   * @returns {Array<{id: string, title: string}>}
   */
  getBreadcrumb() {
    const breadcrumb = [];
    let nodes = state.nodes;

    for (const nodeId of this._path) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        breadcrumb.push({
          id: node.id,
          title: node.title || node.name || 'Untitled'
        });
        nodes = node.children || [];
      }
    }

    return breadcrumb;
  }

  /**
   * Navigate into a node (add to path).
   *
   * @param {string} nodeId - Node ID to navigate into
   * @returns {boolean} Whether navigation succeeded
   */
  navigateInto(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return false;

    // Only navigate if node has children
    if (!node.children || node.children.length === 0) {
      console.log(`HierarchicalMode: Node ${nodeId} has no children to navigate into`);
      return false;
    }

    this._path.push(nodeId);
    state.path = this._path;

    this._notifyNavigation();
    this._triggerRender();
    this._triggerSave();

    console.log(`HierarchicalMode: Navigated into ${node.title || nodeId}`);
    return true;
  }

  /**
   * Navigate up one level.
   *
   * @returns {boolean} Whether navigation succeeded
   */
  navigateUp() {
    if (this._path.length === 0) {
      return false;
    }

    const removedId = this._path.pop();
    state.path = this._path;

    this._notifyNavigation();
    this._triggerRender();
    this._triggerSave();

    console.log(`HierarchicalMode: Navigated up from ${removedId}`);
    return true;
  }

  /**
   * Navigate to a specific path index.
   *
   * @param {number} index - Path index to navigate to (-1 for root)
   * @returns {boolean}
   */
  navigateToIndex(index) {
    if (index < -1 || index >= this._path.length) {
      return false;
    }

    if (index === -1) {
      this._path = [];
    } else {
      this._path = this._path.slice(0, index + 1);
    }
    state.path = this._path;

    this._notifyNavigation();
    this._triggerRender();
    this._triggerSave();

    return true;
  }

  /**
   * Navigate to root.
   *
   * @returns {boolean}
   */
  navigateToRoot() {
    return this.navigateToIndex(-1);
  }

  /**
   * Set navigation callback.
   *
   * @param {Function} callback - Called when navigation changes
   */
  setNavigationCallback(callback) {
    this._navigationCallback = callback;
  }

  /**
   * Notify navigation change.
   * @private
   */
  _notifyNavigation() {
    if (this._navigationCallback) {
      try {
        this._navigationCallback({
          path: this.getPath(),
          breadcrumb: this.getBreadcrumb()
        });
      } catch (e) {
        console.error('HierarchicalMode: Navigation callback error:', e);
      }
    }
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Handle double-click on a node.
   * In hierarchical mode, double-click navigates into the node.
   *
   * @param {Object} node - Clicked node
   * @param {Event} event - Click event
   */
  onNodeDoubleClick(node, event) {
    // Navigate into node if it has children
    if (node.children && node.children.length > 0) {
      this.navigateInto(node.id);
    }
  }

  /**
   * Handle keyboard event.
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean} Whether event was handled
   */
  onKeyDown(event) {
    // Backspace or Escape to go up
    if (event.key === 'Backspace' || event.key === 'Escape') {
      if (this._path.length > 0) {
        this.navigateUp();
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // Position Methods
  // =========================================================================

  /**
   * Get position property names for hierarchical mode.
   *
   * @returns {{x: string, y: string}}
   */
  getPositionProperties() {
    return { x: 'x', y: 'y' };
  }

  // =========================================================================
  // Layout Methods
  // =========================================================================

  /**
   * Apply tree layout to current nodes.
   *
   * @param {Object} [options] - Layout options
   * @param {string} [options.direction] - 'horizontal' or 'vertical'
   * @param {number} [options.spacing] - Node spacing
   */
  applyLayout(options = {}) {
    const nodes = this.getNodes();
    if (nodes.length === 0) return;

    const direction = options.direction || 'horizontal';
    const hSpacing = options.hSpacing || 200;
    const vSpacing = options.vSpacing || 100;
    const startX = options.startX || 100;
    const startY = options.startY || 100;

    if (direction === 'horizontal') {
      this._applyHorizontalTreeLayout(nodes, startX, startY, hSpacing, vSpacing);
    } else {
      this._applyVerticalTreeLayout(nodes, startX, startY, hSpacing, vSpacing);
    }

    this._triggerRender();
    this._triggerSave();
  }

  /**
   * Apply horizontal tree layout (children to the right).
   * @private
   */
  _applyHorizontalTreeLayout(nodes, startX, startY, hSpacing, vSpacing) {
    let y = startY;

    const layoutNode = (node, x, depth = 0) => {
      node.x = x;
      node.y = y;
      y += vSpacing;

      if (node.children && node.children.length > 0) {
        const childX = x + hSpacing;
        for (const child of node.children) {
          layoutNode(child, childX, depth + 1);
        }
      }
    };

    for (const node of nodes) {
      layoutNode(node, startX);
    }
  }

  /**
   * Apply vertical tree layout (children below).
   * @private
   */
  _applyVerticalTreeLayout(nodes, startX, startY, hSpacing, vSpacing) {
    const layoutLevel = (nodeList, x, y, depth = 0) => {
      let currentX = x;

      for (const node of nodeList) {
        // Calculate width needed for this subtree
        const subtreeWidth = this._getSubtreeWidth(node, hSpacing);

        // Position this node in the center of its subtree
        node.x = currentX + subtreeWidth / 2 - hSpacing / 2;
        node.y = y;

        // Layout children
        if (node.children && node.children.length > 0) {
          layoutLevel(node.children, currentX, y + vSpacing, depth + 1);
        }

        currentX += subtreeWidth;
      }
    };

    layoutLevel(nodes, startX, startY);
  }

  /**
   * Get width needed for a node's subtree.
   * @private
   */
  _getSubtreeWidth(node, spacing) {
    if (!node.children || node.children.length === 0) {
      return spacing;
    }

    let width = 0;
    for (const child of node.children) {
      width += this._getSubtreeWidth(child, spacing);
    }

    return Math.max(width, spacing);
  }

  /**
   * Get layout configuration.
   *
   * @returns {Object}
   */
  getLayoutConfig() {
    return {
      type: 'tree',
      directions: ['horizontal', 'vertical'],
      defaultDirection: 'horizontal',
      spacing: {
        horizontal: 200,
        vertical: 100
      }
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
    return [
      {
        id: 'navigate-up',
        type: 'button',
        label: '↑ Up',
        icon: '⬆️',
        disabled: this._path.length === 0,
        action: () => this.navigateUp()
      },
      {
        id: 'navigate-root',
        type: 'button',
        label: 'Root',
        icon: '🏠',
        disabled: this._path.length === 0,
        action: () => this.navigateToRoot()
      },
      {
        id: 'layout-tree',
        type: 'button',
        label: 'Auto Layout',
        icon: '🌳',
        action: () => this.applyLayout()
      }
    ];
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
  // Utility
  // =========================================================================

  /**
   * Get current depth (path length).
   *
   * @returns {number}
   */
  getDepth() {
    return this._path.length;
  }

  /**
   * Get parent node of current level.
   *
   * @returns {Object|null}
   */
  getParentNode() {
    if (this._path.length === 0) return null;
    return findNode(this._path[this._path.length - 1]);
  }
}
