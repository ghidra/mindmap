/**
 * Node Commands
 *
 * Commands for creating, deleting, and manipulating nodes.
 * These commands integrate with the CommandManager for undo/redo support.
 *
 * @see ARCHITECTURE_PLAN.md Module 7 for documentation
 */

import { Command } from '../Command.js';
import { state, addNode, removeNode, findNode, save, saveNotes } from '../../state.js';

/**
 * Create Node Command
 *
 * Creates a new node in the appropriate state store based on current mode.
 * Captures all necessary data to undo the creation (remove the node).
 */
export class CreateNodeCommand extends Command {
  /**
   * @param {Object} nodeData - The node data to create
   * @param {Object} options - Additional options
   * @param {string} options.mode - Override mode ('hierarchical' | 'notes' | 'flow')
   * @param {string} options.parentId - Parent node ID for hierarchical insertion
   */
  constructor(nodeData, options = {}) {
    super();

    // Clone node data to avoid external mutations
    this.nodeData = JSON.parse(JSON.stringify(nodeData));
    this.mode = options.mode || state.currentMode;
    this.parentId = options.parentId || null;

    // Track where the node was inserted for undo
    this._insertedInNotes = false;
    this._insertedAsChild = false;
    this._insertIndex = -1;
  }

  get description() {
    const typeName = this.nodeData.type || 'node';
    const nodeName = this.nodeData.title || this.nodeData.name || this.nodeData.id;
    return `Create ${typeName}: ${nodeName}`;
  }

  get type() {
    return 'create-node';
  }

  execute() {
    // Restore the node from our stored data
    const node = JSON.parse(JSON.stringify(this.nodeData));

    if (this.mode === 'notes') {
      // Notes mode - add to notesData
      if (!state.notesData.nodes) {
        state.notesData.nodes = [];
      }
      state.notesData.nodes.push(node);
      this._insertedInNotes = true;
      this._insertIndex = state.notesData.nodes.length - 1;
      saveNotes();
    } else if (this.parentId) {
      // Hierarchical with parent - add as child
      const parent = findNode(this.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        node.parentId = this.parentId;
        node.parent = parent;
        parent.children.push(node);
        this._insertedAsChild = true;
        this._insertIndex = parent.children.length - 1;
      } else {
        // Fallback to root if parent not found
        state.nodes.push(node);
        this._insertIndex = state.nodes.length - 1;
      }
      save();
    } else {
      // Root level insertion
      state.nodes.push(node);
      this._insertIndex = state.nodes.length - 1;
      save();
    }
  }

  undo() {
    const nodeId = this.nodeData.id;

    if (this._insertedInNotes) {
      // Remove from notes
      const index = state.notesData.nodes.findIndex(n => n.id === nodeId);
      if (index !== -1) {
        state.notesData.nodes.splice(index, 1);
      }
      // Also remove any connections to this node
      if (state.notesData.connections) {
        state.notesData.connections = state.notesData.connections.filter(
          conn => conn.from !== nodeId && conn.to !== nodeId
        );
      }
      saveNotes();
    } else if (this._insertedAsChild && this.parentId) {
      // Remove from parent's children
      const parent = findNode(this.parentId);
      if (parent && parent.children) {
        const index = parent.children.findIndex(n => n.id === nodeId);
        if (index !== -1) {
          parent.children.splice(index, 1);
        }
      }
      // Remove connections
      state.connections = state.connections.filter(
        conn => conn.from?.nodeId !== nodeId && conn.to?.nodeId !== nodeId
      );
      save();
    } else {
      // Remove from root nodes
      const index = state.nodes.findIndex(n => n.id === nodeId);
      if (index !== -1) {
        state.nodes.splice(index, 1);
      }
      // Remove connections
      state.connections = state.connections.filter(
        conn => conn.from?.nodeId !== nodeId && conn.to?.nodeId !== nodeId
      );
      save();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      nodeData: this.nodeData,
      mode: this.mode,
      parentId: this.parentId
    };
  }
}

/**
 * Delete Node Command
 *
 * Deletes a node from the state.
 * Captures all node data and connections for undo (restore the node).
 */
