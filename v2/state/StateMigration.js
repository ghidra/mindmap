/**
 * State Migration
 *
 * Handles migration from the legacy state.js format to the new
 * StateManager/Store architecture.
 *
 * Supports:
 * - Reading legacy localStorage formats
 * - Converting to new state structure
 * - Backwards compatibility during transition
 * - One-time migration with cleanup
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { stateManager } from './StateManager.js';
import { projectStore } from './stores/ProjectStore.js';
import { viewStore } from './stores/ViewStore.js';
import { localStorageAdapter } from './io/LocalStorageAdapter.js';
import { serializer, FORMAT_VERSION } from './Serializer.js';

/**
 * Legacy localStorage keys.
 */
const LEGACY_KEYS = {
  MINDMAP: 'mindmap',
  NOTES: 'mindmap-notes'
};

/**
 * New localStorage keys (with prefix).
 */
const NEW_KEYS = {
  MIGRATED_FLAG: 'state/_migrated',
  MIGRATION_BACKUP: 'state/_migration_backup'
};

/**
 * @typedef {Object} LegacyState
 * @property {Object[]} nodes - Hierarchical nodes
 * @property {string} currentMode - Current mode
 * @property {Object} flowConfig - Flow configuration
 * @property {number} panX - Pan X offset
 * @property {number} panY - Pan Y offset
 * @property {string} savedAt - Save timestamp
 */

/**
 * @typedef {Object} LegacyNotesState
 * @property {Object[]} nodes - Notes nodes
 * @property {Object[]} connections - Notes connections
 * @property {string} savedAt - Save timestamp
 */

/**
 * @typedef {Object} MigrationResult
 * @property {boolean} success - Whether migration succeeded
 * @property {boolean} migrated - Whether data was actually migrated
 * @property {string[]} warnings - Any warnings during migration
 * @property {string} [error] - Error message if failed
 */

/**
 * State Migration class.
 */
export class StateMigration {
  constructor() {
    /**
     * Migration warnings.
     * @type {string[]}
     */
    this.warnings = [];
  }

  /**
   * Check if migration is needed.
   *
   * @returns {Promise<boolean>} True if migration needed
   */
  async needsMigration() {
    // Check if already migrated
    const migrated = await localStorageAdapter.load(NEW_KEYS.MIGRATED_FLAG);
    if (migrated) {
      return false;
    }

    // Check if legacy data exists
    const legacyData = localStorage.getItem(LEGACY_KEYS.MINDMAP);
    const legacyNotes = localStorage.getItem(LEGACY_KEYS.NOTES);

    return !!(legacyData || legacyNotes);
  }

  /**
   * Run the migration.
   *
   * @param {Object} [options] - Migration options
   * @param {boolean} [options.backup=true] - Create backup of legacy data
   * @param {boolean} [options.cleanup=false] - Remove legacy data after migration
   * @returns {Promise<MigrationResult>} Migration result
   */
  async migrate(options = {}) {
    const { backup = true, cleanup = false } = options;

    this.warnings = [];

    try {
      // Initialize stores
      await localStorageAdapter.initialize();
      await projectStore.initialize();
      await viewStore.initialize();

      // Check if migration needed
      const needsMigration = await this.needsMigration();
      if (!needsMigration) {
        return {
          success: true,
          migrated: false,
          warnings: ['No migration needed - already migrated or no legacy data']
        };
      }

      // Create backup
      if (backup) {
        await this._createBackup();
      }

      // Read legacy data
      const legacyState = this._readLegacyState();
      const legacyNotes = this._readLegacyNotes();

      // Migrate hierarchical/flow data
      if (legacyState) {
        await this._migrateMainState(legacyState);
      }

      // Migrate notes
      if (legacyNotes) {
        await this._migrateNotes(legacyNotes);
      }

      // Mark as migrated
      await localStorageAdapter.save(NEW_KEYS.MIGRATED_FLAG, {
        migratedAt: Date.now(),
        fromVersion: 'legacy',
        toVersion: FORMAT_VERSION
      });

      // Cleanup if requested
      if (cleanup) {
        this._cleanupLegacyData();
      }

      return {
        success: true,
        migrated: true,
        warnings: this.warnings
      };
    } catch (error) {
      console.error('StateMigration: Migration failed:', error);
      return {
        success: false,
        migrated: false,
        warnings: this.warnings,
        error: error.message
      };
    }
  }

