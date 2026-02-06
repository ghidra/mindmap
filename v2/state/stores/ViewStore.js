/**
 * View Store
 *
 * Domain store for managing mode-specific view state.
 * Each mode (hierarchical, flow, notes) has its own view state.
 *
 * Responsibilities:
 * - Store and retrieve view state per mode
 * - Manage nodes, connections, viewport for each mode
 * - Handle mode-specific state (path, selection, focused node, etc.)
 * - Persist view state to storage
 * - Emit events on view changes via StateManager
 *
 * @see ARCHITECTURE_PLAN.md Module 4 for full documentation
 */

import { stateManager } from '../StateManager.js';
import { localStorageAdapter } from '../io/LocalStorageAdapter.js';

/**
 * @typedef {Object} Viewport
 * @property {number} x - Pan X offset
 * @property {number} y - Pan Y offset
 * @property {number} zoom - Zoom level (1 = 100%)
 */

/**
 * @typedef {Object} HierarchicalViewState
 * @property {Object[]} nodes - Visual nodes with positions
 * @property {Object[]} connections - Connections between nodes
 * @property {Viewport} viewport - Pan/zoom state
 * @property {string[]} path - Breadcrumb navigation path
 * @property {string[]} selection - Selected node IDs
 */

/**
 * @typedef {Object} FlowViewState
 * @property {Object[]} nodes - Visual nodes with positions
 * @property {Object[]} connections - Connections between nodes
 * @property {Viewport} viewport - Pan/zoom state
 * @property {string|null} focusedNode - Currently focused node ID
 * @property {string[]} navigationStack - Navigation history for back button
 * @property {Object|null} executionGraph - Current execution graph
 * @property {string} flowType - Flow mode type ('entry-point' | 'node-trace' | 'focused')
 */

/**
 * @typedef {Object} NotesViewState
 * @property {Object[]} nodes - Note nodes with positions
 * @property {Object[]} connections - Connections between notes
 * @property {Viewport} viewport - Pan/zoom state
 */

/**
 * Storage key prefixes.
 */
const STORAGE_KEYS = {
  VIEW_PREFIX: 'views',
  NOTES: 'views/notes', // Notes are global, not per-project
  UI_STATE: 'ui'
};

/**
 * Default viewport.
 * @type {Viewport}
 */
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

/**
 * View Store class.
 *
 * Manages mode-specific view state with persistence.
 */
export class ViewStore {
  /**
   * Create a new ViewStore.
   */
  constructor() {
    /**
     * Whether store is initialized.
     * @type {boolean}
     * @private
     */
    this._initialized = false;
  }

  /**
   * Initialize the store.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    try {
      await localStorageAdapter.initialize();

      // Load notes (global, not per-project)
      await this._loadNotes();

      // Load UI state
      await this._loadUIState();

      this._initialized = true;
    } catch (error) {
      console.error('ViewStore: Initialization failed:', error);
      this._initialized = true;
    }
  }

  /**
   * Ensure store is initialized.
   * @private
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  // =========================================================================
  // Mode State Access
  // =========================================================================

  /**
   * Get view state for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {HierarchicalViewState|FlowViewState|NotesViewState} View state
   */
  getViewState(mode) {
    return stateManager.get(`views.${mode}`) || this._getDefaultViewState(mode);
  }

  /**
   * Set view state for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object} state - View state
   * @param {Object} [options] - Options
   * @param {boolean} [options.silent=false] - Don't emit events
   */
  setViewState(mode, state, options = {}) {
    stateManager.set(`views.${mode}`, state, options);
  }

  /**
   * Update view state for a mode (merge).
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object} updates - Partial state to merge
   * @param {Object} [options] - Options
   */
  updateViewState(mode, updates, options = {}) {
    stateManager.update(`views.${mode}`, updates, options);
  }

  /**
   * Get default view state for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {Object} Default state
   * @private
   */
  _getDefaultViewState(mode) {
    switch (mode) {
      case 'hierarchical':
        return {
          nodes: [],
          connections: [],
          viewport: { ...DEFAULT_VIEWPORT },
          path: [],
          selection: []
        };
      case 'flow':
        return {
          nodes: [],
          connections: [],
          viewport: { ...DEFAULT_VIEWPORT },
          focusedNode: null,
          navigationStack: [],
          executionGraph: null,
          flowType: 'entry-point'
        };
      case 'notes':
        return {
          nodes: [],
          connections: [],
          viewport: { ...DEFAULT_VIEWPORT }
        };
      default:
        return {
          nodes: [],
          connections: [],
          viewport: { ...DEFAULT_VIEWPORT }
        };
    }
  }