export class DeleteNodeCommand extends Command {
  /**
   * @param {string} nodeId - ID of the node to delete
   * @param {Object} options - Additional options
   * @param {string} options.mode - Override mode ('hierarchical' | 'notes' | 'flow')
   */
  constructor(nodeId, options = {}) {
    super();

    this.nodeId = nodeId;
    this.mode = options.mode || state.currentMode;

    // These will be populated during execute() to capture state for undo
    this._nodeData = null;
    this._connections = [];
    this._wasInNotes = false;
    this._parentId = null;
    this._childIndex = -1;
    this._wasAtRoot = false;
  }

  get description() {
    if (this._nodeData) {
      const typeName = this._nodeData.type || 'node';
      const nodeName = this._nodeData.title || this._nodeData.name || this._nodeData.id;
      return `Delete ${typeName}: ${nodeName}`;
    }
    return `Delete node: ${this.nodeId}`;
  }

  get type() {
    return 'delete-node';
  }

  execute() {
    // Find the node first to capture its data
    let node = null;

    // Check notes mode first
    if (this.mode === 'notes' || state.notesData?.nodes?.some(n => n.id === this.nodeId)) {
      node = state.notesData.nodes.find(n => n.id === this.nodeId);
      if (node) {
        this._wasInNotes = true;
        this._nodeData = JSON.parse(JSON.stringify(node));

        // Capture connections
        if (state.notesData.connections) {
          this._connections = state.notesData.connections.filter(
            conn => conn.from === this.nodeId || conn.to === this.nodeId
          ).map(c => JSON.parse(JSON.stringify(c)));
        }

        // Remove node
        const index = state.notesData.nodes.findIndex(n => n.id === this.nodeId);
        if (index !== -1) {
          this._childIndex = index;
          state.notesData.nodes.splice(index, 1);
        }

        // Remove connections
        if (state.notesData.connections) {
          state.notesData.connections = state.notesData.connections.filter(
            conn => conn.from !== this.nodeId && conn.to !== this.nodeId
          );
        }

        saveNotes();
        return;
      }
    }

    // Search hierarchical nodes
    node = findNode(this.nodeId);
    if (!node) {
      console.warn(`DeleteNodeCommand: Node ${this.nodeId} not found`);
      return;
    }

    // Capture node data (deep clone, excluding circular refs)
    this._nodeData = this._cloneNodeData(node);

    // Capture connections involving this node
    this._connections = state.connections.filter(
      conn => conn.from?.nodeId === this.nodeId || conn.to?.nodeId === this.nodeId
    ).map(c => JSON.parse(JSON.stringify(c)));

    // Determine where the node is located
    if (node.parentId) {
      this._parentId = node.parentId;
      const parent = findNode(node.parentId);
      if (parent && parent.children) {
        this._childIndex = parent.children.findIndex(n => n.id === this.nodeId);
        parent.children.splice(this._childIndex, 1);
      }
    } else {
      // Check if at root level
      const rootIndex = state.nodes.findIndex(n => n.id === this.nodeId);
      if (rootIndex !== -1) {
        this._wasAtRoot = true;
        this._childIndex = rootIndex;
        state.nodes.splice(rootIndex, 1);
      }
    }

    // Remove connections
    state.connections = state.connections.filter(
      conn => conn.from?.nodeId !== this.nodeId && conn.to?.nodeId !== this.nodeId
    );

    save();
  }

