/**
 * Node Renderer - Modular component-based rendering system
 * Handles rendering all node types using a consistent pipeline
 */

import { nodeTypeRegistry } from '../node-types/NodeTypeRegistry.js';
import { portSystem } from './PortSystem.js';
import { state } from '../state.js';

export class NodeRenderer {
  constructor() {
    this.registry = nodeTypeRegistry;
    this.portManager = portSystem;
    this.renderedNodes = new Map(); // Track rendered node elements
  }

  /**
   * Render a node to the DOM
   * @param {Object} node - Node instance
   * @param {HTMLElement} container - Container element
   * @returns {HTMLElement} Rendered node element
   */
  render(node, container) {
    // Get or create node element
    let nodeEl = this.renderedNodes.get(node.id);

    if (!nodeEl) {
      nodeEl = this.createNodeElement(node);
      this.renderedNodes.set(node.id, nodeEl);
    } else {
      // Clear existing content for re-render
      nodeEl.innerHTML = '';
      // Update classes
      nodeEl.className = this.getNodeClasses(node);
    }

    // Modular rendering pipeline
    this.renderBackground(node, nodeEl);
    this.renderHeader(node, nodeEl);
    this.renderContent(node, nodeEl);
    this.renderPorts(node, nodeEl);
    this.renderControls(node, nodeEl);

    // Position the node
    this.positionNode(node, nodeEl);

    // Append to container if not already present
    if (!nodeEl.parentElement) {
      container.appendChild(nodeEl);
    }

    return nodeEl;
  }

  /**
   * Create the base node element
   * @param {Object} node - Node instance
   * @returns {HTMLElement}
   */
  createNodeElement(node) {
    const el = document.createElement('div');
    el.className = this.getNodeClasses(node);
    el.dataset.id = node.id;
    el.dataset.type = node.type;
    return el;
  }

  /**
   * Get CSS classes for a node
   * @param {Object} node - Node instance
   * @returns {string} Space-separated class names
   */
  getNodeClasses(node) {
    const classes = ['node'];

    // Type-specific class
    if (node.type) {
      classes.push(`node-type-${node.type}`);
    }

    // Selection state
    if (state.selectedNodes.includes(node.id)) {
      classes.push('selected');
    }

    // Group membership
    if (node.containedIn) {
      classes.push('in-group');
    }

    // Custom classes from node
    if (node.cssClass) {
      classes.push(node.cssClass);
    }

    return classes.join(' ');
  }