  /**
   * Read legacy main state from localStorage.
   *
   * @returns {LegacyState|null} Legacy state or null
   * @private
   */
  _readLegacyState() {
    const saved = localStorage.getItem(LEGACY_KEYS.MINDMAP);
    if (!saved) return null;

    try {
      const data = JSON.parse(saved);

      // Handle very old format (just nodes array)
      if (Array.isArray(data)) {
        return {
          nodes: data,
          currentMode: 'hierarchical',
          flowConfig: this._getDefaultFlowConfig(),
          panX: 0,
          panY: 0
        };
      }

      return data;
    } catch (error) {
      this.warnings.push(`Failed to parse legacy state: ${error.message}`);
      return null;
    }
  }

  /**
   * Read legacy notes from localStorage.
   *
   * @returns {LegacyNotesState|null} Legacy notes or null
   * @private
   */
  _readLegacyNotes() {
    const saved = localStorage.getItem(LEGACY_KEYS.NOTES);
    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch (error) {
      this.warnings.push(`Failed to parse legacy notes: ${error.message}`);
      return null;
    }
  }

  /**
   * Migrate main state (hierarchical/flow).
   *
   * @param {LegacyState} legacyState - Legacy state
   * @private
   */
  async _migrateMainState(legacyState) {
    // Extract and convert nodes to hierarchical view
    const hierarchicalNodes = this._convertNodes(legacyState.nodes || []);
    const hierarchicalConnections = this._extractConnections(legacyState.nodes || []);

    // Set hierarchical view state
    viewStore.setViewState('hierarchical', {
      nodes: hierarchicalNodes,
      connections: hierarchicalConnections,
      viewport: {
        x: legacyState.panX || 0,
        y: legacyState.panY || 0,
        zoom: 1
      },
      path: [],
      selection: []
    });

    // Set flow view state
    const flowConfig = legacyState.flowConfig || this._getDefaultFlowConfig();
    viewStore.setViewState('flow', {
      nodes: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      focusedNode: flowConfig.focusedNode || null,
      navigationStack: flowConfig.navigationStack || [],
      executionGraph: null, // Don't migrate - regenerate on demand
      flowType: flowConfig.flowType || 'entry-point'
    });

    // Set UI state
    const currentMode = legacyState.currentMode || 'hierarchical';
    // Don't restore flow mode - start in hierarchical
    stateManager.set('ui.currentMode', currentMode === 'flow' ? 'hierarchical' : currentMode);

    // Save view state
    await viewStore.saveUIState();

    console.log(`StateMigration: Migrated ${hierarchicalNodes.length} nodes`);
  }

