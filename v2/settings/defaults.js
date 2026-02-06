/**
 * Default Settings and Shortcuts
 *
 * Centralized location for all default configuration values.
 * Import these when you need to reference defaults without
 * initializing the full managers.
 *
 * @see ARCHITECTURE_PLAN.md Module 8.3 for full documentation
 */

/**
 * Default application settings.
 * @type {Object}
 */
export const DEFAULT_SETTINGS = {
  // Version for migration
  version: 1,

  // =========================================================================
  // Appearance
  // =========================================================================

  /** Theme mode: 'light', 'dark', or 'system' */
  theme: 'system',

  /** Default width for new nodes (pixels) */
  nodeDefaultWidth: 180,

  /** Default height for new nodes (pixels) */
  nodeDefaultHeight: 100,

  /** Connection line style: 'bezier', 'straight', or 'step' */
  connectionStyle: 'bezier',

  /** Whether to animate data flow on connections */
  animateConnections: false,

  /** Show labels on ports */
  showPortLabels: true,

  /** Show labels on connections */
  showConnectionLabels: true,

  /** Default node border radius (pixels) */
  nodeBorderRadius: 4,

  /** Font size for node content (pixels) */
  nodeFontSize: 13,

  // =========================================================================
  // Behavior
  // =========================================================================

  /** Auto-save enabled */
  autoSave: true,

  /** Auto-save interval (milliseconds) */
  autoSaveInterval: 30000,

  /** Snap nodes to grid */
  snapToGrid: false,

  /** Grid size when snapping (pixels) */
  gridSize: 20,

  /** Show confirmation dialog before delete */
  confirmDelete: true,

  /** Double-click to edit node content */
  doubleClickToEdit: true,

  /** Smooth scrolling for pan operations */
  smoothPan: true,

  /** Enable multi-selection with Ctrl/Cmd+click */
  multiSelect: true,

  // =========================================================================
  // Editor
  // =========================================================================

  /** Show the minimap */
  showMinimap: true,

  /** Minimap position */
  minimapPosition: 'bottom-right',

  /** Minimap width (pixels) */
  minimapWidth: 180,

  /** Minimap height (pixels) */
  minimapHeight: 120,

  /** Pan sensitivity multiplier */
  panSensitivity: 1.0,

  /** Zoom sensitivity multiplier */
  zoomSensitivity: 1.0,

  /** Minimum zoom level */
  minZoom: 0.3,

  /** Maximum zoom level */
  maxZoom: 3.0,

  /** Show grid background */
  showGrid: false,

  /** Grid background color */
  gridColor: '#e0e0e0',

  // =========================================================================
  // Parser
  // =========================================================================

  /** Patterns to exclude when parsing directories */
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    '.venv',
    'vendor'
  ],

  /** Maximum file size to parse (bytes) */
  maxFileSize: 1024 * 1024, // 1MB

  /** Parse files when loading a project */
  parseOnLoad: true,

  /** File extensions to parse */
  parseExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  // =========================================================================
  // Recent Projects
  // =========================================================================

  /** List of recent projects */
  recentProjects: [],

  /** Maximum number of recent projects to track */
  maxRecentProjects: 10,

  // =========================================================================
  // Advanced
  // =========================================================================

  /** Enable debug logging */
  debugMode: false,

  /** Show performance metrics */
  showPerformanceMetrics: false,

  /** Maximum undo history size */
  maxUndoHistory: 100,

  /** Render optimization level: 'none', 'basic', 'aggressive' */
  renderOptimization: 'basic'
};

/**
 * Default keyboard shortcuts.
 * @type {Object.<string, string>}
 */
