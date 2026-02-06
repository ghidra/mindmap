/**
 * Notes Mode
 *
 * Free-form notes and diagrams.
 * Separate storage from code nodes for stability.
 *
 * Features:
 * - Free-form positioning
 * - Sticky notes with customizable colors
 * - Double-click to create new notes
 * - Resizable notes
 * - Separate persistence (mindmap-notes)
 *
 * @see ARCHITECTURE_PLAN.md Module 5 for full documentation
 */

import { BaseMode } from '../BaseMode.js';
import { state, saveNotes } from '../../state.js';

/**
 * Default note colors.
 * @type {string[]}
 */
export const NOTE_COLORS = [
  '#ffffff', // White
  '#fff9c4', // Yellow
  '#ffccbc', // Orange
  '#f8bbd9', // Pink
  '#c8e6c9', // Green
  '#bbdefb', // Blue
  '#d1c4e9', // Purple
  '#cfd8dc'  // Gray
];

/**
 * Notes Mode class.
 */
export class NotesMode extends BaseMode {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'notes';
  static name = 'Notes';
  static icon = '📝';
  static description = 'Free-form notes and diagrams';
  static supportsConnections = true;
  static supportsNodeCreation = true;
  static supportsDragging = true;

  static defaultViewport = {
    x: 0,
    y: 0,
    zoom: 1
  };

  // =========================================================================
  // Constructor
  // =========================================================================

