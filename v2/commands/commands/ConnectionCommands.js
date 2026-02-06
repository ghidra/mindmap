/**
 * Connection Commands
 *
 * Commands for creating and deleting connections between nodes.
 * These commands integrate with the CommandManager for undo/redo support.
 *
 * @see ARCHITECTURE_PLAN.md Module 7 for documentation
 */

import { Command } from '../Command.js';
import { state, addConnection, removeConnection, save, saveNotes } from '../../state.js';

/**
 * Create Connection Command
 *
 * Creates a new connection between two nodes/ports.
 * Handles both port-based connections (hierarchical/flow) and simple connections (notes).
 */
export class CreateConnectionCommand extends Command {
  /**
   * @param {Object} connectionData - The connection data
   * @param {string} connectionData.id - Connection ID (auto-generated if not provided)
   * @param {Object|string} connectionData.from - Source (nodeId+portId object or just nodeId for notes)
   * @param {Object|string} connectionData.to - Target (nodeId+portId object or just nodeId for notes)
   * @param {Object} connectionData.style - Optional style properties
   * @param {Object} options - Additional options
   * @param {string} options.mode - Override mode ('hierarchical' | 'notes' | 'flow')
   */
  constructor(connectionData, options = {}) {
    super();

    // Generate ID if not provided
    this.connectionData = {
      id: connectionData.id || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: connectionData.from,
      to: connectionData.to,
      style: connectionData.style || {
        stroke: '#666',
        strokeWidth: 2,
        strokeDasharray: null,
        animated: false
      }
    };

    this.mode = options.mode || state.currentMode;
    this._addedToNotes = false;
  }

  get description() {
    const fromId = typeof this.connectionData.from === 'string'
      ? this.connectionData.from
      : this.connectionData.from.nodeId;
    const toId = typeof this.connectionData.to === 'string'
      ? this.connectionData.to
      : this.connectionData.to.nodeId;
    return `Connect ${fromId} → ${toId}`;
  }

  get type() {
    return 'create-connection';
  }

  execute() {
    const connection = JSON.parse(JSON.stringify(this.connectionData));

    if (this.mode === 'notes') {
      // Notes mode - simpler connection format
      if (!state.notesData.connections) {
        state.notesData.connections = [];
      }

      // Check for duplicates
      const exists = state.notesData.connections.some(c =>
        c.from === connection.from && c.to === connection.to
      );

      if (!exists) {
        state.notesData.connections.push(connection);
        this._addedToNotes = true;
      }
      saveNotes();
    } else {
      // Hierarchical/flow mode - port-based connections
      // Use the state's addConnection which checks for duplicates
      addConnection(connection);
      save();
    }
  }

  undo() {
    const connId = this.connectionData.id;

    if (this._addedToNotes || this.mode === 'notes') {
      // Remove from notes
      if (state.notesData.connections) {
        const index = state.notesData.connections.findIndex(c => c.id === connId);
        if (index !== -1) {
          state.notesData.connections.splice(index, 1);
        }
      }
      saveNotes();
    } else {
      // Remove from main state
      removeConnection(connId);
      save();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      connectionData: this.connectionData,
      mode: this.mode
    };
  }
}

/**
 * Delete Connection Command
 *
 * Deletes a connection.
 * Captures all connection data for undo (restore the connection).
 */
export class DeleteConnectionCommand extends Command {
  /**
   * @param {string} connectionId - ID of the connection to delete
   * @param {Object} options - Additional options
   * @param {string} options.mode - Override mode ('hierarchical' | 'notes' | 'flow')
   */
  constructor(connectionId, options = {}) {
    super();

    this.connectionId = connectionId;
    this.mode = options.mode || state.currentMode;

    // Will be populated during execute()
    this._connectionData = null;
    this._wasInNotes = false;
    this._index = -1;
  }