  /**
   * Migrate notes.
   *
   * @param {LegacyNotesState} legacyNotes - Legacy notes
   * @private
   */
  async _migrateNotes(legacyNotes) {
    const notesNodes = this._convertNotesNodes(legacyNotes.nodes || []);
    const notesConnections = this._convertNotesConnections(legacyNotes.connections || []);

    viewStore.setViewState('notes', {
      nodes: notesNodes,
      connections: notesConnections,
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    await viewStore.saveNotes();

    console.log(`StateMigration: Migrated ${notesNodes.length} notes`);
  }

  /**
   * Convert legacy nodes to new format.
   *
   * @param {Object[]} nodes - Legacy nodes
   * @returns {Object[]} Converted nodes
   * @private
   */
  _convertNodes(nodes) {
    return nodes.map(node => this._convertNode(node));
  }

  /**
   * Convert a single legacy node.
   *
   * @param {Object} node - Legacy node
   * @returns {Object} Converted node
   * @private
   */
  _convertNode(node) {
    const converted = {
      id: node.id,
      type: node.type || 'file',
      name: node.name || node.title || 'Unnamed',
      x: node.x || node.position?.x || 0,
      y: node.y || node.position?.y || 0,
      width: node.width || 180,
      height: node.height || 100,
      collapsed: node.collapsed || false,
      expanded: node.expanded !== false
    };

    // Copy type-specific properties
    if (node.path) converted.path = node.path;
    if (node.content) converted.content = node.content;
    if (node.fileContent) converted.fileContent = node.fileContent;
    if (node.language) converted.language = node.language;
    if (node.icon) converted.icon = node.icon;
    if (node.color) converted.color = node.color;
    if (node.description) converted.description = node.description;
    if (node.attributes) converted.attributes = [...node.attributes];
    if (node.methods) converted.methods = [...node.methods];
    if (node.properties) converted.properties = [...node.properties];
    if (node.params) converted.params = [...node.params];
    if (node.returnType) converted.returnType = node.returnType;
    if (node.async) converted.async = node.async;
    if (node.static) converted.static = node.static;
    if (node.visibility) converted.visibility = node.visibility;

    // Ports
    if (node.inputPorts) converted.inputPorts = [...node.inputPorts];
    if (node.outputPorts) converted.outputPorts = [...node.outputPorts];

    // Parent reference (use ID, not object)
    if (node.parentId) converted.parentId = node.parentId;

    // Convert children recursively
    if (node.children && node.children.length > 0) {
      converted.children = node.children.map(child => this._convertNode(child));
    }

    // Handle childNodes (lazy-loaded children)
    if (node.childNodes && node.childNodes.length > 0) {
      if (!converted.children) converted.children = [];
      converted.children.push(...node.childNodes.map(child => this._convertNode(child)));
    }

    return converted;
  }

  /**
   * Extract connections from nodes (legacy format stored in nodes).
   *
   * @param {Object[]} nodes - Legacy nodes
   * @returns {Object[]} Connections
   * @private
   */
  _extractConnections(nodes) {
    const connections = [];

    const extractFromNode = (node) => {
      // Legacy connections stored in node.connections
      if (node.connections && Array.isArray(node.connections)) {
        for (const conn of node.connections) {
          connections.push({
            id: conn.id || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            from: conn.from || { nodeId: node.id, portId: 'output' },
            to: conn.to || { nodeId: conn.targetId, portId: 'input' },
            type: conn.type || 'reference'
          });
        }
      }

      // Recurse into children
      if (node.children) {
        node.children.forEach(extractFromNode);
      }
      if (node.childNodes) {
        node.childNodes.forEach(extractFromNode);
      }
    };

    nodes.forEach(extractFromNode);
    return connections;
  }

  /**
   * Convert legacy notes nodes.
   *
   * @param {Object[]} nodes - Legacy notes nodes
   * @returns {Object[]} Converted nodes
   * @private
   */
  _convertNotesNodes(nodes) {
    return nodes.map(node => ({
      id: node.id,
      type: 'note',
      name: node.title || 'Note',
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || 200,
      height: node.height || 120,
      color: node.color || '#ffffff',
      description: node.description || '',
      showDescription: node.showDescription || false,
      titleFontSize: node.titleFontSize || 14,
      descriptionFontSize: node.descriptionFontSize || 14,
      titleColor: node.titleColor || '#000000',
      descriptionColor: node.descriptionColor || '#000000'
    }));
  }

  /**
   * Convert legacy notes connections.
   *
   * @param {Object[]} connections - Legacy connections
   * @returns {Object[]} Converted connections
   * @private
   */
  _convertNotesConnections(connections) {
    return connections.map(conn => ({
      id: conn.id || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      from: typeof conn.from === 'string'
        ? { nodeId: conn.from, portId: 'output' }
        : conn.from,
      to: typeof conn.to === 'string'
        ? { nodeId: conn.to, portId: 'input' }
        : conn.to,
      type: conn.type || 'reference'
    }));
  }

  /**
   * Get default flow configuration.
   *
   * @returns {Object} Default flow config
   * @private
   */
  _getDefaultFlowConfig() {
    return {
      layoutDirection: 'top-down',
      entryPoint: null,
      executionGraph: null,
      flowType: 'entry-point',
      tracedNode: null,
      traceDirection: 'forward',
      traceDepth: 10,
      focusedNode: null,
      navigationStack: [],
      flowGroups: []
    };
  }

  /**
   * Create backup of legacy data.
   * @private
   */
  async _createBackup() {
    const backup = {
      timestamp: Date.now(),
      mindmap: localStorage.getItem(LEGACY_KEYS.MINDMAP),
      notes: localStorage.getItem(LEGACY_KEYS.NOTES)
    };

    await localStorageAdapter.save(NEW_KEYS.MIGRATION_BACKUP, backup);
    console.log('StateMigration: Created backup of legacy data');
  }

  /**
   * Cleanup legacy data after migration.
   * @private
   */
  _cleanupLegacyData() {
    localStorage.removeItem(LEGACY_KEYS.MINDMAP);
    localStorage.removeItem(LEGACY_KEYS.NOTES);
    console.log('StateMigration: Cleaned up legacy data');
  }

  /**
   * Restore from backup (if migration failed).
   *
   * @returns {Promise<boolean>} Success
   */
  async restoreFromBackup() {
    try {
      const backup = await localStorageAdapter.load(NEW_KEYS.MIGRATION_BACKUP);
      if (!backup) {
        console.warn('StateMigration: No backup found');
        return false;
      }

      if (backup.mindmap) {
        localStorage.setItem(LEGACY_KEYS.MINDMAP, backup.mindmap);
      }
      if (backup.notes) {
        localStorage.setItem(LEGACY_KEYS.NOTES, backup.notes);
      }

      // Clear migration flag
      await localStorageAdapter.delete(NEW_KEYS.MIGRATED_FLAG);

      console.log('StateMigration: Restored from backup');
      return true;
    } catch (error) {
      console.error('StateMigration: Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Check if backup exists.
   *
   * @returns {Promise<boolean>} Has backup
   */
  async hasBackup() {
    return localStorageAdapter.exists(NEW_KEYS.MIGRATION_BACKUP);
  }

  /**
   * Delete backup.
   *
   * @returns {Promise<boolean>} Success
   */
  async deleteBackup() {
    return localStorageAdapter.delete(NEW_KEYS.MIGRATION_BACKUP);
  }

  /**
   * Get migration status.
   *
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    const migrated = await localStorageAdapter.load(NEW_KEYS.MIGRATED_FLAG);
    const hasBackup = await this.hasBackup();
    const hasLegacy = !!(
      localStorage.getItem(LEGACY_KEYS.MINDMAP) ||
      localStorage.getItem(LEGACY_KEYS.NOTES)
    );

    return {
      migrated: !!migrated,
      migratedAt: migrated?.migratedAt,
      fromVersion: migrated?.fromVersion,
      toVersion: migrated?.toVersion,
      hasBackup,
      hasLegacyData: hasLegacy
    };
  }
}

/**
 * Singleton StateMigration instance.
 * @type {StateMigration}
 */
export const stateMigration = new StateMigration();

/**
 * Run migration automatically on import (can be disabled).
 *
 * @param {Object} [options] - Options
 * @returns {Promise<MigrationResult>} Result
 */
export async function runAutoMigration(options = {}) {
  const needsMigration = await stateMigration.needsMigration();

  if (needsMigration) {
    console.log('StateMigration: Auto-migration starting...');
    const result = await stateMigration.migrate(options);

    if (result.success && result.migrated) {
      console.log('StateMigration: Auto-migration complete');
    } else if (!result.success) {
      console.error('StateMigration: Auto-migration failed:', result.error);
    }

    return result;
  }

  return {
    success: true,
    migrated: false,
    warnings: []
  };
}
