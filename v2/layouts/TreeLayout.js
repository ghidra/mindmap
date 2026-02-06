/**
 * Tree Layout Algorithm
 *
 * Positions nodes in a tree structure.
 * Supports horizontal (children right) and vertical (children below) layouts.
 *
 * @see ARCHITECTURE_PLAN.md Module 5.6 for full documentation
 */

/**
 * @typedef {Object} TreeLayoutConfig
 * @property {number} [nodeWidth=150] - Default node width
 * @property {number} [nodeHeight=60] - Default node height
 * @property {number} [horizontalSpacing=200] - Horizontal spacing between siblings
 * @property {number} [verticalSpacing=100] - Vertical spacing between levels
 * @property {number} [startX=100] - Starting X position
 * @property {number} [startY=100] - Starting Y position
 * @property {'horizontal'|'vertical'} [direction='horizontal'] - Layout direction
 */

/**
 * Tree Layout class.
 * Positions nodes in a hierarchical tree structure.
 */
export class TreeLayout {
  /**
   * Create a new TreeLayout instance.
   *
   * @param {TreeLayoutConfig} [config]
   */
  constructor(config = {}) {
    this.nodeWidth = config.nodeWidth || 150;
    this.nodeHeight = config.nodeHeight || 60;
    this.horizontalSpacing = config.horizontalSpacing || 200;
    this.verticalSpacing = config.verticalSpacing || 100;
    this.startX = config.startX || 100;
    this.startY = config.startY || 100;
    this.direction = config.direction || 'horizontal';
  }

  /**
   * Apply layout to a flat list of nodes.
   *
   * @param {Array} nodes - Array of nodes (flat, siblings at current level)
   * @param {Object} [options] - Layout options
   */
  layout(nodes, options = {}) {
    if (!nodes || nodes.length === 0) {
      return;
    }

    const direction = options.direction || this.direction;
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;

    console.log(`TreeLayout: Applying ${direction} layout to ${nodes.length} nodes...`);

    if (direction === 'horizontal') {
      this.layoutHorizontal(nodes, startX, startY, options);
    } else {
      this.layoutVertical(nodes, startX, startY, options);
    }
  }

  /**
   * Apply horizontal tree layout (children to the right).
   *
   * @param {Array} nodes - Nodes to layout
   * @param {number} startX - Starting X
   * @param {number} startY - Starting Y
   * @param {Object} [options] - Layout options
   */
  layoutHorizontal(nodes, startX, startY, options = {}) {
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const vSpacing = options.verticalSpacing ?? this.verticalSpacing;
    const hSpacing = options.horizontalSpacing ?? this.horizontalSpacing;

    let currentY = startY;

    const layoutNode = (node, x) => {
      node[xProp] = x;
      node[yProp] = currentY;
      currentY += vSpacing;

      // Layout children
      if (node.children && node.children.length > 0) {
        const childX = x + hSpacing;
        for (const child of node.children) {
          layoutNode(child, childX);
        }
      }
    };

    for (const node of nodes) {
      layoutNode(node, startX);
    }
  }

  /**
   * Apply vertical tree layout (children below, centered).
   *
   * @param {Array} nodes - Nodes to layout
   * @param {number} startX - Starting X
   * @param {number} startY - Starting Y
   * @param {Object} [options] - Layout options
   */
  layoutVertical(nodes, startX, startY, options = {}) {
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const vSpacing = options.verticalSpacing ?? this.verticalSpacing;
    const hSpacing = options.horizontalSpacing ?? this.horizontalSpacing;

    const layoutLevel = (nodeList, x, y, depth = 0) => {
      let currentX = x;

      for (const node of nodeList) {
        // Calculate width needed for this subtree
        const subtreeWidth = this.calculateSubtreeWidth(node, hSpacing);

        // Position node in center of its subtree
        node[xProp] = currentX + subtreeWidth / 2 - hSpacing / 2;
        node[yProp] = y;

        // Layout children below
        if (node.children && node.children.length > 0) {
          layoutLevel(node.children, currentX, y + vSpacing, depth + 1);
        }

        currentX += subtreeWidth;
      }
    };

    layoutLevel(nodes, startX, startY);
  }

