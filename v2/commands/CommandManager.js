/**
 * Command Manager
 *
 * Central manager for the undo/redo system.
 * Tracks command history and provides execute/undo/redo operations.
 *
 * Features:
 * - Configurable history size
 * - Command merging for smoother undo (e.g., drag operations)
 * - Event callbacks for UI updates
 * - History serialization support
 *
 * @see ARCHITECTURE_PLAN.md Module 7 for full documentation
 */

import { Command, NullCommand } from './Command.js';

export class CommandManager {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.maxHistory - Maximum commands to keep in history (default 100)
   * @param {number} options.mergeWindow - Time window (ms) for merging commands (default 500)
   */
  constructor(options = {}) {
    this.maxHistory = options.maxHistory ?? 100;
    this.mergeWindow = options.mergeWindow ?? 500;

    // Command stacks
    this.undoStack = [];
    this.redoStack = [];

    // Event callbacks
    this.onStateChange = null;  // Called when undo/redo state changes
    this.onExecute = null;      // Called when a command is executed
    this.onUndo = null;         // Called when a command is undone
    this.onRedo = null;         // Called when a command is redone

    // Track if we're currently in an undo/redo operation
    this._isUndoing = false;
    this._isRedoing = false;

    // Batch mode for grouping multiple commands
    this._batchCommands = null;
    this._batchDescription = null;
  }

  /**
   * Execute a command and add it to the undo stack.
   *
   * @param {Command} command - The command to execute
   * @param {boolean} skipExecution - If true, assume command already executed (for wrapping existing actions)
   */
  execute(command, skipExecution = false) {
    if (!(command instanceof Command)) {
      console.error('CommandManager.execute: Invalid command', command);
      return;
    }

    // If in batch mode, collect commands
    if (this._batchCommands !== null) {
      if (!skipExecution) {
        command.execute();
      }
      command._executed = true;
      this._batchCommands.push(command);
      return;
    }

    // Execute the command
    if (!skipExecution) {
      try {
        command.execute();
        command._executed = true;
      } catch (error) {
        console.error('Command execution failed:', error);
        return;
      }
    }

    // Try to merge with the last command
    if (this.undoStack.length > 0) {
      const lastCommand = this.undoStack[this.undoStack.length - 1];
      const timeDiff = command.timestamp - lastCommand.timestamp;

      if (timeDiff < this.mergeWindow && lastCommand.canMerge(command)) {
        lastCommand.merge(command);
        this._notifyStateChange();
        return;
      }
    }

    // Add to undo stack
    this.undoStack.push(command);

    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];

    // Trim history if needed
    this._trimHistory();

