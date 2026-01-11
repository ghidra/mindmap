/**
 * Function Node - Represents a function or method
 * Can have attributes for parameters
 */

import { BaseNodeType } from '../BaseNodeType.js';

export const FunctionNodeType = {
  id: 'function',
  name: 'Function',
  category: 'code',
  icon: '⚡',
  defaultPorts: [
    {
      id: 'params',
      side: 'left',
      type: 'input',
      position: 0.5,
      label: 'params'
    },
    {
      id: 'return',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'return'
    }
  ],
  defaultStyle: {
    width: 180,
    height: 100,
    color: '#3a2847',
    borderColor: '#ba68c8',
    borderWidth: 2,
    borderRadius: 4
  },
  features: {
    canHaveChildren: false,      // Functions typically don't have hierarchical children
    canHaveAttributes: true,     // Can have parameters as attributes
    canResize: false,
    canContainNodes: false
  },
  renderContent: (node, container) => {
    const content = document.createElement('div');
    content.className = 'function-node-content';

    // Show parameter count
    if (node.parameters || (node.attributes && Object.keys(node.attributes).length > 0)) {
      const paramCount = node.parameters?.length || Object.keys(node.attributes).length;

      const params = document.createElement('div');
      params.className = 'function-params';
      params.textContent = `(${paramCount} param${paramCount !== 1 ? 's' : ''})`;
      params.style.fontSize = '11px';
      params.style.color = '#7b1fa2';
      params.style.marginTop = '4px';
      params.style.fontFamily = 'monospace';
      content.appendChild(params);
    }

    // Show async indicator
    if (node.isAsync) {
      const asyncLabel = document.createElement('div');
      asyncLabel.className = 'function-async';
      asyncLabel.textContent = 'async';
      asyncLabel.style.fontSize = '10px';
      asyncLabel.style.color = '#fff';
      asyncLabel.style.backgroundColor = '#7b1fa2';
      asyncLabel.style.padding = '2px 6px';
      asyncLabel.style.borderRadius = '3px';
      asyncLabel.style.display = 'inline-block';
      asyncLabel.style.marginTop = '4px';
      content.appendChild(asyncLabel);
    }

    // Show return type if specified
    if (node.returnType) {
      const returnType = document.createElement('div');
      returnType.className = 'function-return-type';
      returnType.textContent = `→ ${node.returnType}`;
      returnType.style.fontSize = '11px';
      returnType.style.color = '#666';
      returnType.style.marginTop = '4px';
      returnType.style.fontFamily = 'monospace';
      content.appendChild(returnType);
    }

    container.appendChild(content);
  }
};