  get description() {
    if (this._connectionData) {
      const fromId = typeof this._connectionData.from === 'string'
        ? this._connectionData.from
        : this._connectionData.from?.nodeId;
      const toId = typeof this._connectionData.to === 'string'
        ? this._connectionData.to
        : this._connectionData.to?.nodeId;
      return `Disconnect ${fromId} → ${toId}`;
    }
    return `Delete connection`;
  }

  get type() {
    return 'delete-connection';
  }

  execute() {
    // Try to find in notes first
    if (this.mode === 'notes' || state.notesData?.connections) {
      const index = state.notesData.connections?.findIndex(c => c.id === this.connectionId);
      if (index !== undefined && index !== -1) {
        this._connectionData = JSON.parse(JSON.stringify(state.notesData.connections[index]));
        this._wasInNotes = true;
        this._index = index;
        state.notesData.connections.splice(index, 1);
        saveNotes();
        return;
      }
    }

    // Try main state connections
    const index = state.connections.findIndex(c => c.id === this.connectionId);
    if (index !== -1) {
      this._connectionData = JSON.parse(JSON.stringify(state.connections[index]));
      this._index = index;
      state.connections.splice(index, 1);
      save();
    } else {
      console.warn(`DeleteConnectionCommand: Connection ${this.connectionId} not found`);
    }
  }

  undo() {
    if (!this._connectionData) {
      console.warn('DeleteConnectionCommand.undo: No connection data captured');
      return;
    }

    const connection = JSON.parse(JSON.stringify(this._connectionData));

    if (this._wasInNotes) {
      if (!state.notesData.connections) {
        state.notesData.connections = [];
      }
      // Insert at original index if possible
      if (this._index >= 0 && this._index <= state.notesData.connections.length) {
        state.notesData.connections.splice(this._index, 0, connection);
      } else {
        state.notesData.connections.push(connection);
      }
      saveNotes();
    } else {
      // Insert at original index if possible
      if (this._index >= 0 && this._index <= state.connections.length) {
        state.connections.splice(this._index, 0, connection);
      } else {
        state.connections.push(connection);
      }
      save();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      connectionId: this.connectionId,
      mode: this.mode,
      connectionData: this._connectionData,
      wasInNotes: this._wasInNotes,
      index: this._index
    };
  }
}

/**
 * Batch Delete Connections Command
 *
 * Deletes multiple connections at once.
 * Useful when deleting a node and its connections.
 */
export class BatchDeleteConnectionsCommand extends Command {
  /**
   * @param {string[]} connectionIds - Array of connection IDs to delete
   */
  constructor(connectionIds) {
    super();
    this.connectionIds = [...connectionIds];
    this._deleteCommands = [];
  }

  get description() {
    return `Delete ${this.connectionIds.length} connections`;
  }

  get type() {
    return 'batch-delete-connections';
  }

  execute() {
    this._deleteCommands = this.connectionIds.map(id => {
      const cmd = new DeleteConnectionCommand(id);
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
      connectionIds: this.connectionIds,
      deleteCommands: this._deleteCommands.map(cmd => cmd.serialize())
    };
  }
}

/**
 * Reconnect Command
 *
 * Changes a connection's source or target.
 * Useful for drag-reconnecting connections.
 */
export class ReconnectCommand extends Command {
  /**
   * @param {string} connectionId - ID of the connection to modify
   * @param {Object} newEndpoint - New endpoint { from: {...} } or { to: {...} }
   */
  constructor(connectionId, newEndpoint) {
    super();

    this.connectionId = connectionId;
    this.newEndpoint = JSON.parse(JSON.stringify(newEndpoint));

    // Will be populated during execute()
    this._oldEndpoint = null;
    this._isFromChange = 'from' in newEndpoint;
  }

  get description() {
    return `Reconnect`;
  }

  get type() {
    return 'reconnect';
  }