  // =========================================================================
  // Nodes
  // =========================================================================

  /**
   * Get nodes for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {Object[]} Nodes
   */
  getNodes(mode) {
    return stateManager.get(`views.${mode}.nodes`) || [];
  }

  /**
   * Set nodes for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object[]} nodes - Nodes
   */
  setNodes(mode, nodes) {
    stateManager.set(`views.${mode}.nodes`, nodes);
  }

  /**
   * Add a node to a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object} node - Node to add
   */
  addNode(mode, node) {
    stateManager.push(`views.${mode}.nodes`, node);
  }

  /**
   * Remove a node from a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID to remove
   * @returns {Object|undefined} Removed node
   */
  removeNode(mode, nodeId) {
    return stateManager.remove(`views.${mode}.nodes`, n => n.id === nodeId);
  }

  /**
   * Update a node in a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID
   * @param {Object} updates - Updates to apply
   * @returns {boolean} Success
   */
  updateNode(mode, nodeId, updates) {
    const nodes = this.getNodes(mode);
    const index = nodes.findIndex(n => n.id === nodeId);

    if (index === -1) return false;

    Object.assign(nodes[index], updates);
    stateManager.set(`views.${mode}.nodes`, nodes);
    return true;
  }

  /**
   * Find a node by ID.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Node or null
   */
  findNode(mode, nodeId) {
    const nodes = this.getNodes(mode);
    return nodes.find(n => n.id === nodeId) || null;
  }

  // =========================================================================
  // Connections
  // =========================================================================

  /**
   * Get connections for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {Object[]} Connections
   */
  getConnections(mode) {
    return stateManager.get(`views.${mode}.connections`) || [];
  }

  /**
   * Set connections for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object[]} connections - Connections
   */
  setConnections(mode, connections) {
    stateManager.set(`views.${mode}.connections`, connections);
  }

  /**
   * Add a connection to a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Object} connection - Connection to add
   */
  addConnection(mode, connection) {
    stateManager.push(`views.${mode}.connections`, connection);
  }

  /**
   * Remove a connection from a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} connectionId - Connection ID
   * @returns {Object|undefined} Removed connection
   */
  removeConnection(mode, connectionId) {
    return stateManager.remove(`views.${mode}.connections`, c => c.id === connectionId);
  }

  /**
   * Remove connections for a node.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID
   * @returns {Object[]} Removed connections
   */
  removeConnectionsForNode(mode, nodeId) {
    const connections = this.getConnections(mode);
    const toRemove = [];
    const toKeep = [];

    for (const conn of connections) {
      const fromId = conn.from?.nodeId || conn.fromNode;
      const toId = conn.to?.nodeId || conn.toNode;

      if (fromId === nodeId || toId === nodeId) {
        toRemove.push(conn);
      } else {
        toKeep.push(conn);
      }
    }

    if (toRemove.length > 0) {
      stateManager.set(`views.${mode}.connections`, toKeep);
    }

    return toRemove;
  }

  // =========================================================================
  // Viewport
  // =========================================================================

  /**
   * Get viewport for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {Viewport} Viewport
   */
  getViewport(mode) {
    return stateManager.get(`views.${mode}.viewport`) || { ...DEFAULT_VIEWPORT };
  }

  /**
   * Set viewport for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Viewport} viewport - Viewport state
   */
  setViewport(mode, viewport) {
    stateManager.set(`views.${mode}.viewport`, viewport);
  }

  /**
   * Update viewport for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {Partial<Viewport>} updates - Viewport updates
   */
  updateViewport(mode, updates) {
    stateManager.update(`views.${mode}.viewport`, updates);
  }

  /**
   * Reset viewport to default.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   */
  resetViewport(mode) {
    stateManager.set(`views.${mode}.viewport`, { ...DEFAULT_VIEWPORT });
  }

  // =========================================================================
  // Selection
  // =========================================================================

  /**
   * Get selected node IDs.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @returns {string[]} Selected IDs
   */
  getSelection(mode) {
    if (mode === 'hierarchical') {
      return stateManager.get('views.hierarchical.selection') || [];
    }
    return stateManager.get('ui.selectedNodes') || [];
  }

