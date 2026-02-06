/**
 * Session Format
 *
 * Defines the session file format and provides validation/migration utilities.
 *
 * @see ARCHITECTURE_PLAN.md Module 9.1 for full documentation
 */

/**
 * Current session format version.
 * Increment when making breaking changes to the format.
 * @type {string}
 */
export const SESSION_VERSION = '1.0';

/**
 * File extension for session files.
 * @type {string}
 */
export const SESSION_FILE_EXTENSION = '.mindmap';

/**
 * MIME type for session files.
 * @type {string}
 */
export const SESSION_MIME_TYPE = 'application/json';

/**
 * Session file format schema.
 *
 * @typedef {Object} SessionFile
 * @property {string} version - Format version
 * @property {string} savedAt - ISO timestamp when saved
 * @property {string} name - Session name
 * @property {ProjectData|null} project - Parsed project data
 * @property {ViewStates} views - View states for all modes
 * @property {UIState} ui - Current UI state
 * @property {Object} [metadata] - Optional metadata
 */

/**
 * @typedef {Object} ProjectData
 * @property {string} id - Project identifier
 * @property {string} name - Project name
 * @property {string} rootPath - Original project root path
 * @property {Object} files - Parsed file data
 * @property {Object} graph - Pre-computed relationship graph
 * @property {string} parsedAt - ISO timestamp when parsed
 */

/**
 * @typedef {Object} ViewStates
 * @property {ViewState} hierarchical - Hierarchical mode state
 * @property {ViewState} flow - Flow mode state
 * @property {ViewState} notes - Notes mode state
 */

/**
 * @typedef {Object} ViewState
 * @property {Array} nodes - Visual nodes with positions
 * @property {Array} connections - Connections
 * @property {Viewport} viewport - Viewport state
 * @property {Array} [path] - Navigation path (hierarchical mode)
 * @property {string|null} [focusedNode] - Focused node (flow mode)
 * @property {Array} [navigationStack] - Navigation history (flow mode)
 */

/**
 * @typedef {Object} Viewport
 * @property {number} x - Pan X offset
 * @property {number} y - Pan Y offset
 * @property {number} zoom - Zoom level
 */

/**
 * @typedef {Object} UIState
 * @property {string} currentMode - Active mode
 * @property {Array} selectedNodes - Selected node IDs
 */

/**
 * Create an empty session object.
 *
 * @param {string} [name='Untitled'] - Session name
 * @returns {SessionFile}
 */
export function createEmptySession(name = 'Untitled') {
  return {
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
    name,

    project: null,

    views: {
      hierarchical: {
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        path: []
      },
      flow: {
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        focusedNode: null,
        navigationStack: []
      },
      notes: {
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },

    ui: {
      currentMode: 'hierarchical',
      selectedNodes: []
    },

    metadata: {
      createdAt: new Date().toISOString(),
      application: 'mindmap',
      applicationVersion: '2.0'
    }
  };
}

/**
 * Validate a session object.
 *
 * @param {Object} session - Session object to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateSession(session) {
  const errors = [];

  // Check required fields
  if (!session) {
    errors.push('Session is null or undefined');
    return { valid: false, errors };
  }

  if (!session.version) {
    errors.push('Missing version field');
  }

  if (!session.views) {
    errors.push('Missing views field');
  } else {
    // Check view states
    const requiredViews = ['hierarchical', 'flow', 'notes'];
    for (const viewName of requiredViews) {
      if (!session.views[viewName]) {
        errors.push(`Missing ${viewName} view state`);
      } else {
        const view = session.views[viewName];
        if (!Array.isArray(view.nodes)) {
          errors.push(`${viewName}.nodes must be an array`);
        }
        if (!view.viewport) {
          errors.push(`${viewName}.viewport is required`);
        }
      }
    }
  }

  if (!session.ui) {
    errors.push('Missing ui field');
  } else {
    if (!session.ui.currentMode) {
      errors.push('Missing ui.currentMode');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Migrate a session to the current format version.
 *
 * @param {Object} session - Session to migrate
 * @returns {SessionFile} Migrated session
 */
export function migrateSession(session) {
  if (!session.version) {
    session.version = '0.0';
  }

  const version = parseFloat(session.version);

  // Migration from legacy format (pre-1.0)
  if (version < 1.0) {
    session = migrateLegacySession(session);
  }

  // Future migrations would go here...

  // Ensure version is current
  session.version = SESSION_VERSION;

  return session;
}

/**
 * Migrate a legacy session (pre-1.0) to current format.
 *
 * @param {Object} legacy - Legacy session data
 * @returns {SessionFile}
 */
function migrateLegacySession(legacy) {
  // Legacy format stored nodes directly in state
  const session = createEmptySession(legacy.name || 'Migrated Session');

  // Migrate nodes
  if (Array.isArray(legacy.nodes)) {
    session.views.hierarchical.nodes = legacy.nodes;
  }

  // Migrate connections
  if (Array.isArray(legacy.connections)) {
    session.views.hierarchical.connections = legacy.connections;
  }

  // Migrate viewport
  if (legacy.viewport) {
    session.views.hierarchical.viewport = {
      x: legacy.viewport.x || legacy.panX || 0,
      y: legacy.viewport.y || legacy.panY || 0,
      zoom: legacy.viewport.zoom || 1
    };
  } else if (legacy.panX !== undefined || legacy.panY !== undefined) {
    session.views.hierarchical.viewport = {
      x: legacy.panX || 0,
      y: legacy.panY || 0,
      zoom: 1
    };
  }

  // Migrate current mode
  if (legacy.currentMode) {
    session.ui.currentMode = legacy.currentMode;
  }

  // Migrate path
  if (Array.isArray(legacy.path)) {
    session.views.hierarchical.path = legacy.path;
  }

  // Migrate notes
  if (legacy.notesData && Array.isArray(legacy.notesData.nodes)) {
    session.views.notes.nodes = legacy.notesData.nodes;
  }

  // Migrate flow config
  if (legacy.flowConfig) {
    session.views.flow.focusedNode = legacy.flowConfig.focusedNode || null;
    session.views.flow.navigationStack = legacy.flowConfig.navigationStack || [];
  }

  session.metadata = {
    ...session.metadata,
    migratedFrom: 'legacy',
    migratedAt: new Date().toISOString()
  };

  return session;
}

/**
 * Compare two session versions.
 *
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * Generate a default session name based on current date/time.
 *
 * @returns {string}
 */
export function generateSessionName() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
  return `mindmap-${date}-${time}`;
}

/**
 * Get suggested filename for a session.
 *
 * @param {SessionFile} session - Session object
 * @returns {string}
 */
export function getSessionFilename(session) {
  const name = session.name || generateSessionName();
  // Sanitize filename
  const sanitized = name
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return `${sanitized}${SESSION_FILE_EXTENSION}`;
}
