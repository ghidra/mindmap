/**
 * Method Node - Represents a class method
 *
 * Similar to FunctionNode but with method-specific properties:
 * - visibility (public, private, protected)
 * - isStatic flag
 * - isConstructor flag
 * - Association with parent class
 *
 * @extends BaseNodeType
 */

import { BaseNodeType } from '../BaseNodeType.js';
import { inferDataType } from '../../core/PortSystem.js';

/**
 * Visibility icons for method display
 */
const VISIBILITY_ICONS = {
  public: '●',
  protected: '◐',
  private: '○',
  default: '●'
};

/**
 * Visibility colors for method display
 */
const VISIBILITY_COLORS = {
  public: '#27ae60',
  protected: '#f39c12',
  private: '#e74c3c',
  default: '#27ae60'
};

/**
 * Method Node Type class.
 */
export class MethodNode extends BaseNodeType {
  // =========================================================================
  // Static Properties
  // =========================================================================

  static id = 'method';
  static displayName = 'Method';
  static category = 'code';
  static icon = '🔧';

  static defaultPorts = [
    {
      id: 'return',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'return',
      dataType: 'unknown'
    }
  ];

  static defaultStyle = {
    width: 170,
    height: 90,
    color: '#2d3a4a',
    borderColor: '#5c9ce6',
    borderWidth: 2,
    borderRadius: 4
  };

  static features = {
    canHaveChildren: false,
    canHaveAttributes: true,
    canResize: false,
    canContainNodes: false,
    canCollapse: false,
    canEdit: true
  };

  // =========================================================================
  // Port Generation
  // =========================================================================