  /**
   * Position the node element
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  positionNode(node, el) {
    const x = node.position?.x ?? node.x ?? 0;
    const y = node.position?.y ?? node.y ?? 0;
    const width = node.size?.width ?? node.width ?? node.style?.width ?? 180;
    const height = node.size?.height ?? node.height ?? node.style?.height ?? 100;

    el.style.position = 'absolute';
    el.style.left = `${x + state.viewport.x}px`;
    el.style.top = `${y + state.viewport.y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    // Groups should be rendered behind other nodes
    if (node.type === 'group') {
      el.style.zIndex = '0';
    } else if (node.containedIn) {
      // Nodes in groups should be above the group
      el.style.zIndex = '1';
    } else {
      el.style.zIndex = '1';
    }
  }

  /**
   * Render node background
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderBackground(node, el) {
    const style = node.style || {};
    const typeDef = this.registry.get(node.type);
    const defaultStyle = typeDef?.defaultStyle || {};

    // Apply styles
    el.style.backgroundColor = style.color || defaultStyle.color || '#ffffff';
    el.style.borderColor = style.borderColor || defaultStyle.borderColor || '#cccccc';
    el.style.borderWidth = `${style.borderWidth || defaultStyle.borderWidth || 1}px`;
    el.style.borderStyle = 'solid';
    el.style.borderRadius = `${style.borderRadius || defaultStyle.borderRadius || 4}px`;
    el.style.boxShadow = style.boxShadow || '0 2px 4px rgba(0,0,0,0.1)';
  }

  /**
   * Render node header
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderHeader(node, el) {
    const typeDef = this.registry.get(node.type);
    const header = document.createElement('div');
    header.className = 'node-header';

    // Icon (skip for text nodes to keep them minimal)
    if (typeDef?.icon && node.type !== 'text') {
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.textContent = typeDef.icon;
      header.appendChild(icon);
    }

    // Title (editable)
    const title = document.createElement('div');
    title.className = 'node-title';
    title.contentEditable = 'true';
    title.textContent = node.title || typeDef?.name || 'Untitled';
    title.dataset.nodeId = node.id;

    // Apply text styling for text nodes
    if (node.type === 'text') {
      title.style.fontSize = node.fontSize ? `${node.fontSize}px` : '16px';
      title.style.color = node.textColor || '#ffffff';
      title.style.fontWeight = node.bold ? 'bold' : 'normal';
      title.style.fontStyle = node.italic ? 'italic' : 'normal';
      title.style.textAlign = 'center';
      title.style.width = '100%';
    }

    header.appendChild(title);

    el.appendChild(header);
  }

  /**
   * Render node content
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderContent(node, el) {
    const typeDef = this.registry.get(node.type);

    if (typeDef?.renderContent) {
      // Use custom renderer
      const contentContainer = document.createElement('div');
      contentContainer.className = 'node-content';
      typeDef.renderContent(node, contentContainer);
      el.appendChild(contentContainer);
    } else {
      // Use default renderer
      this.renderDefaultContent(node, el);
    }
  }

  /**
   * Default content renderer
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderDefaultContent(node, el) {
    if (!node.description && !node.attributes) return;

    const content = document.createElement('div');
    content.className = 'node-content';

    // Description
    if (node.description) {
      const desc = document.createElement('div');
      desc.className = 'node-description';
      desc.textContent = node.description;
      content.appendChild(desc);
    }

    // Attributes preview (if any)
    if (node.attributes && Object.keys(node.attributes).length > 0) {
      const attrCount = document.createElement('div');
      attrCount.className = 'node-attr-count';
      attrCount.textContent = `${Object.keys(node.attributes).length} attributes`;
      content.appendChild(attrCount);
    }

    el.appendChild(content);
  }

  /**
   * Render ports on the node
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderPorts(node, el) {
    if (!node.ports || node.ports.length === 0) return;

    // Register ports with port system
    this.portManager.registerPorts(node.id, node.ports);

    // Calculate positions and render
    const portPositions = this.portManager.calculateAllPortPositions(node);

    portPositions.forEach(({ port, position }) => {
      const portEl = this.createPortElement(port, position, node);
      el.appendChild(portEl);
    });
  }

  /**
   * Create a port element
   * @param {Object} port - Port definition
   * @param {Object} position - Port position {x, y, orientation, side}
   * @param {Object} node - Parent node
   * @returns {HTMLElement}
   */
  createPortElement(port, position, node) {
    const portEl = document.createElement('div');
    portEl.className = `port port-${port.type} port-${port.side}`;
    portEl.dataset.nodeId = node.id;
    portEl.dataset.portId = port.id;
    portEl.dataset.orientation = position.orientation;
    portEl.dataset.side = position.side;
    portEl.title = port.label || port.id;

    // Position relative to node
    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;

    portEl.style.position = 'absolute';
    portEl.style.left = `${position.x - nodeX}px`;
    portEl.style.top = `${position.y - nodeY}px`;

    // Style
    const size = port.style?.size || 10;
    portEl.style.width = `${size}px`;
    portEl.style.height = `${size}px`;
    portEl.style.backgroundColor = port.style?.color || this.portManager.getDefaultPortColor(port.type);
    portEl.style.borderRadius = port.style?.shape === 'square' ? '2px' : '50%';
    portEl.style.border = '2px solid white';
    portEl.style.transform = 'translate(-50%, -50%)';
    portEl.style.cursor = 'crosshair';
    portEl.style.zIndex = '10';

    // Label (if present)
    if (port.label) {
      const label = document.createElement('span');
      label.className = 'port-label';
      label.textContent = port.label;
      portEl.appendChild(label);
    }

    return portEl;
  }

  /**
   * Render node controls (delete button, etc.)
   * @param {Object} node - Node instance
   * @param {HTMLElement} el - Node element
   */
  renderControls(node, el) {
    const controls = document.createElement('div');
    controls.className = 'node-controls';

    // Expand button (if node can have children - show even if empty)
    const typeDef = this.registry.get(node.type);
    if (typeDef?.features?.canHaveChildren) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'node-expand-btn';
      expandBtn.innerHTML = '📂';
      expandBtn.dataset.nodeId = node.id;

      // Count children from both children and childNodes (for lazy-loaded directories)
      const childCount = (node.children?.length || 0) + (node.childNodes?.length || 0);
      expandBtn.title = childCount > 0 ? `Expand (${childCount} items)` : 'Open node';
      controls.appendChild(expandBtn);
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'node-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.dataset.nodeId = node.id;
    deleteBtn.title = 'Delete node';
    controls.appendChild(deleteBtn);

    // Resize handle (if resizable)
    if (typeDef?.features?.canResize) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.dataset.nodeId = node.id;
      controls.appendChild(resizeHandle);
    }

    el.appendChild(controls);
  }

  /**
   * Remove a rendered node
   * @param {string} nodeId - Node ID
   */
  removeRenderedNode(nodeId) {
    const nodeEl = this.renderedNodes.get(nodeId);
    if (nodeEl && nodeEl.parentElement) {
      nodeEl.parentElement.removeChild(nodeEl);
    }
    this.renderedNodes.delete(nodeId);
    this.portManager.clearPorts(nodeId);
  }

  /**
   * Clear all rendered nodes
   */
  clearAll() {
    this.renderedNodes.forEach((el, id) => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    });
    this.renderedNodes.clear();
  }

  /**
   * Update a single node (re-render)
   * @param {string} nodeId - Node ID
   * @param {Object} node - Updated node data
   * @param {HTMLElement} container - Container element
   */
  updateNode(nodeId, node, container) {
    const existingEl = this.renderedNodes.get(nodeId);
    if (existingEl) {
      // Remove old element
      this.removeRenderedNode(nodeId);
    }
    // Re-render
    return this.render(node, container);
  }
}

// Create singleton instance
export const nodeRenderer = new NodeRenderer();
