/**
 * Connection Manager
 *
 * Centralized manager for connection CRUD operations.
 * Handles connection creation, validation, querying, and lifecycle.
 *
 * Features:
 * - Create/delete connections with validation
 * - Query connections by node, port, type
 * - Batch operations
 * - Event notifications for changes
 * - Connection metadata management
 *
 * @see ARCHITECTURE_PLAN.md Module 3 for full documentation
 */

import { state } from '../state.js';
import { findNode } from '../state.js';

/**
 * @typedef {Object} ConnectionEndpoint
 * @property {string} nodeId - Node ID
 * @property {string} portId - Port ID
 */

/**
 * @typedef {Object} ConnectionMetadata
 * @property {string} [label] - Connection label
 * @property {number} [weight] - Connection weight (for layout algorithms)
 * @property {boolean} [bidirectional] - Whether connection is bidirectional
 * @property {Object} [data] - Custom data
 */

/**
 * @typedef {Object} ConnectionStyle
 * @property {string} [stroke] - Stroke color
 * @property {number} [strokeWidth] - Stroke width
 * @property {string} [strokeDasharray] - Dash pattern
 * @property {boolean} [animated] - Whether to show flow animation
 * @property {boolean} [showLabel] - Whether to show label
 * @property {string} [labelPosition] - Label position (start, middle, end)
 */

/**
 * @typedef {Object} Connection
 * @property {string} id - Unique connection ID
 * @property {string} type - Connection type (data, reference, flow, hierarchy)
 * @property {ConnectionEndpoint} from - Source endpoint
 * @property {ConnectionEndpoint} to - Target endpoint
 * @property {ConnectionMetadata} [metadata] - Connection metadata
 * @property {ConnectionStyle} [style] - Visual style
 * @property {number} [createdAt] - Creation timestamp
 * @property {number} [updatedAt] - Last update timestamp
 */

/**
 * Connection type constants.
 */
export const ConnectionType = {
  DATA: 'data',           // Data flow between nodes
  REFERENCE: 'reference', // Code reference (import, call, etc.)
  FLOW: 'flow',          // Execution flow
  HIERARCHY: 'hierarchy'  // Parent-child hierarchy
};

/**
 * Default styles by connection type.
 */
const DEFAULT_STYLES = {
  [ConnectionType.DATA]: {
    stroke: '#3498db',
    strokeWidth: 2,
    animated: false
  },
  [ConnectionType.REFERENCE]: {
    stroke: '#666',
    strokeWidth: 2,
    animated: false
  },
  [ConnectionType.FLOW]: {
    stroke: '#27ae60',
    strokeWidth: 2,
    animated: true
  },
  [ConnectionType.HIERARCHY]: {
    stroke: '#999',
    strokeWidth: 1,
    strokeDasharray: '5,5',
    animated: false
  }
};

/**
 * Connection Manager class.
 */
