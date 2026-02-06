/**
 * Data Connection Type
 *
 * Represents data flow between nodes.
 * Used for passing values, parameters, or data between functions/components.
 */

import { ConnectionType } from './ConnectionType.js';

/**
 * Data Connection type.
 */
export class DataConnection extends ConnectionType {
  /**
   * Unique type identifier.
   */
  static id = 'data';

  /**
   * Display name.
   */
  static name = 'Data Flow';

  /**
   * Description.
   */
  static description = 'Data flow connection for passing values between nodes';

  /**
   * Default visual style.
   */
  static defaultStyle = {
    stroke: '#3498db',
    strokeWidth: 2,
    strokeDasharray: null,
    animated: false,
    showArrow: true,
    arrowColor: null,
    showLabel: true,
    labelPosition: 'middle',
    labelBackground: 'rgba(52, 152, 219, 0.1)'
  };

  /**
   * Default metadata.
   */
  static defaultMetadata = {
    label: '',
    weight: 1,
    bidirectional: false,
    dataType: 'unknown'  // Data type being transferred
  };

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Check if data connection is valid.
   * Data connections require compatible data types.
   */
  static canConnect(fromPort, toPort, fromNode, toNode) {
    // Must be output to input
    if (fromPort.type !== 'output' && fromPort.type !== 'bidirectional') {
      return { valid: false, reason: 'Data flow must start from output port' };
    }

    if (toPort.type !== 'input' && toPort.type !== 'bidirectional') {
      return { valid: false, reason: 'Data flow must end at input port' };
    }

    return { valid: true };
  }

  /**
   * Get suggested label based on data type.
   */
  static getSuggestedLabel(fromPort, toPort, fromNode, toNode) {
    // If ports have labels, use them
    if (fromPort.label && toPort.label) {
      return `${fromPort.label} → ${toPort.label}`;
    }

    // If data type known, suggest it
    const dataType = fromPort.dataType || toPort.dataType;
    if (dataType && dataType !== 'unknown') {
      return dataType;
    }

    return '';
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Get style based on data type.
   */
  static getStyle(overrides = {}) {
    const style = super.getStyle(overrides);

    // Color based on data type if available
    const dataType = overrides.dataType || 'unknown';
    const typeColors = {
      number: '#f39c12',
      string: '#27ae60',
      boolean: '#9b59b6',
      array: '#3498db',
      object: '#e74c3c',
      function: '#1abc9c',
      unknown: '#3498db'
    };

    if (typeColors[dataType]) {
      style.stroke = typeColors[dataType];
    }

    return style;
  }

  /**
   * Get animation config for data flow visualization.
   */
  static getAnimationConfig(connection) {
    const style = this.getStyle(connection.style);

    if (!style.animated) {
      return null;
    }

    return {
      type: 'flow',
      duration: '1.5s',  // Faster than default for data
      dotRadius: 3,
      dotColor: style.stroke,
      dotCount: 3  // Multiple dots for data flow visualization
    };
  }
}