  undo() {
    if (!this._nodeData) {
      console.warn('DeleteNodeCommand.undo: No node data captured');
      return;
    }

    // Restore the node
    const node = JSON.parse(JSON.stringify(this._nodeData));

    if (this._wasInNotes) {
      // Restore to notes
      if (!state.notesData.nodes) {
        state.notesData.nodes = [];
      }
      // Insert at original index if possible
      if (this._childIndex >= 0 && this._childIndex <= state.notesData.nodes.length) {
        state.notesData.nodes.splice(this._childIndex, 0, node);
      } else {
        state.notesData.nodes.push(node);
      }

      // Restore connections
      if (this._connections.length > 0) {
        if (!state.notesData.connections) {
          state.notesData.connections = [];
        }
        this._connections.forEach(conn => {
          state.notesData.connections.push(JSON.parse(JSON.stringify(conn)));
        });
      }

      saveNotes();
    } else if (this._parentId) {
      // Restore as child of parent
      const parent = findNode(this._parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        node.parentId = this._parentId;
        node.parent = parent;

        // Insert at original index if possible
        if (this._childIndex >= 0 && this._childIndex <= parent.children.length) {
          parent.children.splice(this._childIndex, 0, node);
        } else {
          parent.children.push(node);
        }
      } else {
        // Parent no longer exists, add to root
        state.nodes.push(node);
      }

      // Restore connections
      this._connections.forEach(conn => {
        state.connections.push(JSON.parse(JSON.stringify(conn)));
      });

      save();
    } else if (this._wasAtRoot) {
      // Restore to root
      if (this._childIndex >= 0 && this._childIndex <= state.nodes.length) {
        state.nodes.splice(this._childIndex, 0, node);
      } else {
        state.nodes.push(node);
      }

      // Restore connections
      this._connections.forEach(conn => {
        state.connections.push(JSON.parse(JSON.stringify(conn)));
      });

      save();
    }
  }

  /**
   * Clone node data, handling circular references (parent)
   * @private
   */
  _cloneNodeData(node) {
    const clone = {};

    for (const [key, value] of Object.entries(node)) {
      // Skip circular references
      if (key === 'parent' || key === 'fileObject') {
        continue;
      }

      // Deep clone children recursively
      if (key === 'children' && Array.isArray(value)) {
        clone.children = value.map(child => this._cloneNodeData(child));
      } else if (value !== null && typeof value === 'object') {
        // Deep clone objects/arrays
        clone[key] = JSON.parse(JSON.stringify(value));
      } else {
        clone[key] = value;
      }
    }

    return clone;
  }

  serialize() {
    return {
      ...super.serialize(),
      nodeId: this.nodeId,
      mode: this.mode,
      nodeData: this._nodeData,
      connections: this._connections,
      wasInNotes: this._wasInNotes,
      parentId: this._parentId,
      childIndex: this._childIndex,
      wasAtRoot: this._wasAtRoot
    };
  }
}

/**
 * Move Node Command
 *
 * Moves a node to a new position.
 * Supports merging for smooth drag operations - multiple small moves become one undo action.
 */
export class MoveNodeCommand extends Command {
  /**
   * @param {string} nodeId - ID of the node to move
   * @param {number} newX - New X position
   * @param {number} newY - New Y position
   * @param {Object} options - Additional options
   * @param {number} options.oldX - Previous X (captured automatically if not provided)
   * @param {number} options.oldY - Previous Y (captured automatically if not provided)
   * @param {string} options.mode - Override mode for position property detection
   */
  constructor(nodeId, newX, newY, options = {}) {
    super();

    this.nodeId = nodeId;
    this.newX = newX;
    this.newY = newY;
    this.mode = options.mode || state.currentMode;

    // Capture old position if not provided
    if (options.oldX !== undefined && options.oldY !== undefined) {
      this.oldX = options.oldX;
      this.oldY = options.oldY;
    } else {
      // Auto-capture current position
      const pos = this._getNodePosition(nodeId);
      this.oldX = pos.x;
      this.oldY = pos.y;
    }

    // Track which position format the node uses
    this._positionFormat = this._detectPositionFormat(nodeId);
  }

  get description() {
    return `Move node`;
  }

  get type() {
    return 'move-node';
  }

  execute() {
    this._setNodePosition(this.nodeId, this.newX, this.newY);
  }

  undo() {
    this._setNodePosition(this.nodeId, this.oldX, this.oldY);
  }

  /**
   * Check if this command can be merged with another.
   * Move commands for the same node can be merged within the time window.
   */
  canMerge(other) {
    return (
      other instanceof MoveNodeCommand &&
      other.nodeId === this.nodeId
    );
  }

  /**
   * Merge another move command into this one.
   * Takes the new position from the other command.
   */
  merge(other) {
    // Keep our oldX/oldY (the original position)
    // Take the newX/newY from the other command (the latest position)
    this.newX = other.newX;
    this.newY = other.newY;
    // Update timestamp to keep merging window open
    this.timestamp = other.timestamp;
    return this;
  }

