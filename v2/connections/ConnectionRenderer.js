/**
 * Connection Renderer
 *
 * Handles visual rendering of connections including:
 * - Bezier curve paths
 * - Connection labels
 * - Flow animations
 * - State-based styling (selected, hovered)
 *
 * @see ARCHITECTURE_PLAN.md Module 3 for full documentation
 */

import { state } from '../state.js';
import { findNode } from '../state.js';
import { portSystem } from '../core/PortSystem.js';
import { connectionTypeRegistry } from './types/ConnectionTypeRegistry.js';

/**
 * Connection Renderer class.
 */
export class ConnectionRenderer {
  constructor() {
    /**
     * SVG element for rendering connections.
     * @type {SVGElement|null}
     */
    this.svgElement = null;

    /**
     * Currently selected connection IDs.
     * @type {Set<string>}
     */
    this.selectedConnections = new Set();

    /**
     * Currently hovered connection ID.
     * @type {string|null}
     */
    this.hoveredConnection = null;

    /**
     * Temporary connection for drag preview.
     * @type {Object|null}
     */
    this.temporaryConnection = null;

    /**
     * Animation frame request ID.
     * @type {number|null}
     * @private
     */
    this._animationFrame = null;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the renderer.
   *
   * @param {SVGElement} svgElement - SVG element for rendering
   */
  init(svgElement) {
    this.svgElement = svgElement;
    this._setupDefs();
    console.log('ConnectionRenderer initialized');
  }

  /**
   * Setup SVG definitions (markers, gradients, etc.).
   * @private
   */
  _setupDefs() {
    if (!this.svgElement) return;

    // Clear existing defs
    let defs = this.svgElement.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgElement.appendChild(defs);
    }
    defs.innerHTML = '';

    // Create arrowhead markers for different colors
    const colors = {
      'default': '#666',
      'selected': '#2196f3',
      'data': '#3498db',
      'reference': '#666',
      'flow': '#27ae60',
      'error': '#e74c3c'
    };

    for (const [name, color] of Object.entries(colors)) {
      this._createArrowheadMarker(defs, `arrowhead-${name}`, color);
    }

    // Default arrowhead alias
    this._createArrowheadMarker(defs, 'arrowhead', '#666');
  }

  /**
   * Create an arrowhead marker.
   * @private
   */
  _createArrowheadMarker(defs, id, color) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', color);

    marker.appendChild(path);
    defs.appendChild(marker);
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render all connections.
   */
  render() {
    if (!this.svgElement) return;

    // Clear existing connections (except defs)
    const children = Array.from(this.svgElement.children);
    children.forEach(child => {
      if (child.tagName !== 'defs') {
        this.svgElement.removeChild(child);
      }
    });

    // Create a group for connections (behind labels)
    const pathGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pathGroup.setAttribute('class', 'connection-paths');

    // Create a group for labels (on top)
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'connection-labels');

    // Render each connection
    state.connections.forEach(connection => {
      const { path, label } = this._renderConnection(connection);
      if (path) pathGroup.appendChild(path);
      if (label) labelGroup.appendChild(label);
    });

    this.svgElement.appendChild(pathGroup);
    this.svgElement.appendChild(labelGroup);