  constructor(config = {}) {
    super(config);

    /**
     * Next note color index.
     * @type {number}
     */
    this._nextColorIndex = 0;
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  async onEnter(previousMode) {
    await super.onEnter(previousMode);

    // Ensure notes data is initialized
    if (!state.notesData) {
      state.notesData = { nodes: [], connections: [] };
    }
    if (!state.notesData.nodes) {
      state.notesData.nodes = [];
    }
    if (!state.notesData.connections) {
      state.notesData.connections = [];
    }

    console.log(`NotesMode: Entered with ${state.notesData.nodes.length} notes`);
  }

  async onExit(nextMode) {
    // Save notes before leaving
    this._triggerSave();
    await super.onExit(nextMode);
  }

  // =========================================================================
  // Node Methods
  // =========================================================================

  /**
   * Get notes nodes.
   *
   * @returns {Array}
   */
  getNodes() {
    return state.notesData?.nodes || [];
  }

  /**
   * Get a note by ID.
   *
   * @param {string} nodeId - Note ID
   * @returns {Object|null}
   */
  getNodeById(nodeId) {
    return state.notesData?.nodes?.find(n => n.id === nodeId) || null;
  }

  /**
   * Add a note node.
   *
   * @param {Object} note - Note to add
   * @param {Object} [options] - Options
   * @returns {Object} Added note
   */
  addNode(note, options = {}) {
    // Ensure required properties
    if (!note.id) {
      note.id = this._generateNoteId();
    }
    if (!note.type) {
      note.type = 'note';
    }

    state.notesData.nodes.push(note);
    this._triggerSave();
    return note;
  }

  /**
   * Create and add a new note at position.
   *
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} [options] - Note options
   * @returns {Object} Created note
   */
  createNote(x, y, options = {}) {
    const color = options.color || this._getNextColor();

    const note = {
      id: this._generateNoteId(),
      type: 'note',
      x,
      y,
      title: options.title || 'New Note',
      description: options.description || '',
      showDescription: options.showDescription ?? false,
      titleFontSize: options.titleFontSize || 14,
      descriptionFontSize: options.descriptionFontSize || 14,
      titleColor: options.titleColor || '#000000',
      descriptionColor: options.descriptionColor || '#000000',
      width: options.width || 200,
      height: options.height || 120,
      color: color,
      connections: [],
      children: [],
      attributes: [],
      isNote: true
    };

    return this.addNode(note);
  }

  /**
   * Remove a note.
   *
   * @param {string} nodeId - Note ID to remove
   * @returns {boolean}
   */
  removeNode(nodeId) {
    const index = state.notesData.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return false;

    state.notesData.nodes.splice(index, 1);

    // Remove connections involving this note
    if (state.notesData.connections) {
      state.notesData.connections = state.notesData.connections.filter(
        conn => conn.from !== nodeId && conn.to !== nodeId &&
                conn.from?.nodeId !== nodeId && conn.to?.nodeId !== nodeId
      );
    }

    this._triggerSave();
    return true;
  }

  /**
   * Update a note's properties.
   *
   * @param {string} nodeId - Note ID
   * @param {Object} updates - Properties to update
   * @returns {boolean}
   */
  updateNode(nodeId, updates) {
    const note = this.getNodeById(nodeId);
    if (!note) return false;

    Object.assign(note, updates);
    this._triggerSave();
    return true;
  }

  /**
   * Update note description.
   *
   * @param {string} nodeId - Note ID
   * @param {string} description - New description
   */
  updateDescription(nodeId, description) {
    this.updateNode(nodeId, { description });
  }

  /**
   * Update note size.
   *
   * @param {string} nodeId - Note ID
   * @param {number} width - New width
   * @param {number} height - New height
   */
  updateSize(nodeId, width, height) {
    this.updateNode(nodeId, {
      width: Math.max(100, width),
      height: Math.max(60, height)
    });
  }

  /**
   * Update note color.
   *
   * @param {string} nodeId - Note ID
   * @param {string} color - New color
   */
  updateColor(nodeId, color) {
    this.updateNode(nodeId, { color });
  }

  // =========================================================================
  // Connection Methods
  // =========================================================================

  /**
   * Get notes connections.
   *
   * @returns {Array}
   */
  getConnections() {
    return state.notesData?.connections || [];
  }

  /**
   * Add a connection.
   *
   * @param {Object} connection - Connection to add
   * @returns {Object}
   */
  addConnection(connection) {
    if (!state.notesData.connections) {
      state.notesData.connections = [];
    }
    state.notesData.connections.push(connection);
    this._triggerSave();
    return connection;
  }

  /**
   * Remove a connection.
   *
   * @param {string} connectionId - Connection ID
   * @returns {boolean}
   */
  removeConnection(connectionId) {
    if (!state.notesData.connections) return false;

    const idx = state.notesData.connections.findIndex(c => c.id === connectionId);
    if (idx !== -1) {
      state.notesData.connections.splice(idx, 1);
      this._triggerSave();
      return true;
    }
    return false;
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Handle double-click on canvas.
   * In notes mode, create a new note.
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Event} event - Click event
   */
  onCanvasDoubleClick(x, y, event) {
    const note = this.createNote(x, y);
    console.log(`NotesMode: Created new note at (${x}, ${y})`);
    this._triggerRender();
  }

  /**
   * Handle double-click on a note.
   * Could open edit mode, show description, etc.
   *
   * @param {Object} node - Clicked note
   * @param {Event} event - Click event
   */
  onNodeDoubleClick(node, event) {
    // Toggle description visibility
    this.updateNode(node.id, {
      showDescription: !node.showDescription
    });
    this._triggerRender();
  }

  // =========================================================================
  // Position Methods
  // =========================================================================

  /**
   * Get position property names for notes mode.
   *
   * @returns {{x: string, y: string}}
   */
  getPositionProperties() {
    return { x: 'x', y: 'y' };
  }

  // =========================================================================
  // Layout Methods
  // =========================================================================

  /**
   * Apply grid layout to notes.
   *
   * @param {Object} [options] - Layout options
   */
  applyLayout(options = {}) {
    const notes = this.getNodes();
    if (notes.length === 0) return;

    const columns = options.columns || Math.ceil(Math.sqrt(notes.length));
    const spacing = options.spacing || 20;
    const noteWidth = options.noteWidth || 200;
    const noteHeight = options.noteHeight || 120;
    const startX = options.startX || 50;
    const startY = options.startY || 50;

    notes.forEach((note, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      note.x = startX + col * (noteWidth + spacing);
      note.y = startY + row * (noteHeight + spacing);
    });

    this._triggerRender();
    this._triggerSave();
  }

  /**
   * Get layout configuration.
   *
   * @returns {Object}
   */
  getLayoutConfig() {
    return {
      type: 'grid',
      defaultColumns: 4,
      spacing: 20
    };
  }

  // =========================================================================
  // Controls
  // =========================================================================

  /**
   * Get mode-specific controls.
   *
   * @returns {Object[]}
   */
  getControls() {
    return [
      {
        id: 'add-note',
        type: 'button',
        label: 'Add Note',
        icon: '➕',
        action: () => {
          // Add note in center of viewport
          const note = this.createNote(
            400 + Math.random() * 100,
            300 + Math.random() * 100
          );
          this._triggerRender();
        }
      },
      {
        id: 'grid-layout',
        type: 'button',
        label: 'Grid Layout',
        icon: '⊞',
        action: () => this.applyLayout()
      },
      {
        id: 'clear-all',
        type: 'button',
        label: 'Clear All',
        icon: '🗑️',
        confirm: true,
        action: () => {
          if (confirm('Are you sure you want to clear all notes?')) {
            state.notesData.nodes = [];
            state.notesData.connections = [];
            this._triggerSave();
            this._triggerRender();
          }
        }
      }
    ];
  }

  /**
   * Handle control action.
   *
   * @param {string} controlId - Control ID
   * @param {*} value - Control value
   */
  onControlAction(controlId, value) {
    const control = this.getControls().find(c => c.id === controlId);
    if (control && control.action) {
      control.action(value);
    }
  }

  // =========================================================================
  // Save Override
  // =========================================================================

  /**
   * Trigger save (notes use separate save function).
   * @protected
   */
  _triggerSave() {
    if (this._saveCallback) {
      try {
        this._saveCallback();
      } catch (error) {
        console.error('NotesMode: Save callback error:', error);
      }
    } else {
      // Use notes-specific save
      saveNotes();
    }
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Generate a unique note ID.
   * @private
   */
  _generateNoteId() {
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Get next color in rotation.
   * @private
   */
  _getNextColor() {
    const color = NOTE_COLORS[this._nextColorIndex];
    this._nextColorIndex = (this._nextColorIndex + 1) % NOTE_COLORS.length;
    return color;
  }

  /**
   * Get all available note colors.
   *
   * @returns {string[]}
   */
  getAvailableColors() {
    return [...NOTE_COLORS];
  }

  /**
   * Get note count.
   *
   * @returns {number}
   */
  getNoteCount() {
    return state.notesData?.nodes?.length || 0;
  }
}
