/**
 * Connection System
 *
 * Centralized exports for the connection management system.
 *
 * @module connections
 */

// Core managers
export { ConnectionManager, connectionManager, ConnectionType } from './ConnectionManager.js';
export { ConnectionValidator, connectionValidator } from './ConnectionValidator.js';
export { ConnectionRenderer, connectionRenderer } from './ConnectionRenderer.js';
export { ConnectionContextMenu, connectionContextMenu } from './ConnectionContextMenu.js';

// Connection types
export { ConnectionType as ConnectionTypeBase } from './types/ConnectionType.js';
export { DataConnection } from './types/DataConnection.js';
export { ReferenceConnection, ReferenceSubtype } from './types/ReferenceConnection.js';
export { FlowConnection, FlowSubtype } from './types/FlowConnection.js';
export { ConnectionTypeRegistry, connectionTypeRegistry } from './types/ConnectionTypeRegistry.js';