  /**
   * Set selection.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string[]} nodeIds - Selected node IDs
   */
  setSelection(mode, nodeIds) {
    if (mode === 'hierarchical') {
      stateManager.set('views.hierarchical.selection', nodeIds);
    }
    stateManager.set('ui.selectedNodes', nodeIds);
  }

  /**
   * Add to selection.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID to add
   */
  addToSelection(mode, nodeId) {
    const current = this.getSelection(mode);
    if (!current.includes(nodeId)) {
      this.setSelection(mode, [...current, nodeId]);
    }
  }

  /**
   * Remove from selection.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID to remove
   */
  removeFromSelection(mode, nodeId) {
    const current = this.getSelection(mode);
    this.setSelection(mode, current.filter(id => id !== nodeId));
  }

  /**
   * Clear selection.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   */
  clearSelection(mode) {
    this.setSelection(mode, []);
  }

  /**
   * Check if node is selected.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode name
   * @param {string} nodeId - Node ID
   * @returns {boolean} Is selected
   */
  isSelected(mode, nodeId) {
    return this.getSelection(mode).includes(nodeId);
  }

  // =========================================================================
  // Hierarchical Mode Specific
  // =========================================================================

  /**
   * Get navigation path (breadcrumb).
   *
   * @returns {string[]} Path
   */
  getPath() {
    return stateManager.get('views.hierarchical.path') || [];
  }

  /**
   * Set navigation path.
   *
   * @param {string[]} path - Path
   */
  setPath(path) {
    stateManager.set('views.hierarchical.path', path);
  }

  /**
   * Push to navigation path.
   *
   * @param {string} segment - Path segment
   */
  pushPath(segment) {
    stateManager.push('views.hierarchical.path', segment);
  }

  /**
   * Pop from navigation path.
   *
   * @returns {string|undefined} Popped segment
   */
  popPath() {
    const path = this.getPath();
    if (path.length === 0) return undefined;

    const popped = path.pop();
    stateManager.set('views.hierarchical.path', path);
    return popped;
  }

  // =========================================================================
  // Flow Mode Specific
  // =========================================================================

  /**
   * Get focused node in flow mode.
   *
   * @returns {string|null} Focused node ID
   */
  getFocusedNode() {
    return stateManager.get('views.flow.focusedNode');
  }

  /**
   * Set focused node in flow mode.
   *
   * @param {string|null} nodeId - Node ID
   */
  setFocusedNode(nodeId) {
    stateManager.set('views.flow.focusedNode', nodeId);
  }

  /**
   * Get navigation stack in flow mode.
   *
   * @returns {string[]} Navigation stack
   */
  getNavigationStack() {
    return stateManager.get('views.flow.navigationStack') || [];
  }

  /**
   * Push to navigation stack.
   *
   * @param {string} nodeId - Node ID
   */
  pushNavigation(nodeId) {
    stateManager.push('views.flow.navigationStack', nodeId);
  }

  /**
   * Pop from navigation stack.
   *
   * @returns {string|undefined} Popped node ID
   */
  popNavigation() {
    const stack = this.getNavigationStack();
    if (stack.length === 0) return undefined;

    const popped = stack.pop();
    stateManager.set('views.flow.navigationStack', stack);
    return popped;
  }

  /**
   * Clear navigation stack.
   */
  clearNavigationStack() {
    stateManager.set('views.flow.navigationStack', []);
  }

  /**
   * Get execution graph.
   *
   * @returns {Object|null} Execution graph
   */
  getExecutionGraph() {
    return stateManager.get('views.flow.executionGraph');
  }

  /**
   * Set execution graph.
   *
   * @param {Object|null} graph - Execution graph
   */
  setExecutionGraph(graph) {
    stateManager.set('views.flow.executionGraph', graph);
  }

  /**
   * Get flow type.
   *
   * @returns {string} Flow type
   */
  getFlowType() {
    return stateManager.get('views.flow.flowType') || 'entry-point';
  }

  /**
   * Set flow type.
   *
   * @param {string} type - Flow type
   */
  setFlowType(type) {
    stateManager.set('views.flow.flowType', type);
  }

  // =========================================================================
  // UI State
  // =========================================================================

  /**
   * Get current mode.
   *
   * @returns {string} Current mode
   */
  getCurrentMode() {
    return stateManager.get('ui.currentMode') || 'hierarchical';
  }

  /**
   * Set current mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode
   */
  setCurrentMode(mode) {
    stateManager.set('ui.currentMode', mode);
  }

