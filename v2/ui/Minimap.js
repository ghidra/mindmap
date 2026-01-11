/**
 * Minimap - Shows overview of all nodes and current viewport
 */

import { state, findNode } from '../state.js';

export class Minimap {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.toggleButton = null;
    this.isVisible = false;
    this.scale = 0.1; // How much to scale down the nodes
    this.width = 200;
    this.height = 150;
  }

  init() {
    this.createToggleButton();
    this.createMinimapContainer();
    console.log('Minimap initialized');
  }

  createToggleButton() {
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'minimap-toggle';
    this.toggleButton.innerHTML = '🗺️';
    this.toggleButton.title = 'Toggle Minimap';
    this.toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border: 2px solid #555;
      background: #2a2a2a;
      color: #e0e0e0;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.toggleButton.addEventListener('mouseenter', () => {
      this.toggleButton.style.background = '#3a3a3a';
    });

    this.toggleButton.addEventListener('mouseleave', () => {
      this.toggleButton.style.background = '#2a2a2a';
    });

    this.toggleButton.onclick = () => this.toggle();
    document.body.appendChild(this.toggleButton);
  }

  createMinimapContainer() {
    this.container = document.createElement('div');
    this.container.className = 'minimap-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      width: ${this.width}px;
      height: ${this.height}px;
      background: #1a1a1a;
      border: 2px solid #555;
      border-radius: 4px;
      display: none;
      z-index: 9998;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      overflow: hidden;
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.cssText = 'cursor: pointer;';
    this.ctx = this.canvas.getContext('2d');

    // Click to navigate
    this.canvas.addEventListener('click', (e) => {
      this.handleMinimapClick(e);
    });

    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);
  }

  toggle() {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';

    if (this.isVisible) {
      this.render();
    }
  }

  render() {
    if (!this.isVisible || !this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Get all nodes
    const nodes = this.getAllNodes();
    if (nodes.length === 0) return;

    // Calculate bounds of all nodes
    const bounds = this.calculateBounds(nodes);

    // Calculate scale to fit all nodes
    const scaleX = (this.width - 20) / bounds.width;
    const scaleY = (this.height - 20) / bounds.height;
    this.scale = Math.min(scaleX, scaleY, 0.15); // Cap at 0.15 for visibility

    // Center offset
    const offsetX = (this.width - bounds.width * this.scale) / 2 - bounds.minX * this.scale;
    const offsetY = (this.height - bounds.height * this.scale) / 2 - bounds.minY * this.scale;

    // Draw nodes
    nodes.forEach(node => {
      const x = (node.position?.x ?? node.x ?? 0) * this.scale + offsetX;
      const y = (node.position?.y ?? node.y ?? 0) * this.scale + offsetY;
      const width = (node.size?.width ?? node.width ?? 180) * this.scale;
      const height = (node.size?.height ?? node.height ?? 100) * this.scale;

      // Get node color
      const color = node.style?.color || node.color || '#3a3a3a';

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, width, height);

      // Draw border
      this.ctx.strokeStyle = node.style?.borderColor || '#555';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, width, height);
    });

    // Draw viewport rectangle
    this.drawViewport(offsetX, offsetY);
  }

  drawViewport(offsetX, offsetY) {
    // Get canvas element to determine viewport size
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    // Calculate viewport position in minimap
    const vpX = (-state.viewport.x) * this.scale + offsetX;
    const vpY = (-state.viewport.y) * this.scale + offsetY;
    const vpWidth = viewportWidth * this.scale;
    const vpHeight = viewportHeight * this.scale;

    // Draw viewport rectangle
    this.ctx.strokeStyle = '#4a90e2';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(vpX, vpY, vpWidth, vpHeight);

    // Draw semi-transparent fill
    this.ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
    this.ctx.fillRect(vpX, vpY, vpWidth, vpHeight);
  }

  handleMinimapClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Get all nodes to calculate bounds
    const nodes = this.getAllNodes();
    if (nodes.length === 0) return;

    const bounds = this.calculateBounds(nodes);
    const offsetX = (this.width - bounds.width * this.scale) / 2 - bounds.minX * this.scale;
    const offsetY = (this.height - bounds.height * this.scale) / 2 - bounds.minY * this.scale;

    // Convert click position to world coordinates
    const worldX = (clickX - offsetX) / this.scale;
    const worldY = (clickY - offsetY) / this.scale;

    // Center the viewport on the clicked position
    const canvasEl = document.getElementById('canvas');
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      state.viewport.x = -worldX + rect.width / 2;
      state.viewport.y = -worldY + rect.height / 2;
      state.panX = state.viewport.x;
      state.panY = state.viewport.y;

      // Trigger render
      if (this.onPanChanged) {
        this.onPanChanged();
      }
    }
  }

  getAllNodes() {
    // Get nodes based on current mode
    if (state.currentMode === 'notes') {
      return state.notesData.nodes || [];
    } else if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
      const allFlowNodes = state.flowConfig.executionGraph.nodes.map(gn => gn.originalNode).filter(n => n);

      // If inside a node, show only that context
      if (state.path.length > 0) {
        const lastId = state.path[state.path.length - 1];
        const currentNode = allFlowNodes.find(n => n.id === lastId);
        if (currentNode && currentNode.children && currentNode.children.length > 0) {
          return currentNode.children;
        }
      }
      return allFlowNodes.filter(n => !n.syntheticNode);
    } else {
      // Hierarchical mode - show ONLY the current context nodes (not nested children)
      let contextNodes = state.nodes;

      // Navigate to current context if we have a path
      if (state.path.length > 0) {
        for (const id of state.path) {
          const node = contextNodes.find(n => n.id === id);
          if (node && node.children) {
            contextNodes = node.children;
          } else {
            break;
          }
        }
      }

      // Return only the immediate nodes in this context (no recursive traversal)
      return contextNodes || [];
    }
  }

  calculateBounds(nodes) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const x = node.position?.x ?? node.x ?? 0;
      const y = node.position?.y ?? node.y ?? 0;
      const width = node.size?.width ?? node.width ?? 180;
      const height = node.size?.height ?? node.height ?? 100;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  setPanChangedCallback(callback) {
    this.onPanChanged = callback;
  }
}

// Create singleton instance
export const minimap = new Minimap();