export const DEFAULT_SHORTCUTS = {
  // =========================================================================
  // Editing
  // =========================================================================

  /** Create a new node */
  newNode: 'n',

  /** Delete selected items */
  delete: 'Delete',

  /** Duplicate selected items */
  duplicate: 'ctrl+d',

  /** Undo last action */
  undo: 'ctrl+z',

  /** Redo last undone action */
  redo: 'ctrl+y',

  /** Redo (alternative binding) */
  redoAlt: 'ctrl+shift+z',

  // =========================================================================
  // Selection
  // =========================================================================

  /** Select all nodes */
  selectAll: 'ctrl+a',

  /** Clear selection */
  clearSelection: 'Escape',

  // =========================================================================
  // View
  // =========================================================================

  /** Zoom in */
  zoomIn: 'ctrl+=',

  /** Zoom out */
  zoomOut: 'ctrl+-',

  /** Reset zoom to 100% */
  zoomReset: 'ctrl+0',

  /** Center the view */
  centerView: 'c',

  /** Toggle minimap visibility */
  toggleMinimap: 'm',

  /** Fit all nodes in view */
  fitView: 'ctrl+1',

  // =========================================================================
  // Panels
  // =========================================================================

  /** Toggle details panel */
  toggleDetails: 'i',

  /** Open settings panel */
  toggleSettings: ',',

  // =========================================================================
  // File
  // =========================================================================

  /** Save current session */
  save: 'ctrl+s',

  /** Load a project */
  load: 'ctrl+o',

  /** Export session to file */
  export: 'ctrl+e',

  // =========================================================================
  // Help
  // =========================================================================

  /** Show keyboard shortcuts help */
  showHelp: '?',

  // =========================================================================
  // Mode Switching
  // =========================================================================

  /** Switch to hierarchical mode */
  modeHierarchical: '1',

  /** Switch to flow mode */
  modeFlow: '2',

  /** Switch to notes mode */
  modeNotes: '3',

  // =========================================================================
  // Navigation
  // =========================================================================

  /** Navigate up in hierarchy */
  navigateUp: 'Backspace',

  /** Focus search */
  search: 'ctrl+f',

  // =========================================================================
  // Appearance
  // =========================================================================

  /** Toggle between light and dark theme */
  toggleTheme: 't'
};

/**
 * Shortcut categories for grouping in UI.
 * @type {Object.<string, string>}
 */
export const SHORTCUT_CATEGORIES = {
  editing: 'Editing',
  selection: 'Selection',
  view: 'View',
  panels: 'Panels',
  file: 'File',
  help: 'Help',
  modes: 'Mode Switching',
  navigation: 'Navigation',
  appearance: 'Appearance'
};

/**
 * Shortcut metadata for UI display.
 * @type {Object.<string, Object>}
 */
export const SHORTCUT_INFO = {
  newNode: { description: 'Create new node', category: 'editing' },
  delete: { description: 'Delete selected', category: 'editing' },
  duplicate: { description: 'Duplicate selected', category: 'editing' },
  undo: { description: 'Undo', category: 'editing' },
  redo: { description: 'Redo', category: 'editing' },
  redoAlt: { description: 'Redo (alternative)', category: 'editing' },

  selectAll: { description: 'Select all nodes', category: 'selection' },
  clearSelection: { description: 'Clear selection', category: 'selection' },

  zoomIn: { description: 'Zoom in', category: 'view' },
  zoomOut: { description: 'Zoom out', category: 'view' },
  zoomReset: { description: 'Reset zoom', category: 'view' },
  centerView: { description: 'Center view', category: 'view' },
  toggleMinimap: { description: 'Toggle minimap', category: 'view' },
  fitView: { description: 'Fit all in view', category: 'view' },

  toggleDetails: { description: 'Toggle details panel', category: 'panels' },
  toggleSettings: { description: 'Open settings', category: 'panels' },

  save: { description: 'Save', category: 'file' },
  load: { description: 'Load project', category: 'file' },
  export: { description: 'Export session', category: 'file' },

  showHelp: { description: 'Show keyboard shortcuts', category: 'help' },

  modeHierarchical: { description: 'Hierarchical mode', category: 'modes' },
  modeFlow: { description: 'Flow mode', category: 'modes' },
  modeNotes: { description: 'Notes mode', category: 'modes' },

  navigateUp: { description: 'Navigate up', category: 'navigation' },
  search: { description: 'Search', category: 'navigation' },

  toggleTheme: { description: 'Toggle theme', category: 'appearance' }
};

/**
 * Setting categories for grouping in UI.
 * @type {Object.<string, Object>}
 */
