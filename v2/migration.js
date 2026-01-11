/**
 * Migration Utilities
 * Helps transition from legacy system to new modular framework
 */

import { state, save } from './state.js';
import { nodeTypeRegistry } from './node-types/NodeTypeRegistry.js';

/**
 * Migrate all legacy nodes to new format
 */
export function migrateLegacyNodes() {
  console.log('Starting node migration...');
  let migrated = 0;

  const migrateNodeRecursive = (node) => {
    let changed = false;

    // Convert position format
    if (node.x !== undefined && !node.position) {
      node.position = { x: node.x, y: node.y };
      changed = true;
    }

    // Convert size format
    if (node.width !== undefined && !node.size) {
      node.size = { width: node.width, height: node.height || 100 };
      changed = true;
    }

    // Ensure ports array exists
    if (!node.ports) {
      node.ports = [];

      // Add default port based on type
      const typeDef = nodeTypeRegistry.get(node.type);
      if (typeDef && typeDef.defaultPorts) {
        node.ports = JSON.parse(JSON.stringify(typeDef.defaultPorts));
      } else if (node.type !== 'note' && node.type !== 'group') {
        // Generic output port
        node.ports.push({
          id: 'output',
          side: 'right',
          type: 'output',
          position: 0.5,
          label: 'out'
        });
      }

      changed = true;
    }

    // Migrate note nodes to 4-sided ports
    if ((node.type === 'note' || node.isNote) && node.ports.length === 0) {
      node.ports = [
        { id: 'top', side: 'top', type: 'bidirectional', position: 0.5 },
        { id: 'right', side: 'right', type: 'bidirectional', position: 0.5 },
        { id: 'bottom', side: 'bottom', type: 'bidirectional', position: 0.5 },
        { id: 'left', side: 'left', type: 'bidirectional', position: 0.5 }
      ];
      changed = true;
    }

    // Convert style format
    if (node.color && !node.style) {
      node.style = {
        color: node.color,
        borderColor: '#cccccc',
        borderWidth: 1
      };
      changed = true;
    }

    // Convert attributes to object if array
    if (Array.isArray(node.attributes)) {
      const attrObj = {};
      node.attributes.forEach(attr => {
        attrObj[attr.name] = attr.value;
      });
      node.attributes = attrObj;
      changed = true;
    }

    // Recursively migrate children
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        if (migrateNodeRecursive(child)) {
          changed = true;
        }
      });
    }

    if (changed) {
      migrated++;
    }

    return changed;
  };

  state.nodes.forEach(node => {
    migrateNodeRecursive(node);
  });

  console.log(`✓ Migrated ${migrated} nodes to new format`);

  if (migrated > 0) {
    save();
  }

  return migrated;
}

/**
 * Migrate legacy connections to new format
 */
export function migrateLegacyConnections() {
  console.log('Migrating legacy connections...');
  let migrated = 0;

  const processNode = (node) => {
    if (node.connections && Array.isArray(node.connections)) {
      node.connections.forEach(toId => {
        // Check if connection already exists in new format
        const exists = state.connections.some(
          c => c.from.nodeId === node.id && c.to.nodeId === toId
        );

        if (!exists) {
          state.connections.push({
            id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from: { nodeId: node.id, portId: 'output' },
            to: { nodeId: toId, portId: 'input' },
            style: {
              stroke: '#666',
              strokeWidth: 2
            }
          });
          migrated++;
        }
      });

      // Clear old connections array
      node.connections = [];
    }

    // Recursively process children
    if (node.children) {
      node.children.forEach(child => processNode(child));
    }
  };

  state.nodes.forEach(node => processNode(node));

  console.log(`✓ Migrated ${migrated} connections to new format`);

  if (migrated > 0) {
    save();
  }

  return migrated;
}

/**
 * Clean up legacy properties from nodes
 */
export function cleanupLegacyProperties() {
  console.log('Cleaning up legacy properties...');
  let cleaned = 0;

  const cleanNode = (node) => {
    let changed = false;

    // Remove legacy position properties if new format exists
    if (node.position && node.x !== undefined) {
      delete node.x;
      delete node.y;
      delete node.flowX;
      delete node.flowY;
      changed = true;
    }

    // Remove legacy size properties if new format exists
    if (node.size && node.width !== undefined) {
      delete node.width;
      delete node.height;
      changed = true;
    }

    // Remove legacy color if style exists
    if (node.style && node.color !== undefined) {
      delete node.color;
      changed = true;
    }

    // Remove empty connections array
    if (Array.isArray(node.connections) && node.connections.length === 0) {
      delete node.connections;
      changed = true;
    }

    // Recursively clean children
    if (node.children) {
      node.children.forEach(child => {
        if (cleanNode(child)) {
          changed = true;
        }
      });
    }

    if (changed) {
      cleaned++;
    }

    return changed;
  };

  state.nodes.forEach(node => cleanNode(node));

  console.log(`✓ Cleaned ${cleaned} nodes`);

  if (cleaned > 0) {
    save();
  }

  return cleaned;
}

/**
 * Run full migration
 */
export function runFullMigration() {
  console.log('=== Starting Full Migration ===');

  const nodesMigrated = migrateLegacyNodes();
  const connectionsMigrated = migrateLegacyConnections();

  console.log('=== Migration Complete ===');
  console.log(`  Nodes migrated: ${nodesMigrated}`);
  console.log(`  Connections migrated: ${connectionsMigrated}`);

  return {
    nodesMigrated,
    connectionsMigrated
  };
}

/**
 * Validate migrated data
 */
export function validateMigration() {
  console.log('Validating migration...');
  const issues = [];

  const validateNode = (node, path = '') => {
    const nodePath = path ? `${path} > ${node.title}` : node.title;

    // Check required properties
    if (!node.id) issues.push(`${nodePath}: Missing id`);
    if (!node.type) issues.push(`${nodePath}: Missing type`);

    // Check position format
    if (!node.position || typeof node.position.x !== 'number') {
      issues.push(`${nodePath}: Invalid position format`);
    }

    // Check size format
    if (!node.size || typeof node.size.width !== 'number') {
      issues.push(`${nodePath}: Invalid size format`);
    }

    // Check ports
    if (!Array.isArray(node.ports)) {
      issues.push(`${nodePath}: Ports must be an array`);
    }

    // Validate children
    if (node.children) {
      node.children.forEach(child => validateNode(child, nodePath));
    }
  };

  state.nodes.forEach(node => validateNode(node));

  // Validate connections
  state.connections.forEach((conn, index) => {
    if (!conn.from || !conn.from.nodeId) {
      issues.push(`Connection ${index}: Invalid from reference`);
    }
    if (!conn.to || !conn.to.nodeId) {
      issues.push(`Connection ${index}: Invalid to reference`);
    }
  });

  if (issues.length === 0) {
    console.log('✓ Validation passed - no issues found');
  } else {
    console.error(`✗ Validation failed - ${issues.length} issues found:`);
    issues.forEach(issue => console.error(`  - ${issue}`));
  }

  return issues;
}