  execute() {
    // Find the connection
    let connection = state.connections.find(c => c.id === this.connectionId);
    let inNotes = false;

    if (!connection && state.notesData?.connections) {
      connection = state.notesData.connections.find(c => c.id === this.connectionId);
      inNotes = true;
    }

    if (!connection) {
      console.warn(`ReconnectCommand: Connection ${this.connectionId} not found`);
      return;
    }

    // Capture old endpoint
    if (this._isFromChange) {
      this._oldEndpoint = { from: JSON.parse(JSON.stringify(connection.from)) };
      connection.from = JSON.parse(JSON.stringify(this.newEndpoint.from));
    } else {
      this._oldEndpoint = { to: JSON.parse(JSON.stringify(connection.to)) };
      connection.to = JSON.parse(JSON.stringify(this.newEndpoint.to));
    }

    if (inNotes) {
      saveNotes();
    } else {
      save();
    }
  }

  undo() {
    if (!this._oldEndpoint) {
      console.warn('ReconnectCommand.undo: No old endpoint captured');
      return;
    }

    // Find the connection
    let connection = state.connections.find(c => c.id === this.connectionId);
    let inNotes = false;

    if (!connection && state.notesData?.connections) {
      connection = state.notesData.connections.find(c => c.id === this.connectionId);
      inNotes = true;
    }

    if (!connection) {
      console.warn(`ReconnectCommand.undo: Connection ${this.connectionId} not found`);
      return;
    }

    // Restore old endpoint
    if (this._isFromChange) {
      connection.from = JSON.parse(JSON.stringify(this._oldEndpoint.from));
    } else {
      connection.to = JSON.parse(JSON.stringify(this._oldEndpoint.to));
    }

    if (inNotes) {
      saveNotes();
    } else {
      save();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      connectionId: this.connectionId,
      newEndpoint: this.newEndpoint,
      oldEndpoint: this._oldEndpoint,
      isFromChange: this._isFromChange
    };
  }
}

/**
 * Update Connection Style Command
 *
 * Changes a connection's visual style.
 */
export class UpdateConnectionStyleCommand extends Command {
  /**
   * @param {string} connectionId - ID of the connection to modify
   * @param {Object} newStyle - New style properties to apply
   */
  constructor(connectionId, newStyle) {
    super();

    this.connectionId = connectionId;
    this.newStyle = JSON.parse(JSON.stringify(newStyle));
    this._oldStyle = null;
  }

  get description() {
    return `Update connection style`;
  }

  get type() {
    return 'update-connection-style';
  }

  execute() {
    // Find the connection
    let connection = state.connections.find(c => c.id === this.connectionId);
    let inNotes = false;

    if (!connection && state.notesData?.connections) {
      connection = state.notesData.connections.find(c => c.id === this.connectionId);
      inNotes = true;
    }

    if (!connection) {
      console.warn(`UpdateConnectionStyleCommand: Connection ${this.connectionId} not found`);
      return;
    }

    // Capture old style
    this._oldStyle = JSON.parse(JSON.stringify(connection.style || {}));

    // Apply new style (merge with existing)
    connection.style = {
      ...connection.style,
      ...this.newStyle
    };

    if (inNotes) {
      saveNotes();
    } else {
      save();
    }
  }

  undo() {
    // Find the connection
    let connection = state.connections.find(c => c.id === this.connectionId);
    let inNotes = false;

    if (!connection && state.notesData?.connections) {
      connection = state.notesData.connections.find(c => c.id === this.connectionId);
      inNotes = true;
    }

    if (!connection) {
      return;
    }

    // Restore old style
    connection.style = JSON.parse(JSON.stringify(this._oldStyle));

    if (inNotes) {
      saveNotes();
    } else {
      save();
    }
  }

  /**
   * Style updates for the same connection can be merged
   */
  canMerge(other) {
    return (
      other instanceof UpdateConnectionStyleCommand &&
      other.connectionId === this.connectionId
    );
  }

  merge(other) {
    // Merge the new styles
    this.newStyle = {
      ...this.newStyle,
      ...other.newStyle
    };
    this.timestamp = other.timestamp;
    return this;
  }

  serialize() {
    return {
      ...super.serialize(),
      connectionId: this.connectionId,
      newStyle: this.newStyle,
      oldStyle: this._oldStyle
    };
  }
}
