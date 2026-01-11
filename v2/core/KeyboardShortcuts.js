/**
 * Keyboard Shortcuts - Global keyboard shortcuts for the application
 */

import { state, save, clearSelection } from '../state.js';
import { nodeCreator } from '../ui/NodeCreator.js';
import { detailsPanel } from '../ui/DetailsPanel.js';
import { eventManager } from './EventManager.js';

export class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
  }

  /**
   * Initialize keyboard shortcuts
   */
  init() {
    this.registerDefaultShortcuts();
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    console.log('KeyboardShortcuts initialized');
  }

  /**
   * Register default shortcuts
   */
  registerDefaultShortcuts() {
    // Node creation
    this.register('n', 'Create new node', (e) => {
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      const x = (rect.width / 2) - state.viewport.x;
      const y = (rect.height / 2) - state.viewport.y;

      nodeCreator.show(x, y, () => {
        if (eventManager.onRenderNeeded) {
          eventManager.onRenderNeeded();
        }
      });
    });

    // Delete selected nodes
    this.register('Delete', 'Delete selected nodes', (e) => {
      if (state.selectedNodes.length > 0) {
        const { removeNode } = require('../state.js');
        const { nodeRenderer } = require('./NodeRenderer.js');

        state.selectedNodes.forEach(nodeId => {
          removeNode(nodeId);
          nodeRenderer.removeRenderedNode(nodeId);
        });

        clearSelection();
        save();

        if (eventManager.onRenderNeeded) {
          eventManager.onRenderNeeded();
        }
      }
    });

    // Deselect all
    this.register('Escape', 'Clear selection', (e) => {
      clearSelection();
      detailsPanel.hide();

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Save
    this.register('ctrl+s', 'Save', (e) => {
      e.preventDefault();
      save();
      console.log('💾 Saved');
    });

    // Undo (placeholder)
    this.register('ctrl+z', 'Undo', (e) => {
      e.preventDefault();
      console.log('Undo not yet implemented');
    });

    // Redo (placeholder)
    this.register('ctrl+y', 'Redo', (e) => {
      e.preventDefault();
      console.log('Redo not yet implemented');
    });

    // Select all
    this.register('ctrl+a', 'Select all nodes', (e) => {
      e.preventDefault();
      state.selectedNodes = state.nodes.map(n => n.id);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Duplicate (placeholder)
    this.register('ctrl+d', 'Duplicate selected', (e) => {
      e.preventDefault();
      console.log('Duplicate not yet implemented');
    });

    // Toggle details panel
    this.register('i', 'Toggle details panel', (e) => {
      if (state.selectedNodes.length === 1) {
        if (detailsPanel.panel.classList.contains('visible')) {
          detailsPanel.hide();
        } else {
          detailsPanel.show(state.selectedNodes[0]);
        }
      }
    });

    // Zoom in
    this.register('ctrl+=', 'Zoom in', (e) => {
      e.preventDefault();
      state.viewport.zoom = Math.min(state.viewport.zoom * 1.1, 3);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Zoom out
    this.register('ctrl+-', 'Zoom out', (e) => {
      e.preventDefault();
      state.viewport.zoom = Math.max(state.viewport.zoom / 1.1, 0.3);

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Reset zoom
    this.register('ctrl+0', 'Reset zoom', (e) => {
      e.preventDefault();
      state.viewport.zoom = 1;

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Center view
    this.register('c', 'Center view', (e) => {
      state.viewport.x = 0;
      state.viewport.y = 0;

      if (eventManager.onRenderNeeded) {
        eventManager.onRenderNeeded();
      }
    });

    // Show keyboard shortcuts help
    this.register('?', 'Show keyboard shortcuts', (e) => {
      this.showHelp();
    });
  }

  /**
   * Register a keyboard shortcut
   * @param {string} key - Key combination (e.g., 'ctrl+s', 'Delete')
   * @param {string} description - Human-readable description
   * @param {Function} handler - Handler function
   */
  register(key, description, handler) {
    this.shortcuts.set(key.toLowerCase(), {
      key,
      description,
      handler
    });
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(e) {
    if (!this.enabled) return;

    // Don't intercept if typing in input/textarea
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    )) {
      // Exception: allow Escape and Ctrl+S even in inputs
      if (e.key !== 'Escape' && !(e.ctrlKey && e.key === 's')) {
        return;
      }
    }

    // Build key string
    let keyString = '';
    if (e.ctrlKey || e.metaKey) keyString += 'ctrl+';
    if (e.shiftKey) keyString += 'shift+';
    if (e.altKey) keyString += 'alt+';
    keyString += e.key.toLowerCase();

    // Find and execute shortcut
    const shortcut = this.shortcuts.get(keyString);
    if (shortcut) {
      shortcut.handler(e);
    }
  }

  /**
   * Show keyboard shortcuts help
   */
  showHelp() {
    const shortcuts = Array.from(this.shortcuts.values());

    const helpText = shortcuts.map(s => {
      const keyDisplay = s.key
        .replace('ctrl+', '⌘ ')
        .replace('shift+', '⇧ ')
        .replace('alt+', '⌥ ')
        .toUpperCase();

      return `${keyDisplay.padEnd(20)} ${s.description}`;
    }).join('\n');

    console.log('\n=== Keyboard Shortcuts ===\n' + helpText + '\n');

    // Could also show a modal here
    alert('Keyboard Shortcuts:\n\n' + helpText);
  }

  /**
   * Enable shortcuts
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable shortcuts
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Unregister a shortcut
   * @param {string} key - Key combination
   */
  unregister(key) {
    this.shortcuts.delete(key.toLowerCase());
  }
}

// Create singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();
