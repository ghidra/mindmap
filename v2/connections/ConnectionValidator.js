/**
 * Connection Validator
 *
 * Validates connections between ports based on configurable rules.
 *
 * Validation Rules:
 * 1. Cannot connect port to itself
 * 2. Input ports connect to output ports (and vice versa)
 * 3. Data types must be compatible
 * 4. Maximum connections per port not exceeded
 * 5. No duplicate connections
 * 6. Node-type specific rules
 *
 * @see ARCHITECTURE_PLAN.md Module 3 for full documentation
 */

import { state } from '../state.js';
import { portSystem } from '../core/PortSystem.js';
import { nodeTypeRegistry } from '../node-types/NodeTypeRegistry.js';

/**
 * Data type compatibility matrix.
 * true = compatible, false = incompatible, 'coerce' = compatible with coercion
 */
const DATA_TYPE_COMPATIBILITY = {
  // 'any' type is compatible with everything
  any: {
    any: true, number: true, string: true, boolean: true,
    array: true, object: true, function: true, unknown: true
  },
  number: {
    any: true, number: true, string: 'coerce', boolean: 'coerce',
    array: false, object: false, function: false, unknown: true
  },
  string: {
    any: true, number: 'coerce', string: true, boolean: 'coerce',
    array: false, object: false, function: false, unknown: true
  },
  boolean: {
    any: true, number: 'coerce', string: 'coerce', boolean: true,
    array: false, object: false, function: false, unknown: true
  },
  array: {
    any: true, number: false, string: false, boolean: false,
    array: true, object: false, function: false, unknown: true
  },
  object: {
    any: true, number: false, string: false, boolean: false,
    array: false, object: true, function: false, unknown: true
  },
  function: {
    any: true, number: false, string: false, boolean: false,
    array: false, object: false, function: true, unknown: true
  },
  unknown: {
    any: true, number: true, string: true, boolean: true,
    array: true, object: true, function: true, unknown: true
  }
};

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether connection is valid
 * @property {string} [reason] - Reason for invalid connection
 * @property {string[]} [warnings] - Non-fatal warnings
 */

/**
 * @typedef {Object} ValidationRule
 * @property {string} id - Rule identifier
 * @property {string} name - Rule display name
 * @property {boolean} enabled - Whether rule is active
 * @property {Function} validate - Validation function
 */

/**
 * Connection Validator class.
 */
export class ConnectionValidator {
  /**
   * Create a new ConnectionValidator.
   *
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.strictTypeChecking=false] - Reject coercible types
   * @param {boolean} [options.allowSelfConnection=false] - Allow connecting node to itself
   * @param {number} [options.defaultMaxConnections=-1] - Default max connections per port
   */
  constructor(options = {}) {
    /**
     * Whether to reject coercible type connections.
     * @type {boolean}
     */
    this.strictTypeChecking = options.strictTypeChecking ?? false;

    /**
     * Whether to allow connecting a node to itself (different ports).
     * @type {boolean}
     */
    this.allowSelfConnection = options.allowSelfConnection ?? false;

    /**
     * Default maximum connections per port.
     * @type {number}
     */
    this.defaultMaxConnections = options.defaultMaxConnections ?? -1;

    /**
     * Custom validation rules.
     * @type {Map<string, ValidationRule>}
     * @private
     */
    this._customRules = new Map();

    /**
     * Port system reference.
     * @type {PortSystem}
     */
    this.portSystem = portSystem;
  }

  // =========================================================================
  // Main Validation
  // =========================================================================

