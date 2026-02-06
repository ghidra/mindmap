/**
 * Base Connection Type
 *
 * Abstract base class for connection type definitions.
 * Each connection type defines its visual style, validation rules,
 * and behavior.
 *
 * @see ARCHITECTURE_PLAN.md Module 3 for full documentation
 */

/**
 * @typedef {Object} ConnectionTypeStyle
 * @property {string} stroke - Stroke color
 * @property {number} strokeWidth - Stroke width
 * @property {string} [strokeDasharray] - Dash pattern
 * @property {boolean} animated - Show flow animation
 * @property {boolean} showArrow - Show arrowhead
 * @property {string} [arrowColor] - Arrow color (defaults to stroke)
 * @property {boolean} showLabel - Show connection label
 * @property {string} labelPosition - Label position (start, middle, end)
 * @property {string} [labelBackground] - Label background color
 */

/**
 * Base connection type class.
 * Extend this class to create custom connection types.
 */
export class ConnectionType {
  /**
   * Unique type identifier.
   * @type {string}
   */
  static id = 'base';

  /**
   * Display name.
   * @type {string}
   */
  static name = 'Connection';

  /**
   * Description.
   * @type {string}
   */
  static description = 'Base connection type';

  /**
   * Default visual style.
   * @type {ConnectionTypeStyle}
   */
  static defaultStyle = {
    stroke: '#666',
    strokeWidth: 2,
    strokeDasharray: null,
    animated: false,
    showArrow: true,
    arrowColor: null,
    showLabel: false,
    labelPosition: 'middle',
    labelBackground: 'rgba(255, 255, 255, 0.9)'
  };

  /**
   * Whether this connection type allows labels.
   * @type {boolean}
   */
  static allowsLabel = true;

  /**
   * Whether this connection type supports animation.
   * @type {boolean}
   */
  static allowsAnimation = true;

  /**
   * Default metadata for new connections of this type.
   * @type {Object}
   */
  static defaultMetadata = {
    label: '',
    weight: 1,
    bidirectional: false
  };

  // =========================================================================
  // Style Methods
  // =========================================================================

  /**
   * Get the default style for this connection type.
   *
   * @returns {ConnectionTypeStyle}
   */
  static getDefaultStyle() {
    return { ...this.defaultStyle };
  }

  /**
   * Get style with overrides applied.
   *
   * @param {Object} [overrides] - Style overrides
   * @returns {ConnectionTypeStyle}
   */
  static getStyle(overrides = {}) {
    return {
      ...this.defaultStyle,
      ...overrides
    };
  }

  /**
   * Get style based on connection state.
   *
   * @param {Object} connection - Connection object
   * @param {Object} [state] - Connection state (selected, hovered, etc.)
   * @returns {ConnectionTypeStyle}
   */
  static getStateStyle(connection, state = {}) {
    const style = this.getStyle(connection.style);

    if (state.selected) {
      style.stroke = '#2196f3';
      style.strokeWidth = Math.max(style.strokeWidth, 3);
    }

    if (state.hovered) {
      style.strokeWidth = style.strokeWidth + 1;
    }

    if (state.invalid) {
      style.stroke = '#e74c3c';
      style.strokeDasharray = '5,5';
    }

    return style;
  }

  // =========================================================================
  // Validation Methods
  // =========================================================================

  /**
   * Check if this connection type can connect the given ports.
   * Override in subclasses for type-specific validation.
   *
   * @param {Object} fromPort - Source port
   * @param {Object} toPort - Target port
   * @param {Object} fromNode - Source node
   * @param {Object} toNode - Target node
   * @returns {{valid: boolean, reason?: string}}
   */
  static canConnect(fromPort, toPort, fromNode, toNode) {
    // Default: allow all connections
    return { valid: true };
  }

  /**
   * Get suggested label for a connection.
   * Override in subclasses to provide intelligent labels.
   *
   * @param {Object} fromPort - Source port
   * @param {Object} toPort - Target port
   * @param {Object} fromNode - Source node
   * @param {Object} toNode - Target node
   * @returns {string}
   */
  static getSuggestedLabel(fromPort, toPort, fromNode, toNode) {
    return '';
  }

  // =========================================================================
  // Rendering Methods
  // =========================================================================

  /**
   * Get custom SVG attributes for the connection path.
   * Override in subclasses for custom rendering.
   *
   * @param {Object} connection - Connection object
   * @returns {Object} SVG attributes
   */
  static getPathAttributes(connection) {
    const style = this.getStyle(connection.style);

    return {
      stroke: style.stroke,
      'stroke-width': style.strokeWidth,
      'stroke-dasharray': style.strokeDasharray || 'none',
      fill: 'none',
      'marker-end': style.showArrow ? 'url(#arrowhead)' : 'none'
    };
  }

  /**
   * Get animation configuration.
   *
   * @param {Object} connection - Connection object
   * @returns {Object|null} Animation config or null if not animated
   */
  static getAnimationConfig(connection) {
    const style = this.getStyle(connection.style);

    if (!style.animated || !this.allowsAnimation) {
      return null;
    }

    return {
      type: 'flow',
      duration: '2s',
      dotRadius: 4,
      dotColor: style.stroke
    };
  }

  /**
   * Get label configuration.
   *
   * @param {Object} connection - Connection object
   * @returns {Object|null} Label config or null if no label
   */
  static getLabelConfig(connection) {
    const style = this.getStyle(connection.style);
    const label = connection.metadata?.label;

    if (!label || !style.showLabel || !this.allowsLabel) {
      return null;
    }

    return {
      text: label,
      position: style.labelPosition,
      background: style.labelBackground,
      fontSize: 12,
      fontFamily: 'system-ui, sans-serif'
    };
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Called when a connection of this type is created.
   * Override for custom initialization.
   *
   * @param {Object} connection - The new connection
   */
  static onCreate(connection) {
    // Default: do nothing
  }

  /**
   * Called when a connection of this type is deleted.
   * Override for cleanup.
   *
   * @param {Object} connection - The deleted connection
   */
  static onDelete(connection) {
    // Default: do nothing
  }

  /**
   * Called when a connection of this type is updated.
   *
   * @param {Object} connection - The updated connection
   * @param {Object} changes - The changes made
   */
  static onUpdate(connection, changes) {
    // Default: do nothing
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Serialize type-specific data.
   * Override in subclasses if type has special data.
   *
   * @param {Object} connection - Connection to serialize
   * @returns {Object} Serialized type data
   */
  static serializeTypeData(connection) {
    return {};
  }

  /**
   * Deserialize type-specific data.
   *
   * @param {Object} data - Serialized type data
   * @param {Object} connection - Connection being deserialized
   * @returns {Object} Deserialized type data to merge
   */
  static deserializeTypeData(data, connection) {
    return {};
  }

  // =========================================================================
  // Info
  // =========================================================================

  /**
   * Get type information.
   *
   * @returns {Object}
   */
  static getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      allowsLabel: this.allowsLabel,
      allowsAnimation: this.allowsAnimation,
      defaultStyle: this.defaultStyle
    };
  }
}
