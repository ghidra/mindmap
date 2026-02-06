/**
 * Reference Connection Type
 *
 * Represents code references between nodes.
 * Used for imports, function calls, class inheritance, etc.
 */

import { ConnectionType } from './ConnectionType.js';

/**
 * Reference subtypes.
 */
export const ReferenceSubtype = {
  IMPORT: 'import',         // ES6 import statement
  CALL: 'call',             // Function/method call
  EXTENDS: 'extends',       // Class inheritance
  IMPLEMENTS: 'implements', // Interface implementation
  USES: 'uses',             // General usage reference
  TYPEOF: 'typeof',         // Type checking reference
  NEW: 'new'                // Instantiation
};

/**
 * Reference Connection type.
 */
export class ReferenceConnection extends ConnectionType {
  /**
   * Unique type identifier.
   */
  static id = 'reference';

  /**
   * Display name.
   */
  static name = 'Reference';

  /**
   * Description.
   */
  static description = 'Code reference connection (imports, calls, inheritance)';

  /**
   * Default visual style.
   */
  static defaultStyle = {
    stroke: '#666',
    strokeWidth: 2,
    strokeDasharray: null,
    animated: false,
    showArrow: true,
    arrowColor: null,
    showLabel: true,
    labelPosition: 'middle',
    labelBackground: 'rgba(102, 102, 102, 0.1)'
  };

  /**
   * Default metadata.
   */
  static defaultMetadata = {
    label: '',
    weight: 1,
    bidirectional: false,
    subtype: ReferenceSubtype.USES,  // Reference subtype
    line: null,                       // Line number in source
    count: 1                          // Number of references
  };

  /**
   * Styles by reference subtype.
   */
  static subtypeStyles = {
    [ReferenceSubtype.IMPORT]: {
      stroke: '#9b59b6',
      strokeDasharray: '5,3'
    },
    [ReferenceSubtype.CALL]: {
      stroke: '#3498db',
      strokeDasharray: null
    },
    [ReferenceSubtype.EXTENDS]: {
      stroke: '#e74c3c',
      strokeWidth: 3
    },
    [ReferenceSubtype.IMPLEMENTS]: {
      stroke: '#e67e22',
      strokeDasharray: '8,4'
    },
    [ReferenceSubtype.USES]: {
      stroke: '#666',
      strokeDasharray: null
    },
    [ReferenceSubtype.TYPEOF]: {
      stroke: '#1abc9c',
      strokeDasharray: '2,2'
    },
    [ReferenceSubtype.NEW]: {
      stroke: '#e74c3c',
      strokeDasharray: null
    }
  };

  // =========================================================================
  // Style Methods
  // =========================================================================

  /**
   * Get style based on reference subtype.
   */
  static getStyle(overrides = {}) {
    const baseStyle = super.getStyle(overrides);
    const subtype = overrides.subtype || ReferenceSubtype.USES;
    const subtypeStyle = this.subtypeStyles[subtype] || {};

    return {
      ...baseStyle,
      ...subtypeStyle,
      ...overrides
    };
  }

  /**
   * Get style for connection rendering.
   */
  static getStateStyle(connection, state = {}) {
    const subtype = connection.metadata?.subtype || ReferenceSubtype.USES;
    const subtypeStyle = this.subtypeStyles[subtype] || {};

    let style = {
      ...this.defaultStyle,
      ...subtypeStyle,
      ...connection.style
    };

    if (state.selected) {
      style.stroke = '#2196f3';
      style.strokeWidth = Math.max(style.strokeWidth || 2, 3);
    }

    if (state.hovered) {
      style.strokeWidth = (style.strokeWidth || 2) + 1;
    }

    return style;
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Reference connections can connect most node types.
   */
  static canConnect(fromPort, toPort, fromNode, toNode) {
    // References are generally flexible
    return { valid: true };
  }

  /**
   * Get suggested label based on reference type.
   */
  static getSuggestedLabel(fromPort, toPort, fromNode, toNode) {
    // Could be enhanced to detect reference type
    return '';
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get display name for a reference subtype.
   *
   * @param {string} subtype - Reference subtype
   * @returns {string}
   */
  static getSubtypeName(subtype) {
    const names = {
      [ReferenceSubtype.IMPORT]: 'Import',
      [ReferenceSubtype.CALL]: 'Call',
      [ReferenceSubtype.EXTENDS]: 'Extends',
      [ReferenceSubtype.IMPLEMENTS]: 'Implements',
      [ReferenceSubtype.USES]: 'Uses',
      [ReferenceSubtype.TYPEOF]: 'Type Check',
      [ReferenceSubtype.NEW]: 'Instantiation'
    };
    return names[subtype] || 'Reference';
  }

  /**
   * Create connection metadata for a specific reference type.
   *
   * @param {string} subtype - Reference subtype
   * @param {Object} [extra] - Additional metadata
   * @returns {Object}
   */
  static createMetadata(subtype, extra = {}) {
    return {
      ...this.defaultMetadata,
      subtype,
      label: this.getSubtypeName(subtype),
      ...extra
    };
  }
}