    // Render temporary connection
    if (this.temporaryConnection) {
      this._renderTemporaryConnection();
    }
  }

  /**
   * Render a single connection.
   *
   * @param {Object} connection - Connection object
   * @returns {{path: SVGPathElement|null, label: SVGGElement|null}}
   * @private
   */
  _renderConnection(connection) {
    // Get nodes
    const fromNode = findNode(connection.from.nodeId);
    const toNode = findNode(connection.to.nodeId);

    if (!fromNode || !toNode) {
      return { path: null, label: null };
    }

    // Get ports
    const fromPort = portSystem.getPort(connection.from.nodeId, connection.from.portId);
    const toPort = portSystem.getPort(connection.to.nodeId, connection.to.portId);

    if (!fromPort || !toPort) {
      return { path: null, label: null };
    }

    // Calculate positions
    const fromPos = portSystem.calculatePortPosition(fromNode, fromPort);
    const toPos = portSystem.calculatePortPosition(toNode, toPort);

    // Get connection state
    const connectionState = {
      selected: this.selectedConnections.has(connection.id),
      hovered: this.hoveredConnection === connection.id
    };

    // Get style from type registry
    const style = connectionTypeRegistry.getStateStyle(connection, connectionState);

    // Create path
    const path = this._createPath(connection, fromPos, toPos, style);

    // Create label if needed
    const labelConfig = connectionTypeRegistry.getLabelConfig(connection);
    let label = null;
    if (labelConfig || connection.metadata?.label) {
      label = this._createLabel(
        connection,
        fromPos,
        toPos,
        labelConfig || { text: connection.metadata.label, position: 'middle' }
      );
    }

    // Add animation if needed
    const animConfig = connectionTypeRegistry.getAnimationConfig(connection);
    if (animConfig && style.animated !== false) {
      this._addAnimation(path, animConfig);
    }

    return { path, label };
  }

  /**
   * Create SVG path for connection.
   * @private
   */
  _createPath(connection, fromPos, toPos, style) {
    // Calculate bezier path
    const pathData = this._calculateBezierPath(fromPos, toPos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', style.stroke || '#666');
    path.setAttribute('stroke-width', style.strokeWidth || 2);
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'connection');
    path.dataset.connectionId = connection.id;

    // Dash array
    if (style.strokeDasharray) {
      path.setAttribute('stroke-dasharray', style.strokeDasharray);
    }

    // Arrowhead
    if (style.showArrow !== false) {
      const markerColor = this._getMarkerIdForColor(style.stroke);
      path.setAttribute('marker-end', `url(#${markerColor})`);
    }

    // Generate unique ID for animation reference
    path.id = `conn-path-${connection.id}`;

    return path;
  }

  /**
   * Get marker ID for a color.
   * @private
   */
  _getMarkerIdForColor(color) {
    // Map common colors to predefined markers
    const colorMap = {
      '#2196f3': 'arrowhead-selected',
      '#3498db': 'arrowhead-data',
      '#27ae60': 'arrowhead-flow',
      '#e74c3c': 'arrowhead-error',
      '#666': 'arrowhead-default'
    };
    return colorMap[color] || 'arrowhead';
  }

  /**
   * Create label element for connection.
   * @private
   */
  _createLabel(connection, fromPos, toPos, config) {
    if (!config.text) return null;

    // Calculate label position on path
    const labelPos = this._getLabelPosition(fromPos, toPos, config.position || 'middle');

    // Create group for label
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'connection-label');
    group.dataset.connectionId = connection.id;

    // Create background rectangle
    const padding = 4;
    const fontSize = config.fontSize || 12;
    const text = config.text;
    const textWidth = text.length * (fontSize * 0.6); // Approximate width

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', labelPos.x - textWidth / 2 - padding);
    bg.setAttribute('y', labelPos.y - fontSize / 2 - padding);
    bg.setAttribute('width', textWidth + padding * 2);
    bg.setAttribute('height', fontSize + padding * 2);
    bg.setAttribute('fill', config.background || 'rgba(255, 255, 255, 0.9)');
    bg.setAttribute('rx', '3');
    bg.setAttribute('ry', '3');
    group.appendChild(bg);

    // Create text element
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', labelPos.x);
    textEl.setAttribute('y', labelPos.y + fontSize / 3); // Adjust for baseline
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', fontSize);
    textEl.setAttribute('font-family', config.fontFamily || 'system-ui, sans-serif');
    textEl.setAttribute('fill', '#333');
    textEl.textContent = text;
    group.appendChild(textEl);

    return group;
  }

  /**
   * Calculate label position on connection path.
   * @private
   */
  _getLabelPosition(fromPos, toPos, position) {
    // Apply viewport offset
    const from = {
      x: fromPos.x + state.viewport.x,
      y: fromPos.y + state.viewport.y
    };
    const to = {
      x: toPos.x + state.viewport.x,
      y: toPos.y + state.viewport.y
    };

    let t;
    switch (position) {
      case 'start':
        t = 0.2;
        break;
      case 'end':
        t = 0.8;
        break;
      case 'middle':
      default:
        t = 0.5;
    }

    // Calculate point on bezier curve
    // For simplicity, use linear interpolation (works well for most cases)
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t
    };
  }

  /**
   * Add flow animation to path.
   * @private
   */
  _addAnimation(path, config) {
    if (!config) return;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', config.dotRadius || 4);
    circle.setAttribute('fill', config.dotColor || '#2196f3');

    const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    animateMotion.setAttribute('dur', config.duration || '2s');
    animateMotion.setAttribute('repeatCount', 'indefinite');

    const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + path.id);

    animateMotion.appendChild(mpath);
    circle.appendChild(animateMotion);

    // Add circle after the path
    path.parentNode?.appendChild(circle);
  }

  /**
   * Calculate bezier path between two points.
   * @private
   */
  _calculateBezierPath(fromPos, toPos) {
    const from = {
      x: fromPos.x + state.viewport.x,
      y: fromPos.y + state.viewport.y,
      orientation: fromPos.orientation,
      side: fromPos.side
    };

    const to = {
      x: toPos.x + state.viewport.x,
      y: toPos.y + state.viewport.y,
      orientation: toPos.orientation,
      side: toPos.side
    };

    // Calculate distance
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Handle distance for control points
    const baseHandleDistance = Math.min(distance * 0.5, 150);
    const handleDistance = Math.max(baseHandleDistance, 50);

    // Calculate control points
    const cp1 = this._calculateControlPoint(from, handleDistance, 'out');
    const cp2 = this._calculateControlPoint(to, handleDistance, 'in');

    return `M ${from.x},${from.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${to.x},${to.y}`;
  }

  /**
   * Calculate control point for bezier curve.
   * @private
   */
  _calculateControlPoint(port, distance, direction) {
    const multiplier = direction === 'out' ? 1 : -1;
    let dx = 0;
    let dy = 0;

    if (port.orientation === 'horizontal') {
      dx = port.side === 'right' ? distance * multiplier : -distance * multiplier;
    } else {
      dy = port.side === 'bottom' ? distance * multiplier : -distance * multiplier;
    }

    return {
      x: port.x + dx,
      y: port.y + dy
    };
  }

  // =========================================================================
  // Temporary Connection (Drag Preview)
  // =========================================================================

  /**
   * Set temporary connection for drag preview.
   *
   * @param {Object} fromNode - Source node
   * @param {Object} fromPort - Source port
   * @param {number} toX - Mouse X position
   * @param {number} toY - Mouse Y position
   */
  setTemporaryConnection(fromNode, fromPort, toX, toY) {
    this.temporaryConnection = { fromNode, fromPort, toX, toY };
  }

  /**
   * Clear temporary connection.
   */
  clearTemporaryConnection() {
    this.temporaryConnection = null;
  }

  /**
   * Render temporary connection.
   * @private
   */
  _renderTemporaryConnection() {
    if (!this.temporaryConnection || !this.svgElement) return;

    const { fromNode, fromPort, toX, toY } = this.temporaryConnection;
    const fromPos = portSystem.calculatePortPosition(fromNode, fromPort);

    // Create fake target port at mouse position
    const toPos = {
      x: toX - state.viewport.x,
      y: toY - state.viewport.y,
      orientation: 'horizontal',
      side: 'left'
    };

    const pathData = this._calculateBezierPath(fromPos, toPos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#2196f3');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('class', 'temporary-connection');

    this.svgElement.appendChild(path);
  }

  // =========================================================================
  // Selection & Hover
  // =========================================================================

  /**
   * Set selected connections.
   *
   * @param {string[]} connectionIds - Connection IDs
   */
  setSelected(connectionIds) {
    this.selectedConnections = new Set(connectionIds);
  }

  /**
   * Add to selection.
   *
   * @param {string} connectionId - Connection ID
   */
  addToSelection(connectionId) {
    this.selectedConnections.add(connectionId);
  }

  /**
   * Remove from selection.
   *
   * @param {string} connectionId - Connection ID
   */
  removeFromSelection(connectionId) {
    this.selectedConnections.delete(connectionId);
  }

  /**
   * Clear selection.
   */
  clearSelection() {
    this.selectedConnections.clear();
  }

  /**
   * Set hovered connection.
   *
   * @param {string|null} connectionId - Connection ID or null
   */
  setHovered(connectionId) {
    this.hoveredConnection = connectionId;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Find connection element by ID.
   *
   * @param {string} connectionId - Connection ID
   * @returns {SVGPathElement|null}
   */
  getConnectionElement(connectionId) {
    return this.svgElement?.querySelector(`[data-connection-id="${connectionId}"]`) || null;
  }

  /**
   * Find connection at a point.
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} [threshold=10] - Distance threshold
   * @returns {string|null} Connection ID or null
   */
  findConnectionAtPoint(x, y, threshold = 10) {
    // Get all connection paths
    const paths = this.svgElement?.querySelectorAll('.connection') || [];

    for (const path of paths) {
      const pathLength = path.getTotalLength();
      const steps = Math.max(10, Math.floor(pathLength / 10));

      for (let i = 0; i <= steps; i++) {
        const point = path.getPointAtLength((i / steps) * pathLength);
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < threshold) {
          return path.dataset.connectionId;
        }
      }
    }

    return null;
  }
}

/**
 * Singleton ConnectionRenderer instance.
 * @type {ConnectionRenderer}
 */
export const connectionRenderer = new ConnectionRenderer();