  /**
   * Check if a connection can be made between two endpoints.
   *
   * @param {Object} from - Source endpoint {nodeId, portId}
   * @param {Object} to - Target endpoint {nodeId, portId}
   * @param {Object} [fromNode] - Source node (optional, will be looked up)
   * @param {Object} [toNode] - Target node (optional, will be looked up)
   * @returns {ValidationResult}
   */
  canConnect(from, to, fromNode = null, toNode = null) {
    const warnings = [];

    // Get nodes if not provided
    fromNode = fromNode || this._findNode(from.nodeId);
    toNode = toNode || this._findNode(to.nodeId);

    if (!fromNode) {
      return { valid: false, reason: `Source node not found: ${from.nodeId}` };
    }
    if (!toNode) {
      return { valid: false, reason: `Target node not found: ${to.nodeId}` };
    }

    // Get ports
    const fromPort = this._getPort(fromNode, from.portId);
    const toPort = this._getPort(toNode, to.portId);

    if (!fromPort) {
      return { valid: false, reason: `Source port not found: ${from.portId}` };
    }
    if (!toPort) {
      return { valid: false, reason: `Target port not found: ${to.portId}` };
    }

    // Rule 1: Cannot connect port to itself
    const selfCheck = this._checkSelfConnection(from, to, fromNode, toNode);
    if (!selfCheck.valid) return selfCheck;

    // Rule 2: Port type compatibility (input/output)
    const portTypeCheck = this._checkPortTypes(fromPort, toPort);
    if (!portTypeCheck.valid) return portTypeCheck;

    // Rule 3: Data type compatibility
    const dataTypeCheck = this._checkDataTypes(fromPort, toPort);
    if (!dataTypeCheck.valid) return dataTypeCheck;
    if (dataTypeCheck.warning) warnings.push(dataTypeCheck.warning);

    // Rule 4: Max connections check
    const maxConnCheck = this._checkMaxConnections(from, to, fromPort, toPort);
    if (!maxConnCheck.valid) return maxConnCheck;

    // Rule 5: Duplicate connection check
    const duplicateCheck = this._checkDuplicate(from, to);
    if (!duplicateCheck.valid) return duplicateCheck;

    // Rule 6: Node type specific rules
    const nodeTypeCheck = this._checkNodeTypeRules(fromPort, toPort, fromNode, toNode);
    if (!nodeTypeCheck.valid) return nodeTypeCheck;
    if (nodeTypeCheck.warnings) warnings.push(...nodeTypeCheck.warnings);

    // Run custom rules
    for (const rule of this._customRules.values()) {
      if (!rule.enabled) continue;

      const result = rule.validate(from, to, fromNode, toNode, fromPort, toPort);
      if (!result.valid) {
        return { valid: false, reason: `Rule '${rule.name}': ${result.reason}` };
      }
      if (result.warning) warnings.push(result.warning);
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Get all compatible ports for a source port.
   *
   * @param {string} sourceNodeId - Source node ID
   * @param {string} sourcePortId - Source port ID
   * @param {Object[]} [targetNodes] - Nodes to search (defaults to all nodes)
   * @returns {Array<{nodeId: string, portId: string, port: Object, compatibility: string}>}
   */
  getCompatiblePorts(sourceNodeId, sourcePortId, targetNodes = null) {
    const sourceNode = this._findNode(sourceNodeId);
    if (!sourceNode) return [];

    const sourcePort = this._getPort(sourceNode, sourcePortId);
    if (!sourcePort) return [];

    const compatible = [];
    const nodes = targetNodes || this._getAllNodes();

    for (const node of nodes) {
      const ports = this._getNodePorts(node);

      for (const port of ports) {
        // Skip same port
        if (node.id === sourceNodeId && port.id === sourcePortId) continue;

        const validation = this.canConnect(
          { nodeId: sourceNodeId, portId: sourcePortId },
          { nodeId: node.id, portId: port.id },
          sourceNode,
          node
        );

        if (validation.valid) {
          compatible.push({
            nodeId: node.id,
            portId: port.id,
            port,
            compatibility: validation.warnings ? 'coerce' : 'exact'
          });
        }
      }
    }

    return compatible;
  }

  /**
   * Validate an existing connection.
   *
   * @param {Object} connection - Connection object
   * @returns {ValidationResult}
   */
  validateConnection(connection) {
    return this.canConnect(connection.from, connection.to);
  }

  /**
   * Validate all connections and return invalid ones.
   *
   * @returns {Array<{connection: Object, reason: string}>}
   */
  validateAllConnections() {
    const invalid = [];

    for (const connection of state.connections) {
      const result = this.validateConnection(connection);
      if (!result.valid) {
        invalid.push({ connection, reason: result.reason });
      }
    }

    return invalid;
  }

  // =========================================================================
  // Individual Rule Checks
  // =========================================================================

  /**
   * Check for self-connection.
   * @private
   */
  _checkSelfConnection(from, to, fromNode, toNode) {
    // Same port on same node - always invalid
    if (from.nodeId === to.nodeId && from.portId === to.portId) {
      return { valid: false, reason: 'Cannot connect a port to itself' };
    }

    // Same node, different ports
    if (from.nodeId === to.nodeId && !this.allowSelfConnection) {
      return { valid: false, reason: 'Cannot connect a node to itself' };
    }

    return { valid: true };
  }

  /**
   * Check port type compatibility (input/output).
   * @private
   */
  _checkPortTypes(fromPort, toPort) {
    // Bidirectional ports can connect to anything
    if (fromPort.type === 'bidirectional' || toPort.type === 'bidirectional') {
      return { valid: true };
    }

    // Output to input
    if (fromPort.type === 'output' && toPort.type === 'input') {
      return { valid: true };
    }

    // Input to output
    if (fromPort.type === 'input' && toPort.type === 'output') {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Cannot connect ${fromPort.type} port to ${toPort.type} port`
    };
  }

  /**
   * Check data type compatibility.
   * @private
   */
  _checkDataTypes(fromPort, toPort) {
    const fromType = fromPort.dataType || 'unknown';
    const toType = toPort.dataType || 'unknown';

    // Get compatibility
    const compat = this._getDataTypeCompatibility(fromType, toType);

    if (compat === true) {
      return { valid: true };
    }

    if (compat === 'coerce') {
      if (this.strictTypeChecking) {
        return {
          valid: false,
          reason: `Type mismatch: ${fromType} → ${toType} (strict mode)`
        };
      }
      return {
        valid: true,
        warning: `Type coercion: ${fromType} → ${toType}`
      };
    }

    return {
      valid: false,
      reason: `Incompatible types: ${fromType} → ${toType}`
    };
  }

  /**
   * Check maximum connections constraint.
   * @private
   */
  _checkMaxConnections(from, to, fromPort, toPort) {
    // Check source port max connections
    const fromMax = fromPort.maxConnections ?? this.defaultMaxConnections;
    if (fromMax > 0) {
      const fromCount = this._getConnectionCount(from.nodeId, from.portId);
      if (fromCount >= fromMax) {
        return {
          valid: false,
          reason: `Source port has reached maximum connections (${fromMax})`
        };
      }
    }

    // Check target port max connections
    const toMax = toPort.maxConnections ?? this.defaultMaxConnections;
    if (toMax > 0) {
      const toCount = this._getConnectionCount(to.nodeId, to.portId);
      if (toCount >= toMax) {
        return {
          valid: false,
          reason: `Target port has reached maximum connections (${toMax})`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check for duplicate connection.
   * @private
   */
  _checkDuplicate(from, to) {
    const exists = state.connections.some(c =>
      c.from.nodeId === from.nodeId &&
      c.from.portId === from.portId &&
      c.to.nodeId === to.nodeId &&
      c.to.portId === to.portId
    );

    if (exists) {
      return { valid: false, reason: 'Connection already exists' };
    }

    return { valid: true };
  }

  /**
   * Check node type specific rules.
   * @private
   */
  _checkNodeTypeRules(fromPort, toPort, fromNode, toNode) {
    const warnings = [];

    // Get node type definitions
    const fromTypeDef = nodeTypeRegistry.get(fromNode.type);
    const toTypeDef = nodeTypeRegistry.get(toNode.type);

    // Check if from type allows outgoing connections
    if (fromTypeDef?.canConnect) {
      const result = fromTypeDef.canConnect(fromPort, toPort, fromNode, toNode);
      if (result === false) {
        return { valid: false, reason: `${fromNode.type} does not allow this connection` };
      }
      if (typeof result === 'object' && !result.valid) {
        return result;
      }
    }

    // Check if to type allows incoming connections
    if (toTypeDef?.canConnect) {
      const result = toTypeDef.canConnect(fromPort, toPort, fromNode, toNode);
      if (result === false) {
        return { valid: false, reason: `${toNode.type} does not allow this connection` };
      }
      if (typeof result === 'object' && !result.valid) {
        return result;
      }
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  // =========================================================================
  // Custom Rules
  // =========================================================================

  /**
   * Add a custom validation rule.
   *
   * @param {string} id - Rule identifier
   * @param {string} name - Rule display name
   * @param {Function} validate - Validation function (from, to, fromNode, toNode, fromPort, toPort) => {valid, reason?}
   */
  addRule(id, name, validate) {
    this._customRules.set(id, {
      id,
      name,
      enabled: true,
      validate
    });
  }

  /**
   * Remove a custom validation rule.
   *
   * @param {string} id - Rule identifier
   */
  removeRule(id) {
    this._customRules.delete(id);
  }

  /**
   * Enable/disable a custom rule.
   *
   * @param {string} id - Rule identifier
   * @param {boolean} enabled - Whether to enable
   */
  setRuleEnabled(id, enabled) {
    const rule = this._customRules.get(id);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all custom rules.
   *
   * @returns {ValidationRule[]}
   */
  getRules() {
    return Array.from(this._customRules.values());
  }

  // =========================================================================
  // Data Type Helpers
  // =========================================================================

  /**
   * Get compatibility between two data types.
   *
   * @param {string} fromType - Source data type
   * @param {string} toType - Target data type
   * @returns {boolean|'coerce'}
   * @private
   */
  _getDataTypeCompatibility(fromType, toType) {
    const row = DATA_TYPE_COMPATIBILITY[fromType];
    if (!row) return DATA_TYPE_COMPATIBILITY.unknown[toType] ?? true;
    return row[toType] ?? true;
  }

  /**
   * Check if two data types are compatible.
   *
   * @param {string} fromType - Source data type
   * @param {string} toType - Target data type
   * @returns {boolean}
   */
  areTypesCompatible(fromType, toType) {
    const compat = this._getDataTypeCompatibility(fromType, toType);
    if (this.strictTypeChecking) {
      return compat === true;
    }
    return compat === true || compat === 'coerce';
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Find a node by ID.
   * @private
   */
  _findNode(nodeId) {
    // Search in state.nodes (hierarchical mode)
    const searchNodes = (nodes) => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = searchNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    // Try state.nodes
    if (state.nodes) {
      const found = searchNodes(state.nodes);
      if (found) return found;
    }

    // Try flow mode execution graph
    if (state.flowConfig?.executionGraph?.nodes) {
      const found = state.flowConfig.executionGraph.nodes.find(n => n.id === nodeId);
      if (found) return found;
    }

    // Try notes mode
    if (state.notesData?.nodes) {
      const found = state.notesData.nodes.find(n => n.id === nodeId);
      if (found) return found;
    }

    return null;
  }

  /**
   * Get all nodes.
   * @private
   */
  _getAllNodes() {
    const nodes = [];

    const collectNodes = (nodeList) => {
      for (const node of nodeList) {
        nodes.push(node);
        if (node.children) {
          collectNodes(node.children);
        }
      }
    };

    if (state.nodes) collectNodes(state.nodes);

    return nodes;
  }

  /**
   * Get port from node.
   * @private
   */
  _getPort(node, portId) {
    // Try port system first
    const registeredPort = this.portSystem.getPort(node.id, portId);
    if (registeredPort) return registeredPort;

    // Try node's ports array
    if (node.ports) {
      return node.ports.find(p => p.id === portId) || null;
    }

    // Try getting ports from node type
    const ports = this._getNodePorts(node);
    return ports.find(p => p.id === portId) || null;
  }

  /**
   * Get all ports for a node.
   * @private
   */
  _getNodePorts(node) {
    // Try port system first
    const registeredPorts = this.portSystem.getPorts(node.id);
    if (registeredPorts.length > 0) return registeredPorts;

    // Try node's ports array
    if (node.ports) return node.ports;

    // Get from node type definition
    const typeDef = nodeTypeRegistry.get(node.type);
    if (typeDef) {
      if (typeDef.getPorts) {
        return typeDef.getPorts(node);
      }
      if (typeDef.defaultPorts) {
        return typeDef.defaultPorts;
      }
    }

    return [];
  }

  /**
   * Get connection count for a port.
   * @private
   */
  _getConnectionCount(nodeId, portId) {
    return state.connections.filter(c =>
      (c.from.nodeId === nodeId && c.from.portId === portId) ||
      (c.to.nodeId === nodeId && c.to.portId === portId)
    ).length;
  }
}

/**
 * Singleton ConnectionValidator instance.
 * @type {ConnectionValidator}
 */
export const connectionValidator = new ConnectionValidator();