  /**
   * Detect which position format the node uses
   * @private
   */
  _detectPositionFormat(nodeId) {
    const node = this._findNodeAnyMode(nodeId);
    if (!node) return 'xy';

    // Flow mode uses flowX/flowY
    if (this.mode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
      return 'flow';
    }

    // Some nodes use position.x/position.y
    if (node.position && (node.position.x !== undefined || node.position.y !== undefined)) {
      return 'position';
    }

    // Default to x/y
    return 'xy';
  }

  /**
   * Get node position regardless of format
   * @private
   */
  _getNodePosition(nodeId) {
    const node = this._findNodeAnyMode(nodeId);
    if (!node) return { x: 0, y: 0 };

    // Flow mode
    if (this.mode === 'flow' && (node.flowX !== undefined || node.flowY !== undefined)) {
      return {
        x: node.flowX ?? node.position?.x ?? node.x ?? 0,
        y: node.flowY ?? node.position?.y ?? node.y ?? 0
      };
    }

    // Position object format
    if (node.position) {
      return {
        x: node.position.x ?? node.x ?? 0,
        y: node.position.y ?? node.y ?? 0
      };
    }

    // Direct x/y format
    return {
      x: node.x ?? 0,
      y: node.y ?? 0
    };
  }

  /**
   * Set node position in the appropriate format
   * @private
   */
  _setNodePosition(nodeId, x, y) {
    const node = this._findNodeAnyMode(nodeId);
    if (!node) {
      console.warn(`MoveNodeCommand: Node ${nodeId} not found`);
      return;
    }

    switch (this._positionFormat) {
      case 'flow':
        node.flowX = x;
        node.flowY = y;
        break;

      case 'position':
        if (!node.position) {
          node.position = {};
        }
        node.position.x = x;
        node.position.y = y;
        break;

      case 'xy':
      default:
        node.x = x;
        node.y = y;
        break;
    }

    // Save based on mode
    if (this.mode === 'notes' || state.notesData?.nodes?.some(n => n.id === nodeId)) {
      saveNotes();
    } else {
      save();
    }
  }

  /**
   * Find a node in any mode (hierarchical, notes, flow)
   * @private
   */
  _findNodeAnyMode(nodeId) {
    // Check notes first
    if (state.notesData?.nodes) {
      const noteNode = state.notesData.nodes.find(n => n.id === nodeId);
      if (noteNode) return noteNode;
    }

    // Check hierarchical
    const node = findNode(nodeId);
    if (node) return node;

    // Check flow mode execution graph
    if (state.flowConfig?.executionGraph?.nodes) {
      const graphNode = state.flowConfig.executionGraph.nodes.find(gn => gn.id === nodeId);
      if (graphNode?.originalNode) return graphNode.originalNode;
    }

    return null;
  }

  serialize() {
    return {
      ...super.serialize(),
      nodeId: this.nodeId,
      oldX: this.oldX,
      oldY: this.oldY,
      newX: this.newX,
      newY: this.newY,
      mode: this.mode,
      positionFormat: this._positionFormat
    };
  }
}

/**
 * Batch Move Nodes Command
 *
 * Moves multiple nodes by the same delta.
 * Useful for moving a selection or group of nodes together.
 */
export class BatchMoveNodesCommand extends Command {
  /**
   * @param {Array<{nodeId: string, oldX: number, oldY: number, newX: number, newY: number}>} moves
   *   Array of move specifications
   */
  constructor(moves) {
    super();
    this.moves = moves.map(m => ({ ...m }));
    this._moveCommands = [];
  }

  get description() {
    return `Move ${this.moves.length} nodes`;
  }

  get type() {
    return 'batch-move-nodes';
  }

  execute() {
    this._moveCommands = this.moves.map(m => {
      const cmd = new MoveNodeCommand(m.nodeId, m.newX, m.newY, {
        oldX: m.oldX,
        oldY: m.oldY
      });
      cmd.execute();
      return cmd;
    });
  }

  undo() {
    // Undo all moves
    this._moveCommands.forEach(cmd => cmd.undo());
  }

  /**
   * Batch moves can merge if they contain the same nodes
   */
  canMerge(other) {
    if (!(other instanceof BatchMoveNodesCommand)) return false;
    if (other.moves.length !== this.moves.length) return false;

    // Check if same nodes (order may differ)
    const ourIds = new Set(this.moves.map(m => m.nodeId));
    const theirIds = new Set(other.moves.map(m => m.nodeId));

    if (ourIds.size !== theirIds.size) return false;
    for (const id of ourIds) {
      if (!theirIds.has(id)) return false;
    }

    return true;
  }

