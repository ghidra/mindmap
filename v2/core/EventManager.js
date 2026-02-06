/**
 * Event Manager - Unified event handling with delegation
 * Handles all node, port, and canvas interactions without re-binding on render
 *
 * Integrates with CommandManager for undo/redo support.
 */

import { state, selectNode as stateSelectNode, clearSelection, removeNode, findNode, addConnection as stateAddConnection } from '../state.js';
import { portSystem } from './PortSystem.js';
import { nodeRenderer } from './NodeRenderer.js';
import { groupManager } from './GroupManager.js';

// Command system imports
import { commandManager } from '../commands/CommandManager.js';
import { MoveNodeCommand, BatchMoveNodesCommand, ResizeNodeCommand, DeleteNodeCommand, BatchDeleteNodesCommand } from '../commands/commands/NodeCommands.js';
import { CreateConnectionCommand } from '../commands/commands/ConnectionCommands.js';

export class EventManager {
  constructor() {
    this.canvas = null;
    this.isDraggingNode = false;
    this.isDraggingPort = false;
    this.isPanning = false;
    this.isResizing = false;

    this.draggedNodeId = null;
    this.draggedPortInfo = null;
    this.resizingNodeId = null;

    this.dragOffset = { x: 0, y: 0 };
    this.panStart = { x: 0, y: 0 };
    this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

    // Initial state capture for undo/redo
    this.dragStartPosition = { x: 0, y: 0 };  // Node position at drag start
    this.resizeStartDimensions = { width: 0, height: 0 };  // Node size at resize start

    this.spaceKeyPressed = false;

    // Event handlers (bound once)
    this.boundHandlers = {
      mousedown: this.handleMouseDown.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      mouseup: this.handleMouseUp.bind(this),
      keydown: this.handleKeyDown.bind(this),
      keyup: this.handleKeyUp.bind(this),
      contextmenu: this.handleContextMenu.bind(this),
      dblclick: this.handleDoubleClick.bind(this)
    };
  }

  /**
   * Initialize event listeners
   * @param {HTMLElement} canvasElement - Canvas element
   */
  init(canvasElement) {
    this.canvas = canvasElement;

    // Attach event listeners using delegation
    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    document.addEventListener('mousemove', this.boundHandlers.mousemove);
    document.addEventListener('mouseup', this.boundHandlers.mouseup);
    document.addEventListener('keydown', this.boundHandlers.keydown);
    document.addEventListener('keyup', this.boundHandlers.keyup);
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextmenu);
    this.canvas.addEventListener('dblclick', this.boundHandlers.dblclick);

