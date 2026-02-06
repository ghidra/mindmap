/**
 * Connection Type Registry
 *
 * Central registry for connection type definitions.
 * Manages registration and lookup of connection types.
 */

import { ConnectionType } from './ConnectionType.js';
import { DataConnection } from './DataConnection.js';
import { ReferenceConnection } from './ReferenceConnection.js';
import { FlowConnection } from './FlowConnection.js';

/**
 * Connection Type Registry class.
 */
export class ConnectionTypeRegistry {
  constructor() {
    /**
     * Registered connection types.
     * @type {Map<string, typeof ConnectionType>}
     * @private
     */
    this._types = new Map();

    // Register built-in types
    this._registerBuiltinTypes();
  }

  /**
   * Register built-in connection types.
   * @private
   */
  _registerBuiltinTypes() {
    this.register(ConnectionType);    // Base type
    this.register(DataConnection);
    this.register(ReferenceConnection);
    this.register(FlowConnection);
  }

  // =========================================================================
  // Registration
  // =========================================================================

  /**
   * Register a connection type.
   *
   * @param {typeof ConnectionType} typeClass - Connection type class
   * @throws {Error} If type ID is missing or already registered
   */
  register(typeClass) {
    if (!typeClass.id) {
      throw new Error('Connection type must have an id');
    }

    if (this._types.has(typeClass.id)) {
      console.warn(`Connection type '${typeClass.id}' already registered, overwriting`);
    }

    this._types.set(typeClass.id, typeClass);
  }

  /**
   * Unregister a connection type.
   *
   * @param {string} typeId - Type ID to unregister
   * @returns {boolean} Whether type was removed
   */
  unregister(typeId) {
    return this._types.delete(typeId);
  }

  // =========================================================================
  // Lookup
  // =========================================================================

  /**
   * Get a connection type by ID.
   *
   * @param {string} typeId - Type ID
   * @returns {typeof ConnectionType|null}
   */
  get(typeId) {
    return this._types.get(typeId) || null;
  }

  /**
   * Check if a type is registered.
   *
   * @param {string} typeId - Type ID
   * @returns {boolean}
   */
  has(typeId) {
    return this._types.has(typeId);
  }

  /**
   * Get all registered types.
   *
   * @returns {Array<typeof ConnectionType>}
   */
  getAll() {
    return Array.from(this._types.values());
  }

  /**
   * Get all type IDs.
   *
   * @returns {string[]}
   */
  getTypeIds() {
    return Array.from(this._types.keys());
  }

  // =========================================================================
  // Style Access
  // =========================================================================

  /**
   * Get default style for a connection type.
   *
   * @param {string} typeId - Type ID
   * @returns {Object}
   */
  getDefaultStyle(typeId) {
    const type = this.get(typeId);
    return type ? type.getDefaultStyle() : ConnectionType.getDefaultStyle();
  }

  /**
   * Get style for a connection.
   *
   * @param {Object} connection - Connection object
   * @returns {Object}
   */
  getConnectionStyle(connection) {
    const type = this.get(connection.type);
    if (type) {
      return type.getStyle(connection.style);
    }
    return ConnectionType.getStyle(connection.style);
  }

  /**
   * Get state-based style for a connection.
   *
   * @param {Object} connection - Connection object
   * @param {Object} state - Connection state (selected, hovered, etc.)
   * @returns {Object}
   */
  getStateStyle(connection, state) {
    const type = this.get(connection.type);
    if (type) {
      return type.getStateStyle(connection, state);
    }
    return ConnectionType.getStateStyle(connection, state);
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Check if a connection type allows the given connection.
   *
   * @param {string} typeId - Connection type ID
   * @param {Object} fromPort - Source port
   * @param {Object} toPort - Target port
   * @param {Object} fromNode - Source node
   * @param {Object} toNode - Target node
   * @returns {{valid: boolean, reason?: string}}
   */
  canConnect(typeId, fromPort, toPort, fromNode, toNode) {
    const type = this.get(typeId);
    if (type && type.canConnect) {
      return type.canConnect(fromPort, toPort, fromNode, toNode);
    }
    return { valid: true };
  }

  // =========================================================================
  // Animation
  // =========================================================================

  /**
   * Get animation config for a connection.
   *
   * @param {Object} connection - Connection object
   * @returns {Object|null}
   */
  getAnimationConfig(connection) {
    const type = this.get(connection.type);
    if (type && type.getAnimationConfig) {
      return type.getAnimationConfig(connection);
    }
    return null;
  }

  // =========================================================================
  // Label
  // =========================================================================

  /**
   * Get label config for a connection.
   *
   * @param {Object} connection - Connection object
   * @returns {Object|null}
   */
  getLabelConfig(connection) {
    const type = this.get(connection.type);
    if (type && type.getLabelConfig) {
      return type.getLabelConfig(connection);
    }
    return null;
  }

  /**
   * Get suggested label for a connection.
   *
   * @param {string} typeId - Connection type ID
   * @param {Object} fromPort - Source port
   * @param {Object} toPort - Target port
   * @param {Object} fromNode - Source node
   * @param {Object} toNode - Target node
   * @returns {string}
   */
  getSuggestedLabel(typeId, fromPort, toPort, fromNode, toNode) {
    const type = this.get(typeId);
    if (type && type.getSuggestedLabel) {
      return type.getSuggestedLabel(fromPort, toPort, fromNode, toNode);
    }
    return '';
  }

  // =========================================================================
  // Info
  // =========================================================================

  /**
   * Get info for all registered types.
   *
   * @returns {Object[]}
   */
  getAllInfo() {
    return this.getAll().map(type => type.getInfo());
  }

  /**
   * Get info for a specific type.
   *
   * @param {string} typeId - Type ID
   * @returns {Object|null}
   */
  getInfo(typeId) {
    const type = this.get(typeId);
    return type ? type.getInfo() : null;
  }
}

/**
 * Singleton ConnectionTypeRegistry instance.
 * @type {ConnectionTypeRegistry}
 */
export const connectionTypeRegistry = new ConnectionTypeRegistry();