  /**
   * Calculate the width needed for a node's subtree.
   *
   * @param {Object} node - Node to calculate for
   * @param {number} spacing - Spacing between nodes
   * @returns {number} Subtree width
   */
  calculateSubtreeWidth(node, spacing) {
    if (!node.children || node.children.length === 0) {
      return spacing;
    }

    let width = 0;
    for (const child of node.children) {
      width += this.calculateSubtreeWidth(child, spacing);
    }

    return Math.max(width, spacing);
  }

  /**
   * Layout tree with computed positions based on subtree sizes.
   * More sophisticated layout that balances the tree.
   *
   * @param {Array} nodes - Root nodes
   * @param {Object} [options] - Layout options
   */
  layoutBalanced(nodes, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const vSpacing = options.verticalSpacing ?? this.verticalSpacing;
    const hSpacing = options.horizontalSpacing ?? this.horizontalSpacing;

    // First pass: calculate subtree widths
    const calculateWidth = (node) => {
      if (!node.children || node.children.length === 0) {
        node._subtreeWidth = this.nodeWidth;
        return node._subtreeWidth;
      }

      let width = 0;
      for (const child of node.children) {
        width += calculateWidth(child);
        if (child !== node.children[node.children.length - 1]) {
          width += hSpacing;
        }
      }

      node._subtreeWidth = Math.max(width, this.nodeWidth);
      return node._subtreeWidth;
    };

    // Second pass: assign positions
    const assignPositions = (nodeList, x, y) => {
      let currentX = x;

      for (const node of nodeList) {
        const subtreeWidth = node._subtreeWidth || this.nodeWidth;

        // Center node in its subtree
        node[xProp] = currentX + (subtreeWidth - this.nodeWidth) / 2;
        node[yProp] = y;

        // Position children
        if (node.children && node.children.length > 0) {
          assignPositions(node.children, currentX, y + vSpacing);
        }

        currentX += subtreeWidth + hSpacing;
      }
    };

    // Calculate widths for all nodes
    for (const node of nodes) {
      calculateWidth(node);
    }

    // Assign positions
    assignPositions(nodes, startX, startY);

    // Cleanup temporary properties
    const cleanup = (nodeList) => {
      for (const node of nodeList) {
        delete node._subtreeWidth;
        if (node.children) cleanup(node.children);
      }
    };
    cleanup(nodes);

    console.log(`TreeLayout: Balanced layout complete for ${nodes.length} root nodes`);
  }

  /**
   * Layout nodes in an indented list format.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {Object} [options] - Layout options
   */
  layoutIndented(nodes, options = {}) {
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const indentSize = options.indentSize || 30;
    const rowHeight = options.rowHeight || this.verticalSpacing;

    let currentY = startY;

    const layoutRecursive = (nodeList, depth = 0) => {
      for (const node of nodeList) {
        node[xProp] = startX + depth * indentSize;
        node[yProp] = currentY;
        currentY += rowHeight;

        if (node.children && node.children.length > 0) {
          layoutRecursive(node.children, depth + 1);
        }
      }
    };

    layoutRecursive(nodes);

    console.log(`TreeLayout: Indented layout complete`);
  }

  /**
   * Get configuration.
   *
   * @returns {TreeLayoutConfig}
   */
  getConfig() {
    return {
      nodeWidth: this.nodeWidth,
      nodeHeight: this.nodeHeight,
      horizontalSpacing: this.horizontalSpacing,
      verticalSpacing: this.verticalSpacing,
      startX: this.startX,
      startY: this.startY,
      direction: this.direction
    };
  }

  /**
   * Update configuration.
   *
   * @param {Partial<TreeLayoutConfig>} config
   */
  setConfig(config) {
    Object.assign(this, config);
  }
}