  /**
   * Get active panel.
   *
   * @returns {string|null} Active panel ID
   */
  getActivePanel() {
    return stateManager.get('ui.activePanel');
  }

  /**
   * Set active panel.
   *
   * @param {string|null} panelId - Panel ID
   */
  setActivePanel(panelId) {
    stateManager.set('ui.activePanel', panelId);
  }

  /**
   * Get theme.
   *
   * @returns {string} Theme name
   */
  getTheme() {
    return stateManager.get('ui.theme') || 'dark';
  }

  /**
   * Set theme.
   *
   * @param {string} theme - Theme name
   */
  setTheme(theme) {
    stateManager.set('ui.theme', theme);
  }

  // =========================================================================
  // Persistence
  // =========================================================================

  /**
   * Save view state for a project.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} Success
   */
  async saveViewState(projectId) {
    await this._ensureInitialized();

    try {
      const viewState = {
        hierarchical: this.getViewState('hierarchical'),
        flow: this.getViewState('flow')
      };

      const key = `${STORAGE_KEYS.VIEW_PREFIX}/${projectId}`;
      await localStorageAdapter.save(key, viewState);

      return true;
    } catch (error) {
      console.error('ViewStore: Failed to save view state:', error);
      return false;
    }
  }

  /**
   * Load view state for a project.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} Success
   */
  async loadViewState(projectId) {
    await this._ensureInitialized();

    try {
      const key = `${STORAGE_KEYS.VIEW_PREFIX}/${projectId}`;
      const viewState = await localStorageAdapter.load(key);

      if (viewState) {
        if (viewState.hierarchical) {
          this.setViewState('hierarchical', viewState.hierarchical, { silent: true });
        }
        if (viewState.flow) {
          this.setViewState('flow', viewState.flow, { silent: true });
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('ViewStore: Failed to load view state:', error);
      return false;
    }
  }

  /**
   * Delete view state for a project.
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} Success
   */
  async deleteViewState(projectId) {
    await this._ensureInitialized();

    const key = `${STORAGE_KEYS.VIEW_PREFIX}/${projectId}`;
    return localStorageAdapter.delete(key);
  }

  /**
   * Save notes (global, not per-project).
   *
   * @returns {Promise<boolean>} Success
   */
  async saveNotes() {
    await this._ensureInitialized();

    try {
      const notesState = this.getViewState('notes');
      await localStorageAdapter.save(STORAGE_KEYS.NOTES, notesState);
      return true;
    } catch (error) {
      console.error('ViewStore: Failed to save notes:', error);
      return false;
    }
  }

  /**
   * Save UI state.
   *
   * @returns {Promise<boolean>} Success
   */
  async saveUIState() {
    await this._ensureInitialized();

    try {
      const uiState = {
        currentMode: this.getCurrentMode(),
        theme: this.getTheme()
      };
      await localStorageAdapter.save(STORAGE_KEYS.UI_STATE, uiState);
      return true;
    } catch (error) {
      console.error('ViewStore: Failed to save UI state:', error);
      return false;
    }
  }

  /**
   * Clear view state for a mode.
   *
   * @param {'hierarchical'|'flow'|'notes'} mode - Mode
   */
  clearViewState(mode) {
    this.setViewState(mode, this._getDefaultViewState(mode));
  }

  /**
   * Clear all view states.
   */
  clearAllViewStates() {
    this.clearViewState('hierarchical');
    this.clearViewState('flow');
    this.clearViewState('notes');
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Load notes from storage.
   * @private
   */
  async _loadNotes() {
    try {
      const notesState = await localStorageAdapter.load(STORAGE_KEYS.NOTES);
      if (notesState) {
        this.setViewState('notes', notesState, { silent: true });
      }
    } catch (error) {
      console.error('ViewStore: Failed to load notes:', error);
    }
  }

  /**
   * Load UI state from storage.
   * @private
   */
  async _loadUIState() {
    try {
      const uiState = await localStorageAdapter.load(STORAGE_KEYS.UI_STATE);
      if (uiState) {
        if (uiState.currentMode) {
          stateManager.set('ui.currentMode', uiState.currentMode, { silent: true });
        }
        if (uiState.theme) {
          stateManager.set('ui.theme', uiState.theme, { silent: true });
        }
      }
    } catch (error) {
      console.error('ViewStore: Failed to load UI state:', error);
    }
  }
}

/**
 * Singleton ViewStore instance.
 * @type {ViewStore}
 */
export const viewStore = new ViewStore();
