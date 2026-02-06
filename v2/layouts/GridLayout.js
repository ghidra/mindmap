/**
 * Grid Layout Algorithm
 *
 * Positions nodes in a grid pattern.
 * Useful for notes, free-form diagrams, and uniform spacing.
 *
 * @see ARCHITECTURE_PLAN.md Module 5.6 for full documentation
 */

/**
 * @typedef {Object} GridLayoutConfig
 * @property {number} [columns=4] - Number of columns (auto-calculated if not set)
 * @property {number} [cellWidth=200] - Width of each grid cell
 * @property {number} [cellHeight=120] - Height of each grid cell
 * @property {number} [horizontalSpacing=20] - Horizontal spacing between cells
 * @property {number} [verticalSpacing=20] - Vertical spacing between cells
 * @property {number} [startX=50] - Starting X position
 * @property {number} [startY=50] - Starting Y position
 * @property {boolean} [autoColumns=true] - Auto-calculate columns based on count
 */

/**
 * Grid Layout class.
 * Positions nodes in a uniform grid pattern.
 */
export class GridLayout {
  /**
   * Create a new GridLayout instance.
   *
   * @param {GridLayoutConfig} [config]
   */
  constructor(config = {}) {
    this.columns = config.columns || 4;
    this.cellWidth = config.cellWidth || 200;
    this.cellHeight = config.cellHeight || 120;
    this.horizontalSpacing = config.horizontalSpacing || 20;
    this.verticalSpacing = config.verticalSpacing || 20;
    this.startX = config.startX || 50;
    this.startY = config.startY || 50;
    this.autoColumns = config.autoColumns !== false;
  }

  /**
   * Apply grid layout to nodes.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {Object} [options] - Layout options
   */
  layout(nodes, options = {}) {
    if (!nodes || nodes.length === 0) {
      return;
    }

    const columns = this.calculateColumns(nodes.length, options);
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';

    console.log(`GridLayout: Positioning ${nodes.length} nodes in ${columns} columns...`);

    nodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      node[xProp] = startX + col * (this.cellWidth + this.horizontalSpacing);
      node[yProp] = startY + row * (this.cellHeight + this.verticalSpacing);
    });

    console.log(`GridLayout: Layout complete`);
  }

  /**
   * Calculate number of columns based on node count.
   *
   * @param {number} nodeCount - Number of nodes
   * @param {Object} [options] - Layout options
   * @returns {number} Number of columns
   */
  calculateColumns(nodeCount, options = {}) {
    if (options.columns) {
      return options.columns;
    }

    if (this.autoColumns) {
      // Auto-calculate for a roughly square layout
      return Math.ceil(Math.sqrt(nodeCount));
    }

    return this.columns;
  }

  /**
   * Layout nodes in a masonry-style pattern.
   * Places each node in the shortest column.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {Object} [options] - Layout options
   */
  layoutMasonry(nodes, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const columns = options.columns ?? this.columns;
    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const widthProp = options.widthProp || 'width';
    const heightProp = options.heightProp || 'height';

    // Track height of each column
    const columnHeights = new Array(columns).fill(0);

    console.log(`GridLayout: Applying masonry layout with ${columns} columns...`);

    nodes.forEach(node => {
      // Find the shortest column
      let shortestCol = 0;
      let minHeight = columnHeights[0];

      for (let i = 1; i < columns; i++) {
        if (columnHeights[i] < minHeight) {
          minHeight = columnHeights[i];
          shortestCol = i;
        }
      }

      // Position node
      const x = startX + shortestCol * (this.cellWidth + this.horizontalSpacing);
      const y = startY + columnHeights[shortestCol];

      node[xProp] = x;
      node[yProp] = y;

      // Update column height
      const nodeHeight = node[heightProp] || this.cellHeight;
      columnHeights[shortestCol] += nodeHeight + this.verticalSpacing;
    });

    console.log(`GridLayout: Masonry layout complete`);
  }

  /**
   * Layout nodes in a horizontal row.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {Object} [options] - Layout options
   */
  layoutRow(nodes, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const widthProp = options.widthProp || 'width';

    let currentX = startX;

    nodes.forEach(node => {
      node[xProp] = currentX;
      node[yProp] = startY;

      const nodeWidth = node[widthProp] || this.cellWidth;
      currentX += nodeWidth + this.horizontalSpacing;
    });

    console.log(`GridLayout: Row layout complete`);
  }

  /**
   * Layout nodes in a vertical column.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {Object} [options] - Layout options
   */
  layoutColumn(nodes, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const startX = options.startX ?? this.startX;
    const startY = options.startY ?? this.startY;
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';
    const heightProp = options.heightProp || 'height';

    let currentY = startY;

    nodes.forEach(node => {
      node[xProp] = startX;
      node[yProp] = currentY;

      const nodeHeight = node[heightProp] || this.cellHeight;
      currentY += nodeHeight + this.verticalSpacing;
    });

    console.log(`GridLayout: Column layout complete`);
  }

  /**
   * Layout nodes centered around a point.
   *
   * @param {Array} nodes - Nodes to layout
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {Object} [options] - Layout options
   */
  layoutCentered(nodes, centerX, centerY, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const columns = this.calculateColumns(nodes.length, options);
    const rows = Math.ceil(nodes.length / columns);
    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';

    // Calculate total grid size
    const totalWidth = columns * this.cellWidth + (columns - 1) * this.horizontalSpacing;
    const totalHeight = rows * this.cellHeight + (rows - 1) * this.verticalSpacing;

    // Calculate offset to center
    const startX = centerX - totalWidth / 2;
    const startY = centerY - totalHeight / 2;

    // Apply layout
    nodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      node[xProp] = startX + col * (this.cellWidth + this.horizontalSpacing);
      node[yProp] = startY + row * (this.cellHeight + this.verticalSpacing);
    });

    console.log(`GridLayout: Centered layout complete around (${centerX}, ${centerY})`);
  }

  /**
   * Calculate bounds of the grid layout.
   *
   * @param {number} nodeCount - Number of nodes
   * @param {Object} [options] - Layout options
   * @returns {{width: number, height: number, columns: number, rows: number}}
   */
  calculateBounds(nodeCount, options = {}) {
    const columns = this.calculateColumns(nodeCount, options);
    const rows = Math.ceil(nodeCount / columns);

    const width = columns * this.cellWidth + (columns - 1) * this.horizontalSpacing;
    const height = rows * this.cellHeight + (rows - 1) * this.verticalSpacing;

    return { width, height, columns, rows };
  }

  /**
   * Get configuration.
   *
   * @returns {GridLayoutConfig}
   */
  getConfig() {
    return {
      columns: this.columns,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      horizontalSpacing: this.horizontalSpacing,
      verticalSpacing: this.verticalSpacing,
      startX: this.startX,
      startY: this.startY,
      autoColumns: this.autoColumns
    };
  }

  /**
   * Update configuration.
   *
   * @param {Partial<GridLayoutConfig>} config
   */
  setConfig(config) {
    Object.assign(this, config);
  }
}