  /**
   * Generate ports dynamically based on method parameters.
   *
   * Supports manual override via node.inputPorts and node.outputPorts arrays.
   *
   * @param {Object} node - The node instance
   * @returns {Array} Array of port definitions
   */
  static getPorts(node) {
    const ports = [];

    // Check for manual port override first
    if (node.inputPorts && node.inputPorts.length > 0) {
      node.inputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `input-${name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (node.inputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Get parameters from node.parameters array or node.attributes object
      let params = node.parameters || [];

      // Fallback to attributes if parameters is empty
      if (params.length === 0 && node.attributes) {
        if (Array.isArray(node.attributes)) {
          params = node.attributes;
        } else if (typeof node.attributes === 'object') {
          params = Object.entries(node.attributes).map(([name, value]) => ({ name, value }));
        }
      }

      // Filter out 'this' parameter for instance methods
      params = params.filter(p => {
        const name = typeof p === 'object' ? (p.name || p.title) : String(p).split('=')[0].trim();
        return name !== 'this' && name !== 'self';
      });

      // Create input port for each parameter
      params.forEach((param, idx) => {
        let paramName, defaultValue;

        if (typeof param === 'object') {
          paramName = param.name || param.title;
          defaultValue = param.defaultValue || param.value;
        } else {
          const paramStr = String(param);
          if (paramStr.includes('=')) {
            const parts = paramStr.split('=');
            paramName = parts[0].trim();
            defaultValue = parts[1].trim();
          } else {
            paramName = paramStr.trim();
            defaultValue = null;
          }
        }

        if (paramName) {
          ports.push({
            id: `param-${paramName}`,
            side: 'left',
            type: 'input',
            position: (idx + 1) / (params.length + 1),
            label: paramName,
            dataType: inferDataType(defaultValue)
          });
        }
      });
    }

    // Check for manual output ports override
    if (node.outputPorts && node.outputPorts.length > 0) {
      node.outputPorts.forEach((portDef, idx) => {
        const name = typeof portDef === 'string' ? portDef : portDef.name;
        const value = typeof portDef === 'object' ? portDef.value : null;
        ports.push({
          id: `output-${name}`,
          side: 'right',
          type: 'output',
          position: (idx + 1) / (node.outputPorts.length + 1),
          label: name,
          dataType: inferDataType(value)
        });
      });
    } else {
      // Default return port
      ports.push({
        id: 'return',
        side: 'right',
        type: 'output',
        position: 0.5,
        label: node.returnType || 'return',
        dataType: node.returnType ? node.returnType.toLowerCase() : 'unknown'
      });
    }

    return ports;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render method-specific content.
   *
   * Shows visibility, static indicator, parameters, and return type.
   *
   * @param {Object} node - The node instance
   * @param {HTMLElement} container - Container element
   */
  static renderContent(node, container) {
    const content = document.createElement('div');
    content.className = 'method-node-content';

    // Create badges row for visibility and modifiers
    const badges = document.createElement('div');
    badges.className = 'method-badges';
    badges.style.display = 'flex';
    badges.style.gap = '4px';
    badges.style.marginBottom = '4px';
    badges.style.flexWrap = 'wrap';

    // Visibility badge
    const visibility = node.visibility || 'public';
    const visibilityBadge = document.createElement('span');
    visibilityBadge.className = 'method-visibility';
    visibilityBadge.textContent = `${VISIBILITY_ICONS[visibility] || VISIBILITY_ICONS.default} ${visibility}`;
    visibilityBadge.style.fontSize = '10px';
    visibilityBadge.style.color = VISIBILITY_COLORS[visibility] || VISIBILITY_COLORS.default;
    visibilityBadge.style.padding = '1px 4px';
    visibilityBadge.style.borderRadius = '3px';
    visibilityBadge.style.backgroundColor = 'rgba(0,0,0,0.2)';
    badges.appendChild(visibilityBadge);

    // Static badge
    if (node.isStatic) {
      const staticBadge = document.createElement('span');
      staticBadge.className = 'method-static';
      staticBadge.textContent = 'static';
      staticBadge.style.fontSize = '10px';
      staticBadge.style.color = '#fff';
      staticBadge.style.backgroundColor = '#3498db';
      staticBadge.style.padding = '1px 4px';
      staticBadge.style.borderRadius = '3px';
      badges.appendChild(staticBadge);
    }

    // Constructor badge
    if (node.isConstructor) {
      const constructorBadge = document.createElement('span');
      constructorBadge.className = 'method-constructor';
      constructorBadge.textContent = 'constructor';
      constructorBadge.style.fontSize = '10px';
      constructorBadge.style.color = '#fff';
      constructorBadge.style.backgroundColor = '#9b59b6';
      constructorBadge.style.padding = '1px 4px';
      constructorBadge.style.borderRadius = '3px';
      badges.appendChild(constructorBadge);
    }

    // Async badge
    if (node.isAsync) {
      const asyncBadge = document.createElement('span');
      asyncBadge.className = 'method-async';
      asyncBadge.textContent = 'async';
      asyncBadge.style.fontSize = '10px';
      asyncBadge.style.color = '#fff';
      asyncBadge.style.backgroundColor = '#7b1fa2';
      asyncBadge.style.padding = '1px 4px';
      asyncBadge.style.borderRadius = '3px';
      badges.appendChild(asyncBadge);
    }

    // Getter/Setter badge
    if (node.isGetter || node.isSetter) {
      const accessorBadge = document.createElement('span');
      accessorBadge.className = 'method-accessor';
      accessorBadge.textContent = node.isGetter ? 'get' : 'set';
      accessorBadge.style.fontSize = '10px';
      accessorBadge.style.color = '#fff';
      accessorBadge.style.backgroundColor = '#e67e22';
      accessorBadge.style.padding = '1px 4px';
      accessorBadge.style.borderRadius = '3px';
      badges.appendChild(accessorBadge);
    }

    content.appendChild(badges);

    // Show parameter count
    const params = node.parameters || [];
    const paramCount = params.filter(p => {
      const name = typeof p === 'object' ? (p.name || p.title) : String(p).split('=')[0].trim();
      return name !== 'this' && name !== 'self';
    }).length;

    if (paramCount > 0) {
      const paramsEl = document.createElement('div');
      paramsEl.className = 'method-params';
      paramsEl.textContent = `(${paramCount} param${paramCount !== 1 ? 's' : ''})`;
      paramsEl.style.fontSize = '11px';
      paramsEl.style.color = '#5c9ce6';
      paramsEl.style.fontFamily = 'monospace';
      content.appendChild(paramsEl);
    }

    // Show return type if specified
    if (node.returnType && node.returnType !== 'void' && !node.isConstructor) {
      const returnType = document.createElement('div');
      returnType.className = 'method-return-type';
      returnType.textContent = `→ ${node.returnType}`;
      returnType.style.fontSize = '11px';
      returnType.style.color = '#888';
      returnType.style.fontFamily = 'monospace';
      content.appendChild(returnType);
    }

    // Show parent class reference if available
    if (node.className) {
      const classRef = document.createElement('div');
      classRef.className = 'method-class-ref';
      classRef.textContent = `↑ ${node.className}`;
      classRef.style.fontSize = '10px';
      classRef.style.color = '#666';
      classRef.style.marginTop = '2px';
      classRef.style.fontStyle = 'italic';
      content.appendChild(classRef);
    }

    container.appendChild(content);
  }

  // =========================================================================
  // Node Factory
  // =========================================================================

  /**
   * Create a method node with proper defaults.
   *
   * @param {Object} options - Method options
   * @returns {Object} Node configuration
   */
  static createNode(options = {}) {
    return {
      type: 'method',
      title: options.name || options.title || 'method',
      visibility: options.visibility || 'public',
      isStatic: options.isStatic || false,
      isConstructor: options.isConstructor || false,
      isAsync: options.isAsync || false,
      isGetter: options.isGetter || false,
      isSetter: options.isSetter || false,
      parameters: options.parameters || [],
      returnType: options.returnType || null,
      className: options.className || null,
      ...options
    };
  }
}

// Export as object for backwards compatibility
export const MethodNodeType = MethodNode;
