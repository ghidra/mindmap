/**
 * Session Manager
 *
 * Handles saving, loading, exporting, and importing complete sessions.
 * A session contains all project data and view states.
 *
 * @see ARCHITECTURE_PLAN.md Module 9.2 for full documentation
 */

import { state, save as saveToLocalStorage, load as loadFromLocalStorage } from '../state.js';
import { settingsManager } from '../settings/SettingsManager.js';
import {
  SESSION_VERSION,
  SESSION_FILE_EXTENSION,
  SESSION_MIME_TYPE,
  createEmptySession,
  validateSession,
  migrateSession,
  getSessionFilename,
  generateSessionName
} from './SessionFormat.js';

/**
 * LocalStorage key for current session metadata.
 * @type {string}
 */
const SESSION_META_KEY = 'mindmap-session-meta';

/**
 * LocalStorage key for auto-saved session.
 * @type {string}
 */
const AUTO_SAVE_KEY = 'mindmap';

/**
 * Session Manager class.
 */
export class SessionManager {
  /**
   * Create a new SessionManager instance.
   */
  constructor() {
    /**
     * Current session metadata.
     * @type {Object|null}
     * @private
     */
    this._currentSession = null;

    /**
     * Snapshot of last saved state (for dirty checking).
     * @type {string|null}
     * @private
     */
    this._lastSavedSnapshot = null;

    /**
     * Change listeners.
     * @type {Set<Function>}
     * @private
     */
    this._listeners = new Set();

    /**
     * Render callback.
     * @type {Function|null}
     */
    this.onRenderNeeded = null;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the session manager.
   */
  init() {
    // Load session metadata
    this._loadSessionMeta();

    // Set up auto-save if enabled
    if (settingsManager.get('autoSave')) {
      this._setupAutoSave();
    }

    // Listen for settings changes
    settingsManager.onChange('autoSave', (key, value) => {
      if (value) {
        this._setupAutoSave();
      }
    });

    console.log('SessionManager initialized');
  }

  /**
   * Load session metadata from localStorage.
   * @private
   */
  _loadSessionMeta() {
    try {
      const stored = localStorage.getItem(SESSION_META_KEY);
      if (stored) {
        this._currentSession = JSON.parse(stored);
      } else {
        this._currentSession = {
          name: 'Untitled Session',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('SessionManager: Failed to load session meta:', error);
      this._currentSession = {
        name: 'Untitled Session',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Save session metadata to localStorage.
   * @private
   */
  _saveSessionMeta() {
    try {
      localStorage.setItem(SESSION_META_KEY, JSON.stringify(this._currentSession));
    } catch (error) {
      console.error('SessionManager: Failed to save session meta:', error);
    }
  }

  /**
   * Set up auto-save.
   * @private
   */
  _setupAutoSave() {
    const interval = settingsManager.get('autoSaveInterval') || 30000;

    // Clear existing interval if any
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
    }

    this._autoSaveInterval = setInterval(() => {
      if (this.hasUnsavedChanges()) {
        this.saveToStorage();
        console.log('Auto-saved session');
      }
    }, interval);
  }

  // =========================================================================
  // Session Operations
  // =========================================================================

  /**
   * Create a new empty session.
   *
   * @param {string} [name] - Session name
   * @returns {boolean} True if new session was created
   */
  newSession(name = null) {
    // Check for unsaved changes
    if (this.hasUnsavedChanges()) {
      if (!confirm('You have unsaved changes. Create a new session anyway?')) {
        return false;
      }
    }

    // Clear current state
    state.nodes = [];
    state.connections = [];
    state.path = [];
    state.selectedNodes = [];
    state.currentMode = 'hierarchical';
    state.viewport = { x: 0, y: 0, zoom: 1 };
    state.notesData = { nodes: [], connections: [] };
    state.flowConfig = {
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

    // Create new session metadata
    this._currentSession = {
      name: name || generateSessionName(),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this._saveSessionMeta();
    this._updateSnapshot();

    // Notify listeners
    this._notifyListeners('new');

    // Trigger render
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }

    return true;
  }

  /**
   * Get the current session name.
   *
   * @returns {string}
   */
  getSessionName() {
    return this._currentSession?.name || 'Untitled Session';
  }

  /**
   * Set the current session name.
   *
   * @param {string} name - New session name
   */
  setSessionName(name) {
    if (this._currentSession) {
      this._currentSession.name = name;
      this._currentSession.modifiedAt = new Date().toISOString();
      this._saveSessionMeta();
      this._notifyListeners('rename');
    }
  }

  // =========================================================================
  // Save Operations
  // =========================================================================

  /**
   * Save the current session to localStorage (auto-save).
   */
  saveToStorage() {
    // Update modification time
    if (this._currentSession) {
      this._currentSession.modifiedAt = new Date().toISOString();
      this._saveSessionMeta();
    }

    // Save state using existing save function
    saveToLocalStorage();

    // Update snapshot
    this._updateSnapshot();
  }

  /**
   * Export the current session to a downloadable file.
   *
   * @param {string} [filename] - Custom filename
   */
  exportSession(filename = null) {
    const session = this.buildSession();

    const blob = new Blob(
      [JSON.stringify(session, null, 2)],
      { type: SESSION_MIME_TYPE }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || getSessionFilename(session);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Add to recent projects
    settingsManager.addRecentProject(
      `exported:${session.name}`,
      session.name
    );

    console.log('Session exported:', a.download);
  }

  /**
   * Build a complete session object from current state.
   *
   * @returns {SessionFile}
   */
  buildSession() {
    return {
      version: SESSION_VERSION,
      savedAt: new Date().toISOString(),
      name: this.getSessionName(),

      project: state.projectData || null,

      views: {
        hierarchical: {
          nodes: state.nodes,
          connections: state.connections || [],
          viewport: { ...state.viewport },
          path: [...(state.path || [])]
        },
        flow: {
          nodes: state.flowConfig?.executionGraph?.nodes || [],
          connections: [],
          viewport: { ...state.viewport },
          focusedNode: state.flowConfig?.focusedNode || null,
          navigationStack: [...(state.flowConfig?.navigationStack || [])]
        },
        notes: {
          nodes: state.notesData?.nodes || [],
          connections: state.notesData?.connections || [],
          viewport: { ...state.viewport }
        }
      },

      ui: {
        currentMode: state.currentMode,
        selectedNodes: [...(state.selectedNodes || [])]
      },

      metadata: {
        createdAt: this._currentSession?.createdAt || new Date().toISOString(),
        application: 'mindmap',
        applicationVersion: '2.0'
      }
    };
  }

  // =========================================================================
  // Load Operations
  // =========================================================================

  /**
   * Load session from localStorage.
   */
  loadFromStorage() {
    loadFromLocalStorage();
    this._loadSessionMeta();
    this._updateSnapshot();
  }

  /**
   * Import a session from a file.
   *
   * @param {File} file - File to import
   * @returns {Promise<boolean>} True if import was successful
   */
  async importSession(file) {
    // Check for unsaved changes
    if (this.hasUnsavedChanges()) {
      if (!confirm('You have unsaved changes. Import a new session anyway?')) {
        return false;
      }
    }

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      // Validate
      const validation = validateSession(data);
      if (!validation.valid) {
        // Try to migrate if it's a legacy format
        const migrated = migrateSession(data);
        const revalidation = validateSession(migrated);

        if (!revalidation.valid) {
          throw new Error(`Invalid session file: ${revalidation.errors.join(', ')}`);
        }

        this._applySession(migrated);
      } else {
        this._applySession(data);
      }

      // Add to recent
      settingsManager.addRecentProject(
        `imported:${file.name}`,
        data.name || file.name
      );

      console.log('Session imported:', file.name);
      return true;
    } catch (error) {
      console.error('Failed to import session:', error);
      alert('Failed to import session: ' + error.message);
      return false;
    }
  }

  /**
   * Apply a session object to current state.
   *
   * @param {SessionFile} session - Session to apply
   * @private
   */
  _applySession(session) {
    // Apply hierarchical view state
    if (session.views?.hierarchical) {
      state.nodes = session.views.hierarchical.nodes || [];
      state.connections = session.views.hierarchical.connections || [];
      state.path = session.views.hierarchical.path || [];
      state.viewport = session.views.hierarchical.viewport || { x: 0, y: 0, zoom: 1 };
    }

    // Apply notes state
    if (session.views?.notes) {
      state.notesData = {
        nodes: session.views.notes.nodes || [],
        connections: session.views.notes.connections || []
      };
    }

    // Apply flow config
    if (session.views?.flow) {
      state.flowConfig = {
        ...state.flowConfig,
        focusedNode: session.views.flow.focusedNode || null,
        navigationStack: session.views.flow.navigationStack || []
      };
    }

    // Apply UI state
    if (session.ui) {
      state.currentMode = session.ui.currentMode || 'hierarchical';
      state.selectedNodes = session.ui.selectedNodes || [];
    }

    // Apply project data
    if (session.project) {
      state.projectData = session.project;
    }

    // Update session metadata
    this._currentSession = {
      name: session.name || 'Imported Session',
      createdAt: session.metadata?.createdAt || new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this._saveSessionMeta();
    this._updateSnapshot();
    this._notifyListeners('import');

    // Save to localStorage
    saveToLocalStorage();

    // Trigger render
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }

  // =========================================================================
  // Dirty State
  // =========================================================================

  /**
   * Check if there are unsaved changes.
   *
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    const currentSnapshot = this._createSnapshot();
    return currentSnapshot !== this._lastSavedSnapshot;
  }

  /**
   * Update the last saved snapshot.
   * @private
   */
  _updateSnapshot() {
    this._lastSavedSnapshot = this._createSnapshot();
  }

  /**
   * Create a snapshot of current state for comparison.
   *
   * @returns {string}
   * @private
   */
  _createSnapshot() {
    // Create a simplified snapshot for comparison
    const snapshot = {
      nodes: state.nodes?.length || 0,
      nodesHash: state.nodes ? JSON.stringify(state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))) : '',
      connections: state.connections?.length || 0,
      notesNodes: state.notesData?.nodes?.length || 0,
      currentMode: state.currentMode,
      path: state.path?.join('/') || ''
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Mark the session as saved (clear dirty state).
   */
  markAsSaved() {
    this._updateSnapshot();
  }

  // =========================================================================
  // Recent Sessions
  // =========================================================================

  /**
   * Get recent sessions from settings.
   *
   * @returns {Array}
   */
  getRecentSessions() {
    return settingsManager.getRecentProjects();
  }

  /**
   * Clear recent sessions.
   */
  clearRecentSessions() {
    settingsManager.clearRecentProjects();
  }

  // =========================================================================
  // File Picker
  // =========================================================================

  /**
   * Open a file picker dialog to import a session.
   *
   * @returns {Promise<boolean>}
   */
  async openFilePicker() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `${SESSION_FILE_EXTENSION},.json`;

      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const result = await this.importSession(file);
          resolve(result);
        } else {
          resolve(false);
        }
      };

      input.oncancel = () => resolve(false);

      input.click();
    });
  }

  // =========================================================================
  // Listeners
  // =========================================================================

  /**
   * Add a session change listener.
   *
   * @param {Function} callback - Called with (event, data)
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Notify listeners of a change.
   *
   * @param {string} event - Event type
   * @param {*} [data] - Event data
   * @private
   */
  _notifyListeners(event, data = null) {
    this._listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('SessionManager: Listener error:', error);
      }
    });
  }

  // =========================================================================
  // Window Events
  // =========================================================================

  /**
   * Set up beforeunload handler to warn about unsaved changes.
   */
  setupBeforeUnloadHandler() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Clean up resources.
   */
  destroy() {
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
    }
    this._listeners.clear();
  }
}

/**
 * Singleton session manager instance.
 * @type {SessionManager}
 */
export const sessionManager = new SessionManager();