  /**
   * Merge takes the new positions from the other command
   */
  merge(other) {
    // Update each move's newX/newY
    for (const otherMove of other.moves) {
      const ourMove = this.moves.find(m => m.nodeId === otherMove.nodeId);
      if (ourMove) {
        ourMove.newX = otherMove.newX;
        ourMove.newY = otherMove.newY;
      }
    }
    this.timestamp = other.timestamp;
    return this;
  }

  serialize() {
    return {
      ...super.serialize(),
      moves: this.moves
    };
  }
}

/**
 * Resize Node Command
 *
 * Resizes a node to new dimensions.
 * Supports merging for smooth resize operations.
 */
export class ResizeNodeCommand extends Command {
  /**
   * @param {string} nodeId - ID of the node to resize
   * @param {number} newWidth - New width
   * @param {number} newHeight - New height
   * @param {Object} options - Additional options
   * @param {number} options.oldWidth - Previous width
   * @param {number} options.oldHeight - Previous height
   */
  constructor(nodeId, newWidth, newHeight, options = {}) {
    super();

    this.nodeId = nodeId;
    this.newWidth = newWidth;
    this.newHeight = newHeight;

    // Capture old dimensions if not provided
    const node = findNode(nodeId) || state.notesData?.nodes?.find(n => n.id === nodeId);
    this.oldWidth = options.oldWidth ?? node?.width ?? 180;
    this.oldHeight = options.oldHeight ?? node?.height ?? 100;
  }

  get description() {
    return `Resize node`;
  }

  get type() {
    return 'resize-node';
  }

  execute() {
    const node = findNode(this.nodeId) || state.notesData?.nodes?.find(n => n.id === this.nodeId);
    if (!node) return;

    node.width = this.newWidth;
    node.height = this.newHeight;

    if (state.notesData?.nodes?.some(n => n.id === this.nodeId)) {
      saveNotes();
    } else {
      save();
    }
  }

  undo() {
    const node = findNode(this.nodeId) || state.notesData?.nodes?.find(n => n.id === this.nodeId);
    if (!node) return;

    node.width = this.oldWidth;
    node.height = this.oldHeight;

    if (state.notesData?.nodes?.some(n => n.id === this.nodeId)) {
      saveNotes();
    } else {
      save();
    }
  }

  canMerge(other) {
    return (
      other instanceof ResizeNodeCommand &&
      other.nodeId === this.nodeId
    );
  }

  merge(other) {
    this.newWidth = other.newWidth;
    this.newHeight = other.newHeight;
    this.timestamp = other.timestamp;
    return this;
  }

  serialize() {
    return {
      ...super.serialize(),
      nodeId: this.nodeId,
      oldWidth: this.oldWidth,
      oldHeight: this.oldHeight,
      newWidth: this.newWidth,
      newHeight: this.newHeight
    };
  }
}

/**
 * Batch Delete Nodes Command
 *
 * Deletes multiple nodes at once. Useful for delete selection.
 * Uses individual DeleteNodeCommands internally but presents as one undo action.
 */
export class BatchDeleteNodesCommand extends Command {
  /**
   * @param {string[]} nodeIds - Array of node IDs to delete
   */
  constructor(nodeIds) {
    super();
    this.nodeIds = [...nodeIds];
    this._deleteCommands = [];
  }

  get description() {
    return `Delete ${this.nodeIds.length} nodes`;
  }

  get type() {
    return 'batch-delete-nodes';
  }

  execute() {
    // Create and execute individual delete commands
    this._deleteCommands = this.nodeIds.map(id => {
      const cmd = new DeleteNodeCommand(id);
      cmd.execute();
      return cmd;
    });
  }

  undo() {
    // Undo in reverse order
    for (let i = this._deleteCommands.length - 1; i >= 0; i--) {
      this._deleteCommands[i].undo();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      nodeIds: this.nodeIds,
      deleteCommands: this._deleteCommands.map(cmd => cmd.serialize())
    };
  }
}
