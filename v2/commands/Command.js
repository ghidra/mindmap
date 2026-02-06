/**
 * Command Base Class
 *
 * Abstract base class for all commands in the undo/redo system.
 * All state-changing actions should be implemented as Command subclasses.
 *
 * Usage:
 *   class MyCommand extends Command {
 *     constructor(data) {
 *       super();
 *       this.data = data;
 *     }
 *     get description() { return 'My action'; }
 *     execute() { // do the thing }
 *     undo() { // reverse the thing }
 *   }
 *
 * @see ARCHITECTURE_PLAN.md Module 7 for full documentation
 */

export class Command {
  constructor() {
    // Timestamp when command was created
    this.timestamp = Date.now();

    // Unique ID for this command instance
    this.id = `cmd-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    // Track if command has been executed
    this._executed = false;
  }

  /**
   * Human-readable description of this command.
   * Used in undo/redo menus and history display.
   * @returns {string}
   */
  get description() {
    return 'Unknown action';
  }

  /**
   * The type/category of this command.
   * Useful for filtering history or grouping related commands.
   * @returns {string}
   */
  get type() {
    return 'unknown';
  }

  /**
   * Execute the command (perform the action).
   * This method should be idempotent - calling it multiple times
   * should have the same effect as calling it once.
   *
   * @throws {Error} If not implemented by subclass
   */
  execute() {
    throw new Error(`Command.execute() not implemented in ${this.constructor.name}`);
  }

  /**
   * Undo the command (reverse the action).
   * This should restore state to exactly what it was before execute().
   *
   * @throws {Error} If not implemented by subclass
   */
  undo() {
    throw new Error(`Command.undo() not implemented in ${this.constructor.name}`);
  }

  /**
   * Check if this command can be merged with another command.
   * Merging combines multiple small commands into one larger command.
   *
   * Example: Multiple small node movements during a drag become one "Move node" command.
   *
   * @param {Command} other - The command to potentially merge with
   * @returns {boolean} True if commands can be merged
   */
  canMerge(other) {
    return false;
  }

  /**
   * Merge another command into this one.
   * Only called if canMerge(other) returns true.
   *
   * The merged command should represent the combined effect of both commands.
   *
   * @param {Command} other - The command to merge
   * @returns {Command} The merged command (usually this, modified)
   */
  merge(other) {
    return this;
  }

  /**
   * Check if this command is still valid.
   * A command might become invalid if its target was deleted.
   *
   * @returns {boolean} True if command can still be executed/undone
   */
  isValid() {
    return true;
  }

  /**
   * Get the size/weight of this command for history management.
   * Larger commands may be pruned first when history is full.
   *
   * @returns {number} Size weight (default 1)
   */
  getSize() {
    return 1;
  }

  /**
   * Serialize the command for persistence.
   * Override in subclasses to enable command history persistence.
   *
   * @returns {Object} Serializable representation
   */
  serialize() {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description
    };
  }

  /**
   * Create a command from serialized data.
   * Override in subclasses to enable command history persistence.
   *
   * @param {Object} data - Serialized command data
   * @returns {Command} Reconstructed command
   */
  static deserialize(data) {
    throw new Error('Command.deserialize() must be implemented by subclass');
  }
}

/**
 * Composite Command
 *
 * Groups multiple commands into a single undoable action.
 * Useful for operations that affect multiple things at once.
 *
 * Example: "Delete selection" might delete multiple nodes and their connections.
 */
export class CompositeCommand extends Command {
  /**
   * @param {Command[]} commands - Array of commands to group
   * @param {string} description - Description for the composite action
   */
  constructor(commands, description = 'Multiple actions') {
    super();
    this.commands = commands;
    this._description = description;
  }

  get description() {
    return this._description;
  }

  get type() {
    return 'composite';
  }

  execute() {
    // Execute all commands in order
    for (const command of this.commands) {
      command.execute();
    }
    this._executed = true;
  }

  undo() {
    // Undo all commands in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
    this._executed = false;
  }

  isValid() {
    // Composite is valid if all sub-commands are valid
    return this.commands.every(cmd => cmd.isValid());
  }

  getSize() {
    // Sum of all sub-command sizes
    return this.commands.reduce((sum, cmd) => sum + cmd.getSize(), 0);
  }

  serialize() {
    return {
      ...super.serialize(),
      commands: this.commands.map(cmd => cmd.serialize())
    };
  }
}

/**
 * Null Command
 *
 * A command that does nothing. Useful as a placeholder or default.
 */
export class NullCommand extends Command {
  get description() {
    return 'No action';
  }

  get type() {
    return 'null';
  }

  execute() {
    // Do nothing
  }

  undo() {
    // Do nothing
  }
}