    // Notify listeners
    if (this.onExecute) {
      this.onExecute(command);
    }
    this._notifyStateChange();
  }

  /**
   * Undo the last command.
   *
   * @returns {Command|null} The undone command, or null if nothing to undo
   */
  undo() {
    if (!this.canUndo()) {
      return null;
    }

    this._isUndoing = true;

    const command = this.undoStack.pop();

    try {
      command.undo();
      command._executed = false;
    } catch (error) {
      console.error('Command undo failed:', error);
      // Put it back on the stack
      this.undoStack.push(command);
      this._isUndoing = false;
      return null;
    }

    // Move to redo stack
    this.redoStack.push(command);

    this._isUndoing = false;

    // Notify listeners
    if (this.onUndo) {
      this.onUndo(command);
    }
    this._notifyStateChange();

    return command;
  }

  /**
   * Redo the last undone command.
   *
   * @returns {Command|null} The redone command, or null if nothing to redo
   */
  redo() {
    if (!this.canRedo()) {
      return null;
    }

    this._isRedoing = true;

    const command = this.redoStack.pop();

    try {
      command.execute();
      command._executed = true;
    } catch (error) {
      console.error('Command redo failed:', error);
      // Put it back on the stack
      this.redoStack.push(command);
      this._isRedoing = false;
      return null;
    }

    // Move back to undo stack
    this.undoStack.push(command);

    this._isRedoing = false;

    // Notify listeners
    if (this.onRedo) {
      this.onRedo(command);
    }
    this._notifyStateChange();

    return command;
  }

  /**
   * Check if there are commands to undo.
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if there are commands to redo.
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo action.
   * @returns {string|null}
   */
  getUndoDescription() {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next redo action.
   * @returns {string|null}
   */
  getRedoDescription() {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Begin a batch operation.
   * All commands executed until endBatch() will be grouped into one undoable action.
   *
   * @param {string} description - Description for the batch
   */
  beginBatch(description = 'Multiple actions') {
    if (this._batchCommands !== null) {
      console.warn('CommandManager: beginBatch called while already in batch mode');
      return;
    }
    this._batchCommands = [];
    this._batchDescription = description;
  }

  /**
   * End a batch operation and create a composite command.
   *
   * @returns {Command|null} The composite command, or null if batch was empty
   */
  endBatch() {
    if (this._batchCommands === null) {
      console.warn('CommandManager: endBatch called without beginBatch');
      return null;
    }

    const commands = this._batchCommands;
    const description = this._batchDescription;

    this._batchCommands = null;
    this._batchDescription = null;

    if (commands.length === 0) {
      return null;
    }

    if (commands.length === 1) {
      // Single command doesn't need to be wrapped
      this.undoStack.push(commands[0]);
      this.redoStack = [];
      this._trimHistory();
      this._notifyStateChange();
      return commands[0];
    }

    // Create composite command (import dynamically to avoid circular dependency)
    const { CompositeCommand } = require('./Command.js');
    const composite = new CompositeCommand(commands, description);
    composite._executed = true;

    this.undoStack.push(composite);
    this.redoStack = [];
    this._trimHistory();
    this._notifyStateChange();

    return composite;
  }

  /**
   * Cancel a batch operation, undoing all commands in the batch.
   */
  cancelBatch() {
    if (this._batchCommands === null) {
      return;
    }

    // Undo all commands in reverse order
    for (let i = this._batchCommands.length - 1; i >= 0; i--) {
      try {
        this._batchCommands[i].undo();
      } catch (error) {
        console.error('Error undoing batch command:', error);
      }
    }

    this._batchCommands = null;
    this._batchDescription = null;
  }

  /**
   * Check if currently in batch mode.
   * @returns {boolean}
   */
  isInBatch() {
    return this._batchCommands !== null;
  }

  /**
   * Check if currently undoing or redoing.
   * Useful to prevent recursive command registration.
   * @returns {boolean}
   */
  isUndoingOrRedoing() {
    return this._isUndoing || this._isRedoing;
  }

  /**
   * Clear all history.
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._batchCommands = null;
    this._batchDescription = null;
    this._notifyStateChange();
  }

  /**
   * Get the undo history.
   * @returns {Command[]}
   */
  getUndoHistory() {
    return [...this.undoStack];
  }

  /**
   * Get the redo history.
   * @returns {Command[]}
   */
  getRedoHistory() {
    return [...this.redoStack];
  }

  /**
   * Get the total number of commands in history.
   * @returns {number}
   */
  getHistorySize() {
    return this.undoStack.length + this.redoStack.length;
  }

  /**
   * Set callback for state changes.
   * Called whenever undo/redo availability changes.
   *
   * @param {Function} callback - Function receiving { canUndo, canRedo, undoDescription, redoDescription }
   */
  setStateChangeCallback(callback) {
    this.onStateChange = callback;
  }

  /**
   * Serialize the command history for persistence.
   * @returns {Object}
   */
  serialize() {
    return {
      undoStack: this.undoStack.map(cmd => cmd.serialize()),
      redoStack: this.redoStack.map(cmd => cmd.serialize())
    };
  }

  // ============ Private Methods ============

  /**
   * Trim history to maxHistory size.
   * Removes oldest commands first.
   */
  _trimHistory() {
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  /**
   * Notify listeners of state change.
   */
  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoDescription: this.getUndoDescription(),
        redoDescription: this.getRedoDescription(),
        historySize: this.getHistorySize()
      });
    }
  }
}

// Create singleton instance
export const commandManager = new CommandManager();