export const SETTING_CATEGORIES = {
  appearance: {
    name: 'Appearance',
    description: 'Visual styling and theme options',
    settings: [
      'theme',
      'nodeDefaultWidth',
      'nodeDefaultHeight',
      'nodeBorderRadius',
      'nodeFontSize',
      'connectionStyle',
      'animateConnections',
      'showPortLabels',
      'showConnectionLabels'
    ]
  },
  behavior: {
    name: 'Behavior',
    description: 'Interaction and automation settings',
    settings: [
      'autoSave',
      'autoSaveInterval',
      'snapToGrid',
      'gridSize',
      'confirmDelete',
      'doubleClickToEdit',
      'smoothPan',
      'multiSelect'
    ]
  },
  editor: {
    name: 'Editor',
    description: 'Canvas and viewport settings',
    settings: [
      'showMinimap',
      'minimapPosition',
      'minimapWidth',
      'minimapHeight',
      'panSensitivity',
      'zoomSensitivity',
      'minZoom',
      'maxZoom',
      'showGrid',
      'gridColor'
    ]
  },
  parser: {
    name: 'Parser',
    description: 'Code parsing and project loading',
    settings: [
      'excludePatterns',
      'maxFileSize',
      'parseOnLoad',
      'parseExtensions'
    ]
  },
  advanced: {
    name: 'Advanced',
    description: 'Developer and performance options',
    settings: [
      'debugMode',
      'showPerformanceMetrics',
      'maxUndoHistory',
      'renderOptimization'
    ]
  }
};

/**
 * Setting metadata for UI display.
 * @type {Object.<string, Object>}
 */
export const SETTING_INFO = {
  theme: {
    label: 'Theme',
    type: 'select',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'System' }
    ]
  },
  nodeDefaultWidth: { label: 'Default node width', type: 'number', min: 100, max: 500, step: 10 },
  nodeDefaultHeight: { label: 'Default node height', type: 'number', min: 50, max: 300, step: 10 },
  connectionStyle: {
    label: 'Connection style',
    type: 'select',
    options: [
      { value: 'bezier', label: 'Bezier curve' },
      { value: 'straight', label: 'Straight line' },
      { value: 'step', label: 'Step (90°)' }
    ]
  },
  animateConnections: { label: 'Animate connections', type: 'boolean' },
  showPortLabels: { label: 'Show port labels', type: 'boolean' },
  showConnectionLabels: { label: 'Show connection labels', type: 'boolean' },

  autoSave: { label: 'Auto-save', type: 'boolean' },
  autoSaveInterval: { label: 'Auto-save interval (ms)', type: 'number', min: 5000, max: 300000, step: 5000 },
  snapToGrid: { label: 'Snap to grid', type: 'boolean' },
  gridSize: { label: 'Grid size', type: 'number', min: 5, max: 50, step: 5 },
  confirmDelete: { label: 'Confirm before delete', type: 'boolean' },
  doubleClickToEdit: { label: 'Double-click to edit', type: 'boolean' },

  showMinimap: { label: 'Show minimap', type: 'boolean' },
  minimapPosition: {
    label: 'Minimap position',
    type: 'select',
    options: [
      { value: 'top-left', label: 'Top Left' },
      { value: 'top-right', label: 'Top Right' },
      { value: 'bottom-left', label: 'Bottom Left' },
      { value: 'bottom-right', label: 'Bottom Right' }
    ]
  },
  panSensitivity: { label: 'Pan sensitivity', type: 'range', min: 0.1, max: 2, step: 0.1 },
  zoomSensitivity: { label: 'Zoom sensitivity', type: 'range', min: 0.1, max: 2, step: 0.1 },
  minZoom: { label: 'Min zoom', type: 'number', min: 0.1, max: 1, step: 0.1 },
  maxZoom: { label: 'Max zoom', type: 'number', min: 1, max: 10, step: 0.5 },

  debugMode: { label: 'Debug mode', type: 'boolean' },
  showPerformanceMetrics: { label: 'Show performance metrics', type: 'boolean' },
  maxUndoHistory: { label: 'Max undo history', type: 'number', min: 10, max: 500, step: 10 },
  renderOptimization: {
    label: 'Render optimization',
    type: 'select',
    options: [
      { value: 'none', label: 'None' },
      { value: 'basic', label: 'Basic' },
      { value: 'aggressive', label: 'Aggressive' }
    ]
  }
};