export class ConnectionManager {
  /**
   * Create a new ConnectionManager.
   */
  constructor() {
    /**
     * Event listeners.
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._listeners = new Map();

    /**
     * Connection validator (set via setValidator).
     * @type {Object|null}
     * @private
     */
    this._validator = null;

    /**
     * ID counter for generating unique IDs.
     * @type {number}
     * @private
     */
    this._idCounter = 0;
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Set the connection validator.
   *
   * @param {Object} validator - Validator with canConnect method
   */
  setValidator(validator) {
    this._validator = validator;
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Create a new connection.
   *
   * @param {Object} options - Connection options
   * @param {ConnectionEndpoint} options.from - Source endpoint
   * @param {ConnectionEndpoint} options.to - Target endpoint
   * @param {string} [options.type] - Connection type
   * @param {ConnectionMetadata} [options.metadata] - Metadata
   * @param {ConnectionStyle} [options.style] - Style overrides
   * @returns {{success: boolean, connection?: Connection, error?: string}}
   */
  create(options) {
    const { from, to, type = ConnectionType.REFERENCE, metadata = {}, style = {} } = options;

    // Validate required fields
    if (!from?.nodeId || !from?.portId) {
      return { success: false, error: 'Invalid source endpoint' };
    }
    if (!to?.nodeId || !to?.portId) {
      return { success: false, error: 'Invalid target endpoint' };
    }

    // Check for self-connection
    if (from.nodeId === to.nodeId && from.portId === to.portId) {
      return { success: false, error: 'Cannot connect port to itself' };
    }

    // Check for duplicate connection
    if (this.exists(from, to)) {
      return { success: false, error: 'Connection already exists' };
    }

    // Validate nodes exist
    const fromNode = findNode(from.nodeId);
    const toNode = findNode(to.nodeId);

    if (!fromNode) {
      return { success: false, error: `Source node not found: ${from.nodeId}` };
    }
    if (!toNode) {
      return { success: false, error: `Target node not found: ${to.nodeId}` };
    }

    // Run validator if set
    if (this._validator) {
      const validation = this._validator.canConnect(from, to, fromNode, toNode);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }
    }

    // Create connection
    const connection = {
      id: this._generateId(),
      type,
      from: { ...from },
      to: { ...to },
      metadata: { ...metadata },
      style: {
        ...DEFAULT_STYLES[type],
        ...style
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add to state
    state.connections.push(connection);

    // Emit event
    this._emit('created', { connection });

    return { success: true, connection };
  }

  /**
   * Delete a connection by ID.
   *
   * @param {string} connectionId - Connection ID
   * @returns {{success: boolean, connection?: Connection, error?: string}}
   */
  delete(connectionId) {
    const index = state.connections.findIndex(c => c.id === connectionId);

    if (index === -1) {
      return { success: false, error: `Connection not found: ${connectionId}` };
    }

    const connection = state.connections[index];
    state.connections.splice(index, 1);

    // Emit event
    this._emit('deleted', { connection });

    return { success: true, connection };
  }

  /**
   * Update a connection.
   *
   * @param {string} connectionId - Connection ID
   * @param {Object} updates - Properties to update
   * @returns {{success: boolean, connection?: Connection, error?: string}}
   */
  update(connectionId, updates) {
    const connection = this.getById(connectionId);

    if (!connection) {
      return { success: false, error: `Connection not found: ${connectionId}` };
    }

    const oldConnection = { ...connection };

    // Apply updates (don't allow changing id, from, to)
    if (updates.type) connection.type = updates.type;
    if (updates.metadata) {
      connection.metadata = { ...connection.metadata, ...updates.metadata };
    }
    if (updates.style) {
      connection.style = { ...connection.style, ...updates.style };
    }
    connection.updatedAt = Date.now();

    // Emit event
    this._emit('updated', { connection, oldConnection });

    return { success: true, connection };
  }

  /**
   * Update connection style.
   *
   * @param {string} connectionId - Connection ID
   * @param {ConnectionStyle} style - New style properties
   * @returns {{success: boolean, error?: string}}
   */
  updateStyle(connectionId, style) {
    return this.update(connectionId, { style });
  }

  /**
   * Update connection metadata.
   *
   * @param {string} connectionId - Connection ID
   * @param {ConnectionMetadata} metadata - New metadata properties
   * @returns {{success: boolean, error?: string}}
   */
  updateMetadata(connectionId, metadata) {
    return this.update(connectionId, { metadata });
  }

  // =========================================================================
  // Query Operations
  // =========================================================================

  /**
   * Get a connection by ID.
   *
   * @param {string} connectionId - Connection ID
   * @returns {Connection|null}
   */
  getById(connectionId) {
    return state.connections.find(c => c.id === connectionId) || null;
  }

  /**
   * Get all connections.
   *
   * @returns {Connection[]}
   */
  getAll() {
    return [...state.connections];
  }

  /**
   * Get connections for a node.
   *
   * @param {string} nodeId - Node ID
   * @param {Object} [options] - Filter options
   * @param {string} [options.direction] - 'incoming', 'outgoing', or 'both' (default)
   * @param {string} [options.type] - Filter by connection type
   * @returns {Connection[]}
   */
  getByNode(nodeId, options = {}) {
    const { direction = 'both', type } = options;

    return state.connections.filter(c => {
      // Filter by type
      if (type && c.type !== type) return false;

      // Filter by direction
      if (direction === 'incoming') {
        return c.to.nodeId === nodeId;
      } else if (direction === 'outgoing') {
        return c.from.nodeId === nodeId;
      } else {
        return c.from.nodeId === nodeId || c.to.nodeId === nodeId;
      }
    });
  }

  /**
   * Get connections for a specific port.
   *
   * @param {string} nodeId - Node ID
   * @param {string} portId - Port ID
   * @returns {Connection[]}
   */
  getByPort(nodeId, portId) {
    return state.connections.filter(c =>
      (c.from.nodeId === nodeId && c.from.portId === portId) ||
      (c.to.nodeId === nodeId && c.to.portId === portId)
    );
  }

  /**
   * Get connections by type.
   *
   * @param {string} type - Connection type
   * @returns {Connection[]}
   */
  getByType(type) {
    return state.connections.filter(c => c.type === type);
  }

  /**
   * Get connections between two nodes.
   *
   * @param {string} nodeId1 - First node ID
   * @param {string} nodeId2 - Second node ID
   * @returns {Connection[]}
   */
  getBetweenNodes(nodeId1, nodeId2) {
    return state.connections.filter(c =>
      (c.from.nodeId === nodeId1 && c.to.nodeId === nodeId2) ||
      (c.from.nodeId === nodeId2 && c.to.nodeId === nodeId1)
    );
  }

  /**
   * Check if a connection exists between endpoints.
   *
   * @param {ConnectionEndpoint} from - Source endpoint
   * @param {ConnectionEndpoint} to - Target endpoint
   * @returns {boolean}
   */
  exists(from, to) {
    return state.connections.some(c =>
      c.from.nodeId === from.nodeId &&
      c.from.portId === from.portId &&
      c.to.nodeId === to.nodeId &&
      c.to.portId === to.portId
    );
  }

  /**
   * Find connection between endpoints.
   *
   * @param {ConnectionEndpoint} from - Source endpoint
   * @param {ConnectionEndpoint} to - Target endpoint
   * @returns {Connection|null}
   */
  findByEndpoints(from, to) {
    return state.connections.find(c =>
      c.from.nodeId === from.nodeId &&
      c.from.portId === from.portId &&
      c.to.nodeId === to.nodeId &&
      c.to.portId === to.portId
    ) || null;
  }

  /**
   * Get count of connections for a port.
   *
   * @param {string} nodeId - Node ID
   * @param {string} portId - Port ID
   * @returns {number}
   */
  getConnectionCount(nodeId, portId) {
    return this.getByPort(nodeId, portId).length;
  }

  // =========================================================================
  // Batch Operations
  // =========================================================================

  /**
   * Create multiple connections.
   *
   * @param {Object[]} connectionOptions - Array of connection options
   * @returns {{created: Connection[], errors: string[]}}
   */
  createMany(connectionOptions) {
    const created = [];
    const errors = [];

    for (const options of connectionOptions) {
      const result = this.create(options);
      if (result.success) {
        created.push(result.connection);
      } else {
        errors.push(result.error);
      }
    }

    return { created, errors };
  }

  /**
   * Delete multiple connections.
   *
   * @param {string[]} connectionIds - Connection IDs to delete
   * @returns {{deleted: Connection[], errors: string[]}}
   */
  deleteMany(connectionIds) {
    const deleted = [];
    const errors = [];

    for (const id of connectionIds) {
      const result = this.delete(id);
      if (result.success) {
        deleted.push(result.connection);
      } else {
        errors.push(result.error);
      }
    }

    return { deleted, errors };
  }

  /**
   * Delete all connections for a node.
   *
   * @param {string} nodeId - Node ID
   * @returns {{deleted: Connection[]}}
   */
  deleteByNode(nodeId) {
    const connections = this.getByNode(nodeId);
    const connectionIds = connections.map(c => c.id);
    return this.deleteMany(connectionIds);
  }

  /**
   * Delete all connections for a port.
   *
   * @param {string} nodeId - Node ID
   * @param {string} portId - Port ID
   * @returns {{deleted: Connection[]}}
   */
  deleteByPort(nodeId, portId) {
    const connections = this.getByPort(nodeId, portId);
    const connectionIds = connections.map(c => c.id);
    return this.deleteMany(connectionIds);
  }

  /**
   * Clear all connections.
   *
   * @returns {{count: number}}
   */
  clear() {
    const count = state.connections.length;
    state.connections.length = 0;

    this._emit('cleared', { count });

    return { count };
  }

  // =========================================================================
  // Reconnection
  // =========================================================================

  /**
   * Reconnect a connection to a different endpoint.
   *
   * @param {string} connectionId - Connection ID
   * @param {string} which - 'from' or 'to'
   * @param {ConnectionEndpoint} newEndpoint - New endpoint
   * @returns {{success: boolean, connection?: Connection, error?: string}}
   */
  reconnect(connectionId, which, newEndpoint) {
    const connection = this.getById(connectionId);

    if (!connection) {
      return { success: false, error: `Connection not found: ${connectionId}` };
    }

    if (which !== 'from' && which !== 'to') {
      return { success: false, error: 'which must be "from" or "to"' };
    }

    // Validate new endpoint node exists
    const node = findNode(newEndpoint.nodeId);
    if (!node) {
      return { success: false, error: `Node not found: ${newEndpoint.nodeId}` };
    }

    // Check for self-connection
    const otherEndpoint = which === 'from' ? connection.to : connection.from;
    if (newEndpoint.nodeId === otherEndpoint.nodeId &&
        newEndpoint.portId === otherEndpoint.portId) {
      return { success: false, error: 'Cannot connect port to itself' };
    }

    // Check for duplicate
    const testFrom = which === 'from' ? newEndpoint : connection.from;
    const testTo = which === 'to' ? newEndpoint : connection.to;

    const existingConn = this.findByEndpoints(testFrom, testTo);
    if (existingConn && existingConn.id !== connectionId) {
      return { success: false, error: 'Connection already exists' };
    }

    // Run validator
    if (this._validator) {
      const fromNode = findNode(testFrom.nodeId);
      const toNode = findNode(testTo.nodeId);
      const validation = this._validator.canConnect(testFrom, testTo, fromNode, toNode);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }
    }

    // Apply change
    const oldEndpoint = { ...connection[which] };
    connection[which] = { ...newEndpoint };
    connection.updatedAt = Date.now();

    this._emit('reconnected', { connection, which, oldEndpoint, newEndpoint });

    return { success: true, connection };
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Serialize connections for storage.
   *
   * @returns {Object[]}
   */
  serialize() {
    return state.connections.map(c => ({
      id: c.id,
      type: c.type,
      from: { ...c.from },
      to: { ...c.to },
      metadata: c.metadata ? { ...c.metadata } : {},
      style: c.style ? { ...c.style } : {},
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
  }

  /**
   * Deserialize and load connections.
   *
   * @param {Object[]} data - Serialized connections
   * @param {Object} [options] - Options
   * @param {boolean} [options.replace=true] - Replace existing connections
   * @param {boolean} [options.validate=false] - Validate connections during load
   * @returns {{loaded: number, errors: string[]}}
   */
  deserialize(data, options = {}) {
    const { replace = true, validate = false } = options;

    if (replace) {
      state.connections.length = 0;
    }

    const errors = [];
    let loaded = 0;

    for (const connData of data) {
      // Basic validation
      if (!connData.id || !connData.from || !connData.to) {
        errors.push(`Invalid connection data: missing required fields`);
        continue;
      }

      // Validate nodes exist if requested
      if (validate) {
        if (!findNode(connData.from.nodeId)) {
          errors.push(`Source node not found: ${connData.from.nodeId}`);
          continue;
        }
        if (!findNode(connData.to.nodeId)) {
          errors.push(`Target node not found: ${connData.to.nodeId}`);
          continue;
        }
      }

      // Ensure defaults
      const connection = {
        id: connData.id,
        type: connData.type || ConnectionType.REFERENCE,
        from: { ...connData.from },
        to: { ...connData.to },
        metadata: connData.metadata || {},
        style: {
          ...DEFAULT_STYLES[connData.type || ConnectionType.REFERENCE],
          ...connData.style
        },
        createdAt: connData.createdAt || Date.now(),
        updatedAt: connData.updatedAt || Date.now()
      };

      state.connections.push(connection);
      loaded++;
    }

    this._emit('loaded', { loaded, errors });

    return { loaded, errors };
  }

  // =========================================================================
  // Event System
  // =========================================================================

  /**
   * Subscribe to connection events.
   *
   * Events:
   * - 'created': Connection created
   * - 'deleted': Connection deleted
   * - 'updated': Connection updated
   * - 'reconnected': Connection endpoint changed
   * - 'cleared': All connections cleared
   * - 'loaded': Connections loaded from serialized data
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from connection events.
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit an event.
   *
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @private
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`ConnectionManager event listener error:`, e);
        }
      });
    }
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Generate a unique connection ID.
   *
   * @returns {string}
   * @private
   */
  _generateId() {
    this._idCounter++;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `conn-${timestamp}-${random}-${this._idCounter}`;
  }

  /**
   * Get default style for a connection type.
   *
   * @param {string} type - Connection type
   * @returns {ConnectionStyle}
   */
  getDefaultStyle(type) {
    return { ...DEFAULT_STYLES[type] } || { ...DEFAULT_STYLES[ConnectionType.REFERENCE] };
  }

  /**
   * Get statistics about connections.
   *
   * @returns {Object}
   */
  getStats() {
    const byType = {};
    for (const type of Object.values(ConnectionType)) {
      byType[type] = 0;
    }

    state.connections.forEach(c => {
      if (byType[c.type] !== undefined) {
        byType[c.type]++;
      }
    });

    return {
      total: state.connections.length,
      byType
    };
  }
}

/**
 * Singleton ConnectionManager instance.
 * @type {ConnectionManager}
 */
export const connectionManager = new ConnectionManager();