    console.log('EventManager initialized');
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
      this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
      this.canvas.removeEventListener('dblclick', this.boundHandlers.dblclick);
    }

    document.removeEventListener('mousemove', this.boundHandlers.mousemove);
    document.removeEventListener('mouseup', this.boundHandlers.mouseup);
    document.removeEventListener('keydown', this.boundHandlers.keydown);
    document.removeEventListener('keyup', this.boundHandlers.keyup);
  }

  /**
   * Handle mouse down events
   */
  handleMouseDown(e) {
    // Check for port dragging (connection creation)
    if (e.target.classList.contains('port')) {
      this.startPortDrag(e);
      return;
    }

    // Check for resize handle
    if (e.target.classList.contains('resize-handle')) {
      this.startResize(e);
      return;
    }

    // Check for delete button
    if (e.target.classList.contains('node-delete-btn')) {
      this.handleDelete(e);
      return;
    }

    // Check for expand button
    if (e.target.classList.contains('node-expand-btn')) {
      this.handleExpand(e);
      return;
    }

    // Check for node dragging
    const nodeEl = e.target.closest('.node');
    if (nodeEl && e.button === 0) {
      this.startNodeDrag(e, nodeEl);
      return;
    }

    // Canvas panning (left click on empty canvas, middle click, or space+left click)
    if (e.button === 1 || (e.button === 0 && this.spaceKeyPressed) || (e.button === 0 && e.target === this.canvas)) {
      this.startPanning(e);
      return;
    }
  }

  /**
   * Handle mouse move events
   */
  handleMouseMove(e) {
    // Port dragging (connection line)
    if (this.isDraggingPort) {
      this.updatePortDrag(e);
      return;
    }

    // Node resizing
    if (this.isResizing) {
      this.updateResize(e);
      return;
    }

    // Node dragging
    if (this.isDraggingNode) {
      this.updateNodeDrag(e);
      return;
    }

    // Canvas panning
    if (this.isPanning) {
      this.updatePanning(e);
      return;
    }
  }

  /**
   * Handle mouse up events
   */
  handleMouseUp(e) {
    // Port dragging - try to create connection
    if (this.isDraggingPort) {
      this.endPortDrag(e);
      this.isDraggingPort = false;
      this.draggedPortInfo = null;
      return;
    }

    // Node resizing
    if (this.isResizing) {
      this.endResize();
      this.isResizing = false;
      this.resizingNodeId = null;
      return;
    }

    // Node dragging
    if (this.isDraggingNode) {
      this.endNodeDrag();
      this.isDraggingNode = false;
      this.draggedNodeId = null;
      return;
    }

    // Canvas panning
    if (this.isPanning) {
      this.endPanning();
      this.isPanning = false;
      return;
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    // Space key for panning
    if (e.code === 'Space' && !e.repeat && !this.isPanning) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        return;
      }
      this.spaceKeyPressed = true;
      this.canvas.style.cursor = 'grab';
      e.preventDefault();
    }

    // Delete key
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedNodes.length > 0) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
          return;
        }
        this.deleteSelectedNodes();
        e.preventDefault();
      }
    }

    // Escape - clear selection
    if (e.key === 'Escape') {
      clearSelection();
      this.triggerRender();
    }
  }

  /**
   * Handle key up events
   */
  handleKeyUp(e) {
    if (e.code === 'Space') {
      this.spaceKeyPressed = false;
      this.isPanning = false;
      this.canvas.style.cursor = '';
    }
  }

  /**
   * Handle context menu (right-click)
   */
  handleContextMenu(e) {
    if (e.target !== this.canvas) return;

    e.preventDefault();

    // Open node creation menu
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - state.viewport.x;
    const y = e.clientY - rect.top - state.viewport.y;

    // Import and show node creator
    if (this.nodeCreatorCallback) {
      this.nodeCreatorCallback(x, y);
    }
  }

  /**
   * Set node creator callback
   * @param {Function} callback - Function to call with (x, y) to open node creator
   */
  setNodeCreatorCallback(callback) {
    this.nodeCreatorCallback = callback;
  }

  /**
   * Handle double-click
   */
  handleDoubleClick(e) {
    const nodeEl = e.target.closest('.node');
    if (nodeEl) {
      const nodeId = nodeEl.dataset.id;
      console.log('Double-clicked node:', nodeId);
      // TODO: Open details panel or navigate into node
    }
  }

  // ============ Node Dragging ============

  startNodeDrag(e, nodeEl) {
    const nodeId = nodeEl.dataset.id;
    let node = findNode(nodeId);
    // Also check execution graph for flow mode groups
    if (!node && state.currentMode === 'flow' && state.flowConfig.executionGraph) {
      const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === nodeId);
      node = graphNode?.originalNode;
    }
    if (!node) return;

    // Don't drag if clicking on input/textarea/button
    if (e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'BUTTON' ||
        e.target.isContentEditable) {
      return;
    }

    this.isDraggingNode = true;
    this.draggedNodeId = nodeId;

    // Select the node
    const multiSelect = e.ctrlKey || e.metaKey;

    // Update visuals
    if (!multiSelect) {
      // Clear previous selection visuals
      this.canvas.querySelectorAll('.node.selected').forEach(el => {
        el.classList.remove('selected');
      });
    }

    // Add selection to state
    stateSelectNode(nodeId, multiSelect);

    // Add visual selection class
    nodeEl.classList.add('selected');

    // Notify details panel
    if (this.onNodeSelected) {
      this.onNodeSelected(nodeId);
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // In flow mode, use flowX/flowY if available
    let nodeX, nodeY;
    if (state.currentMode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
      nodeX = node.flowX ?? node.position?.x ?? node.x ?? 0;
      nodeY = node.flowY ?? node.position?.y ?? node.y ?? 0;
    } else {
      nodeX = node.position?.x ?? node.x ?? 0;
      nodeY = node.position?.y ?? node.y ?? 0;
    }

    this.dragOffset.x = mouseX - nodeX - state.viewport.x;
    this.dragOffset.y = mouseY - nodeY - state.viewport.y;

    // Capture initial position for undo/redo
    this.dragStartPosition.x = nodeX;
    this.dragStartPosition.y = nodeY;

    document.body.style.userSelect = 'none';
    this.triggerRender();
  }

  updateNodeDrag(e) {
    let node = findNode(this.draggedNodeId);
    // Also check execution graph for flow mode groups
    if (!node && state.currentMode === 'flow' && state.flowConfig.executionGraph) {
      const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === this.draggedNodeId);
      node = graphNode?.originalNode;
    }
    if (!node) return;

    const rect = this.canvas.getBoundingClientRect();
    const newX = e.clientX - rect.left - this.dragOffset.x - state.viewport.x;
    const newY = e.clientY - rect.top - this.dragOffset.y - state.viewport.y;

    // Calculate delta for group movement - use appropriate coordinates based on mode
    let oldX, oldY;
    if (state.currentMode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
      oldX = node.flowX ?? node.position?.x ?? node.x ?? 0;
      oldY = node.flowY ?? node.position?.y ?? node.y ?? 0;
    } else {
      oldX = node.position?.x ?? node.x ?? 0;
      oldY = node.position?.y ?? node.y ?? 0;
    }
    const deltaX = newX - oldX;
    const deltaY = newY - oldY;

    // If dragging a group, move group and children
    if (node.type === 'group') {
      // In flow mode, update flowX/flowY; otherwise use GroupManager
      if (state.currentMode === 'flow') {
        // Update group flow position
        node.flowX = newX;
        node.flowY = newY;

        // Update all contained nodes' flow positions
        if (node.containedNodes && node.containedNodes.length > 0) {
          node.containedNodes.forEach(nodeId => {
            let containedNode = findNode(nodeId);
            // Also check execution graph
            if (!containedNode && state.flowConfig.executionGraph) {
              const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === nodeId);
              containedNode = graphNode?.originalNode;
            }
            if (containedNode) {
              containedNode.flowX = (containedNode.flowX ?? 0) + deltaX;
              containedNode.flowY = (containedNode.flowY ?? 0) + deltaY;

              const containedEl = this.canvas.querySelector(`[data-id="${nodeId}"]`);
              if (containedEl) {
                containedEl.style.left = `${containedNode.flowX + state.viewport.x}px`;
                containedEl.style.top = `${containedNode.flowY + state.viewport.y}px`;
              }
            }
          });
        }
      } else {
        groupManager.moveGroup(this.draggedNodeId, deltaX, deltaY);

        // Update all contained nodes' DOM positions
        if (node.containedNodes && node.containedNodes.length > 0) {
          node.containedNodes.forEach(nodeId => {
            const containedNode = findNode(nodeId);
            if (containedNode) {
              const containedEl = this.canvas.querySelector(`[data-id="${nodeId}"]`);
              if (containedEl) {
                const containedX = containedNode.position?.x ?? containedNode.x ?? 0;
                const containedY = containedNode.position?.y ?? containedNode.y ?? 0;
                containedEl.style.left = `${containedX + state.viewport.x}px`;
                containedEl.style.top = `${containedY + state.viewport.y}px`;
              }
            }
          });
        }
      }

      // Update group's DOM position
      const groupEl = this.canvas.querySelector(`[data-id="${this.draggedNodeId}"]`);
      if (groupEl) {
        groupEl.style.left = `${newX + state.viewport.x}px`;
        groupEl.style.top = `${newY + state.viewport.y}px`;
      }
    } else {
      // Update node position - in flow mode, update flowX/flowY
      if (state.currentMode === 'flow') {
        node.flowX = newX;
        node.flowY = newY;
      } else if (node.position) {
        node.position.x = newX;
        node.position.y = newY;
      } else {
        node.x = newX;
        node.y = newY;
      }

      // OPTIMIZED: Update only the dragged node's position in DOM
      const nodeEl = this.canvas.querySelector(`[data-id="${this.draggedNodeId}"]`);
      if (nodeEl) {
        nodeEl.style.left = `${newX + state.viewport.x}px`;
        nodeEl.style.top = `${newY + state.viewport.y}px`;
      }
    }

    // Don't trigger full render during drag - only update position
    // this.triggerRender(); // Removed to prevent flicker
  }

  endNodeDrag() {
    let node = findNode(this.draggedNodeId);
    // Also check execution graph for flow mode groups
    if (!node && state.currentMode === 'flow' && state.flowConfig.executionGraph) {
      const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === this.draggedNodeId);
      node = graphNode?.originalNode;
    }

    // Update group containment if node was moved
    if (node && node.type !== 'group') {
      groupManager.updateGroupContainment(this.draggedNodeId);
    }

    document.body.style.userSelect = '';

    // Create move command for undo/redo (if not already in undo/redo operation)
    if (node && !commandManager.isUndoingOrRedoing()) {
      // Get final position
      let finalX, finalY;
      if (state.currentMode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
        finalX = node.flowX ?? node.position?.x ?? node.x ?? 0;
        finalY = node.flowY ?? node.position?.y ?? node.y ?? 0;
      } else if (node.position) {
        finalX = node.position.x ?? 0;
        finalY = node.position.y ?? 0;
      } else {
        finalX = node.x ?? 0;
        finalY = node.y ?? 0;
      }

      // Only create command if position actually changed
      const dx = Math.abs(finalX - this.dragStartPosition.x);
      const dy = Math.abs(finalY - this.dragStartPosition.y);

      if (dx > 1 || dy > 1) {  // Threshold to avoid micro-movements
        const moveCommand = new MoveNodeCommand(
          this.draggedNodeId,
          finalX,
          finalY,
          {
            oldX: this.dragStartPosition.x,
            oldY: this.dragStartPosition.y,
            mode: state.currentMode
          }
        );
        // Skip execution since we already moved the node during drag
        commandManager.execute(moveCommand, true);
      }
    }

    // Do a full render now that dragging is done to sync connections
    this.triggerRender();
    this.triggerSave();
  }

  // ============ Port Dragging ============

  startPortDrag(e) {
    this.isDraggingPort = true;
    this.draggedPortInfo = {
      nodeId: e.target.dataset.nodeId,
      portId: e.target.dataset.portId,
      orientation: e.target.dataset.orientation,
      side: e.target.dataset.side
    };

    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
  }

  updatePortDrag(e) {
    // Visual feedback would be handled by connection renderer
    this.triggerRender();
  }

  endPortDrag(e) {
    // Check if dropped on another port
    if (e.target.classList.contains('port')) {
      const targetNodeId = e.target.dataset.nodeId;
      const targetPortId = e.target.dataset.portId;

      if (this.draggedPortInfo) {
        // Create connection
        this.createConnection(
          this.draggedPortInfo.nodeId,
          this.draggedPortInfo.portId,
          targetNodeId,
          targetPortId
        );
      }
    }

    document.body.style.userSelect = '';
    this.triggerRender();
  }

  // ============ Resizing ============

  startResize(e) {
    const nodeId = e.target.dataset.nodeId;
    const node = findNode(nodeId);
    if (!node) return;

    this.isResizing = true;
    this.resizingNodeId = nodeId;

    this.resizeStart.x = e.clientX;
    this.resizeStart.y = e.clientY;
    this.resizeStart.width = node.size?.width ?? node.width ?? 180;
    this.resizeStart.height = node.size?.height ?? node.height ?? 100;

    // Capture initial dimensions for undo/redo
    this.resizeStartDimensions.width = this.resizeStart.width;
    this.resizeStartDimensions.height = this.resizeStart.height;

    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
  }

  updateResize(e) {
    const node = findNode(this.resizingNodeId);
    if (!node) return;

    const deltaX = e.clientX - this.resizeStart.x;
    const deltaY = e.clientY - this.resizeStart.y;

    const newWidth = Math.max(100, this.resizeStart.width + deltaX);
    const newHeight = Math.max(60, this.resizeStart.height + deltaY);

    if (node.size) {
      node.size.width = newWidth;
      node.size.height = newHeight;
    } else {
      node.width = newWidth;
      node.height = newHeight;
    }

    this.triggerRender();
  }

  endResize() {
    document.body.style.userSelect = '';

    // Create resize command for undo/redo
    const node = findNode(this.resizingNodeId);
    if (node && !commandManager.isUndoingOrRedoing()) {
      const finalWidth = node.size?.width ?? node.width ?? 180;
      const finalHeight = node.size?.height ?? node.height ?? 100;

      // Only create command if size actually changed
      const dw = Math.abs(finalWidth - this.resizeStartDimensions.width);
      const dh = Math.abs(finalHeight - this.resizeStartDimensions.height);

      if (dw > 1 || dh > 1) {
        const resizeCommand = new ResizeNodeCommand(
          this.resizingNodeId,
          finalWidth,
          finalHeight,
          {
            oldWidth: this.resizeStartDimensions.width,
            oldHeight: this.resizeStartDimensions.height
          }
        );
        // Skip execution since we already resized during drag
        commandManager.execute(resizeCommand, true);
      }
    }

    this.triggerSave();
  }

  // ============ Panning ============

  startPanning(e) {
    this.isPanning = true;
    this.panStart.x = e.clientX - state.viewport.x;
    this.panStart.y = e.clientY - state.viewport.y;
    this.canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }

  updatePanning(e) {
    state.viewport.x = e.clientX - this.panStart.x;
    state.viewport.y = e.clientY - this.panStart.y;

    // Also update legacy panX/panY for compatibility
    state.panX = state.viewport.x;
    state.panY = state.viewport.y;

    // OPTIMIZED: Update all node positions in DOM without full re-render
    const nodes = this.canvas.querySelectorAll('.node');
    nodes.forEach(nodeEl => {
      const nodeId = nodeEl.dataset.id;
      // Find node - check execution graph for flow mode
      let node = findNode(nodeId);
      if (!node && state.currentMode === 'flow' && state.flowConfig.executionGraph) {
        const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === nodeId);
        node = graphNode?.originalNode;
      }
      if (node) {
        // In flow mode, use flowX/flowY if available
        let x, y;
        if (state.currentMode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
          x = node.flowX ?? node.position?.x ?? node.x ?? 0;
          y = node.flowY ?? node.position?.y ?? node.y ?? 0;
        } else {
          x = node.position?.x ?? node.x ?? 0;
          y = node.position?.y ?? node.y ?? 0;
        }
        nodeEl.style.left = `${x + state.viewport.x}px`;
        nodeEl.style.top = `${y + state.viewport.y}px`;
      }
    });

    // Don't trigger full render during pan - only update positions
    // this.triggerRender(); // Removed to prevent flicker
  }

  endPanning() {
    this.canvas.style.cursor = this.spaceKeyPressed ? 'grab' : '';

    // Do a full render now that panning is done to sync everything (especially connections)
    this.triggerRender();
    this.triggerSave();
  }

  // ============ Helper Methods ============

  createConnection(fromNodeId, fromPortId, toNodeId, toPortId) {
    const fromPort = portSystem.getPort(fromNodeId, fromPortId);
    const toPort = portSystem.getPort(toNodeId, toPortId);

    if (!fromPort || !toPort) {
      console.warn('Cannot create connection: port not found');
      return;
    }

    if (!portSystem.canConnect(fromPort, toPort)) {
      console.warn('Cannot create connection: ports incompatible');
      return;
    }

    const connectionData = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: { nodeId: fromNodeId, portId: fromPortId },
      to: { nodeId: toNodeId, portId: toPortId },
      style: {
        stroke: '#666',
        strokeWidth: 2,
        strokeDasharray: null,
        animated: false
      }
    };

    // Use command system for undo/redo support
    if (!commandManager.isUndoingOrRedoing()) {
      const command = new CreateConnectionCommand(connectionData);
      commandManager.execute(command);
    } else {
      // Direct add during undo/redo
      stateAddConnection(connectionData);
    }

    this.triggerSave();
    this.triggerRender();
  }

  handleDelete(e) {
    const nodeId = e.target.dataset.nodeId;
    if (nodeId) {
      // Use command system for undo/redo support
      if (!commandManager.isUndoingOrRedoing()) {
        const command = new DeleteNodeCommand(nodeId);
        commandManager.execute(command);
      } else {
        // Direct delete during undo/redo
        removeNode(nodeId);
      }
      nodeRenderer.removeRenderedNode(nodeId);
      this.triggerSave();
      this.triggerRender();
    }
  }

  deleteSelectedNodes() {
    if (state.selectedNodes.length === 0) return;

    // Use command system for undo/redo support
    if (!commandManager.isUndoingOrRedoing()) {
      if (state.selectedNodes.length === 1) {
        const command = new DeleteNodeCommand(state.selectedNodes[0]);
        commandManager.execute(command);
      } else {
        const command = new BatchDeleteNodesCommand([...state.selectedNodes]);
        commandManager.execute(command);
      }
    } else {
      // Direct delete during undo/redo
      state.selectedNodes.forEach(nodeId => {
        removeNode(nodeId);
      });
    }

    // Remove from renderer
    state.selectedNodes.forEach(nodeId => {
      nodeRenderer.removeRenderedNode(nodeId);
    });

    clearSelection();
    this.triggerSave();
    this.triggerRender();
  }

  handleExpand(e) {
    const nodeId = e.target.dataset.nodeId;
    if (nodeId) {
      const node = findNode(nodeId);

      // Initialize children array if it doesn't exist
      if (!node.children) {
        node.children = [];
      }

      // For directory nodes, promote childNodes to children if they exist
      // This handles lazy-loaded directory structure from the parser
      if (node.childNodes && node.childNodes.length > 0 && node.children.length === 0) {
        node.children = node.childNodes;
        node.childNodes = []; // Clear to avoid duplication
      }

      // Navigate into the node by adding it to the path
      state.path.push(nodeId);
      this.triggerRender();
      this.triggerSave();
    }
  }

  /**
   * Trigger a render (to be set by render system)
   */
  triggerRender() {
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }

  /**
   * Trigger a save (to be set by save system)
   */
  triggerSave() {
    if (this.onSaveNeeded) {
      this.onSaveNeeded();
    }
  }

  /**
   * Set render callback
   * @param {Function} callback
   */
  setRenderCallback(callback) {
    this.onRenderNeeded = callback;
  }

  /**
   * Set save callback
   * @param {Function} callback
   */
  setSaveCallback(callback) {
    this.onSaveNeeded = callback;
  }

  /**
   * Set node selected callback
   * @param {Function} callback - Called with nodeId when node is selected
   */
  setNodeSelectedCallback(callback) {
    this.onNodeSelected = callback;
  }
}

// Create singleton instance
export const eventManager = new EventManager();
