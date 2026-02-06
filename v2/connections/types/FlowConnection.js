/**
 * Flow Connection Type
 *
 * Represents execution flow between nodes.
 * Used for visualizing program execution order, control flow, etc.
 */

import { ConnectionType } from './ConnectionType.js';

/**
 * Flow subtypes.
 */
export const FlowSubtype = {
  SEQUENTIAL: 'sequential',   // Normal sequential execution
  CONDITIONAL: 'conditional', // Conditional branch (if/else)
  LOOP: 'loop',               // Loop iteration
  CALLBACK: 'callback',       // Callback/async continuation
  ERROR: 'error',             // Error handling flow
  RETURN: 'return'            // Return value flow
};

/**
 * Flow Connection type.
 */
export class FlowConnection extends ConnectionType {
  /**
   * Unique type identifier.
   */
  static id = 'flow';

  /**
   * Display name.
   */
  static name = 'Execution Flow';

  /**
   * Description.
   */
  static description = 'Execution flow connection showing program control flow';

  /**
   * Default visual style.
   */
  static defaultStyle = {
    stroke: '#27ae60',
    strokeWidth: 3,
    strokeDasharray: null,
    animated: true,
    showArrow: true,
    arrowColor: null,
    showLabel: true,
    labelPosition: 'middle',
    labelBackground: 'rgba(39, 174, 96, 0.1)'
  };

  /**
   * Default metadata.
   */
  static defaultMetadata = {
    label: '',
    weight: 1,
    bidirectional: false,
    subtype: FlowSubtype.SEQUENTIAL,
    order: 0,          // Execution order
    condition: null,   // Condition for conditional flows
    isAsync: false     // Whether flow involves async operations
  };

  /**
   * Styles by flow subtype.
   */
  static subtypeStyles = {
    [FlowSubtype.SEQUENTIAL]: {
      stroke: '#27ae60',
      strokeDasharray: null
    },
    [FlowSubtype.CONDITIONAL]: {
      stroke: '#f39c12',
      strokeDasharray: '8,4'
    },
    [FlowSubtype.LOOP]: {
      stroke: '#3498db',
      strokeDasharray: '4,4'
    },
    [FlowSubtype.CALLBACK]: {
      stroke: '#9b59b6',
      strokeDasharray: '10,5,2,5'
    },
    [FlowSubtype.ERROR]: {
      stroke: '#e74c3c',
      strokeDasharray: '5,5'
    },
    [FlowSubtype.RETURN]: {
      stroke: '#1abc9c',
      strokeDasharray: null
    }
  };

  /**
   * Animation speeds by subtype.
   */
  static subtypeAnimationSpeeds = {
    [FlowSubtype.SEQUENTIAL]: '2s',
    [FlowSubtype.CONDITIONAL]: '2.5s',
    [FlowSubtype.LOOP]: '1s',      // Faster for loops
    [FlowSubtype.CALLBACK]: '3s',   // Slower for async
    [FlowSubtype.ERROR]: '1.5s',
    [FlowSubtype.RETURN]: '1.5s'
  };

  // =========================================================================
  // Style Methods
  // =========================================================================

  /**
   * Get style based on flow subtype.
   */
  static getStyle(overrides = {}) {
    const baseStyle = super.getStyle(overrides);
    const subtype = overrides.subtype || FlowSubtype.SEQUENTIAL;
    const subtypeStyle = this.subtypeStyles[subtype] || {};

    return {
      ...baseStyle,
      ...subtypeStyle,
      ...overrides
    };
  }

  /**
   * Get animation configuration for flow visualization.
   */
  static getAnimationConfig(connection) {
    const style = this.getStyle(connection.style);
    const subtype = connection.metadata?.subtype || FlowSubtype.SEQUENTIAL;

    if (!style.animated) {
      return null;
    }

    const duration = this.subtypeAnimationSpeeds[subtype] || '2s';

    return {
      type: 'flow',
      duration,
      dotRadius: 5,
      dotColor: style.stroke,
      dotCount: subtype === FlowSubtype.LOOP ? 5 : 1,
      easing: subtype === FlowSubtype.CALLBACK ? 'ease-in-out' : 'linear'
    };
  }

  /**
   * Get state-based style.
   */
  static getStateStyle(connection, state = {}) {
    const subtype = connection.metadata?.subtype || FlowSubtype.SEQUENTIAL;
    const subtypeStyle = this.subtypeStyles[subtype] || {};

    let style = {
      ...this.defaultStyle,
      ...subtypeStyle,
      ...connection.style
    };

    if (state.active) {
      // Currently executing flow
      style.strokeWidth = Math.max(style.strokeWidth || 3, 4);
      style.animated = true;
    }

    if (state.selected) {
      style.stroke = '#2196f3';
      style.strokeWidth = Math.max(style.strokeWidth || 3, 4);
    }

    if (state.hovered) {
      style.strokeWidth = (style.strokeWidth || 3) + 1;
    }

    return style;
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Flow connections should connect executable nodes.
   */
  static canConnect(fromPort, toPort, fromNode, toNode) {
    // Flow typically goes from output to input
    // But can be more flexible for control flow
    return { valid: true };
  }

  /**
   * Get suggested label based on flow type.
   */
  static getSuggestedLabel(fromPort, toPort, fromNode, toNode) {
    return '';
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get display name for a flow subtype.
   *
   * @param {string} subtype - Flow subtype
   * @returns {string}
   */
  static getSubtypeName(subtype) {
    const names = {
      [FlowSubtype.SEQUENTIAL]: 'Sequential',
      [FlowSubtype.CONDITIONAL]: 'Conditional',
      [FlowSubtype.LOOP]: 'Loop',
      [FlowSubtype.CALLBACK]: 'Callback',
      [FlowSubtype.ERROR]: 'Error',
      [FlowSubtype.RETURN]: 'Return'
    };
    return names[subtype] || 'Flow';
  }

  /**
   * Create connection metadata for a specific flow type.
   *
   * @param {string} subtype - Flow subtype
   * @param {Object} [extra] - Additional metadata
   * @returns {Object}
   */
  static createMetadata(subtype, extra = {}) {
    return {
      ...this.defaultMetadata,
      subtype,
      label: extra.label || '',
      ...extra
    };
  }

  /**
   * Create a conditional flow metadata.
   *
   * @param {string} condition - Condition expression
   * @param {boolean} [branch=true] - True or false branch
   * @returns {Object}
   */
  static createConditionalMetadata(condition, branch = true) {
    return this.createMetadata(FlowSubtype.CONDITIONAL, {
      condition,
      label: branch ? 'true' : 'false'
    });
  }

  /**
   * Create a loop flow metadata.
   *
   * @param {string} [loopType='for'] - Loop type (for, while, etc.)
   * @returns {Object}
   */
  static createLoopMetadata(loopType = 'for') {
    return this.createMetadata(FlowSubtype.LOOP, {
      label: loopType
    });
  }
}
