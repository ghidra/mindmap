/**
 * Details Panel - Type-aware node details and properties
 * Adapts UI based on selected node type
 */

import { state, findNode, save } from '../state.js';
import { nodeTypeRegistry } from '../node-types/NodeTypeRegistry.js';
import { portSystem } from '../core/PortSystem.js';
import { groupManager } from '../core/GroupManager.js';

export class DetailsPanel {
  constructor() {
    this.panel = null;
    this.currentNodeId = null;
  }

  /**
   * Initialize the details panel
   */
  init() {
    this.panel = document.getElementById('attributes-panel');
    if (!this.panel) {
      console.warn('Details panel element not found');
      return;
    }

    // Setup close button
    const closeBtn = this.panel.querySelector('#close-attributes');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    console.log('DetailsPanel initialized');
  }

  /**
   * Show details for a node
   * @param {string} nodeId - Node ID
   */
  show(nodeId) {
    const node = findNode(nodeId);
    if (!node) {
      console.warn(`Node ${nodeId} not found`);
      return;
    }

    this.currentNodeId = nodeId;
    this.panel.classList.add('visible');

    // Render panel content based on node type
    this.render(node);
  }

  /**
   * Hide the details panel
   */
  hide() {
    this.panel.classList.remove('visible');
    this.currentNodeId = null;
  }

  /**
   * Render panel content
   * @param {Object} node - Node to display
   */
  render(node) {
    const typeDef = nodeTypeRegistry.get(node.type);
    const container = this.panel.querySelector('#attributes-list');

    container.innerHTML = '';

    // Node header with icon and type
    const header = document.createElement('div');
    header.className = 'details-header';
    header.innerHTML = `
      <div class="details-icon">${typeDef?.icon || '📄'}</div>
      <div class="details-title">
        <div class="details-node-type">${typeDef?.name || node.type}</div>
        <div class="details-node-title">${node.title}</div>
      </div>
    `;
    container.appendChild(header);

    // Basic properties section
    this.renderBasicProperties(node, container);

    // Port information (read-only since ports are fixed)
    if (node.ports && node.ports.length > 0) {
      this.renderPorts(node, container);
    }

    // Group membership
    this.renderGroupMembership(node, container);

    // Type-specific properties
    this.renderTypeSpecific(node, typeDef, container);

    // Style overrides
    this.renderStyleOverrides(node, container);

    // Attributes (if node supports them)
    if (typeDef?.features?.canHaveAttributes) {
      this.renderAttributes(node, container);
    }
  }

  /**
   * Render basic properties
   */
  renderBasicProperties(node, container) {
    const section = this.createSection('Basic Properties');

    // Node ID (read-only)
    section.appendChild(this.createReadOnlyField('ID', node.id));

    // Position
    const x = node.position?.x ?? node.x ?? 0;
    const y = node.position?.y ?? node.y ?? 0;
    section.appendChild(this.createReadOnlyField('Position', `X: ${Math.round(x)}, Y: ${Math.round(y)}`));

    // Size
    const width = node.size?.width ?? node.width ?? 180;
    const height = node.size?.height ?? node.height ?? 100;
    section.appendChild(this.createReadOnlyField('Size', `${Math.round(width)} × ${Math.round(height)}`));

    container.appendChild(section);

    // Show full path in flow mode
    if (state.currentMode === 'flow') {
      const fullPath = this.getNodeFullPath(node);
      if (fullPath) {
        const pathSection = this.createSection('File Path');
        pathSection.appendChild(this.createReadOnlyField('Path', fullPath));
        container.appendChild(pathSection);
      }
    }
  }

  /**
   * Get full file path for a node by traversing parents
   */
  getNodeFullPath(node) {
    // If node has filePath, use it directly
    if (node.filePath) {
      return node.filePath;
    }

    // Build path by traversing parent hierarchy
    const pathParts = [];
    let current = node;

    while (current) {
      if (current.title) {
        pathParts.unshift(current.title);
      }
      // Find parent node
      if (current.parentId) {
        current = findNode(current.parentId);
      } else if (current.parent) {
        current = current.parent;
      } else {
        break;
      }
    }

    return pathParts.length > 0 ? pathParts.join('/') : null;
  }

  /**
   * Render port information
   */
  renderPorts(node, container) {
    const section = this.createSection('Ports (Fixed)');

    node.ports.forEach(port => {
      const portItem = document.createElement('div');
      portItem.className = 'port-item';
      portItem.innerHTML = `
        <div class="port-info">
          <span class="port-label-text">${port.label || port.id}</span>
          <span class="port-side-badge">${port.side}</span>
          <span class="port-type-badge port-type-${port.type}">${port.type}</span>
        </div>
      `;
      section.appendChild(portItem);
    });

    container.appendChild(section);
  }

  /**
   * Render group membership information
   */
  renderGroupMembership(node, container) {
    // If node is a group
    if (node.type === 'group') {
      const section = this.createSection('Group Contents');
      const count = node.containedNodes?.length || 0;

      const info = document.createElement('div');
      info.className = 'group-info';
      info.innerHTML = `
        <div class="info-row">
          <span>Contains:</span>
          <span><strong>${count}</strong> node${count !== 1 ? 's' : ''}</span>
        </div>
      `;

      if (count > 0) {
        const nodesList = document.createElement('ul');
        nodesList.className = 'contained-nodes-list';

        node.containedNodes.forEach(nodeId => {
          const containedNode = findNode(nodeId);
          if (containedNode) {
            const li = document.createElement('li');
            li.textContent = containedNode.title;
            nodesList.appendChild(li);
          }
        });

        info.appendChild(nodesList);
      }

      section.appendChild(info);
      container.appendChild(section);
    }

    // If node is inside a group
    if (node.containedIn) {
      const group = findNode(node.containedIn);
      if (group) {
        const section = this.createSection('Group Membership');

        const info = document.createElement('div');
        info.className = 'group-membership-info';
        info.innerHTML = `
          <div class="info-row">
            <span>Inside group:</span>
            <span><strong>${group.title}</strong></span>
          </div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'small-btn';
        removeBtn.textContent = 'Remove from group';
        removeBtn.onclick = () => {
          groupManager.removeNodeFromGroup(node.containedIn, node.id);
          save();
          this.render(node);
        };

        info.appendChild(removeBtn);
        section.appendChild(info);
        container.appendChild(section);
      }
    }
  }

  /**
   * Render type-specific properties
   */
  renderTypeSpecific(node, typeDef, container) {
    if (!typeDef) return;

    // Text label nodes - show text styling options
    if (node.type === 'text') {
      const section = this.createSection('Text Styling');

      // Font size
      const fontSizeRow = document.createElement('div');
      fontSizeRow.className = 'details-field';
      fontSizeRow.innerHTML = `<span class="field-label">Font Size:</span>`;
      const fontSizeInput = document.createElement('input');
      fontSizeInput.type = 'number';
      fontSizeInput.min = '8';
      fontSizeInput.max = '72';
      fontSizeInput.value = node.fontSize || 16;
      fontSizeInput.style.width = '60px';
      fontSizeInput.onchange = (e) => {
        node.fontSize = parseInt(e.target.value) || 16;
        save();
        this.triggerRender();
      };
      fontSizeRow.appendChild(fontSizeInput);
      const pxLabel = document.createElement('span');
      pxLabel.textContent = ' px';
      pxLabel.style.marginLeft = '4px';
      fontSizeRow.appendChild(pxLabel);
      section.appendChild(fontSizeRow);

      // Text color
      const textColorInput = this.createColorInput(
        'Text Color',
        node.textColor || '#ffffff',
        (value) => {
          node.textColor = value;
          save();
          this.triggerRender();
        }
      );
      section.appendChild(textColorInput);

      // Bold checkbox
      const boldRow = document.createElement('div');
      boldRow.className = 'details-field';
      const boldLabel = document.createElement('label');
      boldLabel.style.display = 'flex';
      boldLabel.style.alignItems = 'center';
      boldLabel.style.gap = '8px';
      boldLabel.style.cursor = 'pointer';
      const boldCheckbox = document.createElement('input');
      boldCheckbox.type = 'checkbox';
      boldCheckbox.checked = node.bold || false;
      boldCheckbox.onchange = (e) => {
        node.bold = e.target.checked;
        save();
        this.triggerRender();
      };
      boldLabel.appendChild(boldCheckbox);
      boldLabel.appendChild(document.createTextNode('Bold'));
      boldRow.appendChild(boldLabel);
      section.appendChild(boldRow);

      // Italic checkbox
      const italicRow = document.createElement('div');
      italicRow.className = 'details-field';
      const italicLabel = document.createElement('label');
      italicLabel.style.display = 'flex';
      italicLabel.style.alignItems = 'center';
      italicLabel.style.gap = '8px';
      italicLabel.style.cursor = 'pointer';
      const italicCheckbox = document.createElement('input');
      italicCheckbox.type = 'checkbox';
      italicCheckbox.checked = node.italic || false;
      italicCheckbox.onchange = (e) => {
        node.italic = e.target.checked;
        save();
        this.triggerRender();
      };
      italicLabel.appendChild(italicCheckbox);
      italicLabel.appendChild(document.createTextNode('Italic'));
      italicRow.appendChild(italicLabel);
      section.appendChild(italicRow);

      container.appendChild(section);
    }

    // File nodes
    if (node.type === 'file' && node.filePath) {
      const section = this.createSection('File Info');
      section.appendChild(this.createReadOnlyField('Path', node.filePath));
      if (node.children?.length) {
        section.appendChild(this.createReadOnlyField('Items', node.children.length));
      }
      container.appendChild(section);
    }

    // Function nodes
    if (node.type === 'function') {
      const section = this.createSection('Function Info');
      if (node.isAsync) {
        section.appendChild(this.createReadOnlyField('Type', 'Async'));
      }
      if (node.parameters) {
        section.appendChild(this.createReadOnlyField('Parameters', node.parameters.length));
      }
      if (node.returnType) {
        section.appendChild(this.createReadOnlyField('Returns', node.returnType));
      }
      container.appendChild(section);
    }

    // Class nodes
    if (node.type === 'class') {
      const section = this.createSection('Class Info');
      if (node.hasConstructor) {
        section.appendChild(this.createReadOnlyField('Constructor', 'Yes'));
      }
      if (node.children) {
        const methods = node.children.filter(c => c.type === 'method' || c.type === 'function');
        const properties = node.children.filter(c => c.type === 'property');

        if (methods.length) {
          section.appendChild(this.createReadOnlyField('Methods', methods.length));
        }
        if (properties.length) {
          section.appendChild(this.createReadOnlyField('Properties', properties.length));
        }
      }
      container.appendChild(section);
    }
  }

  /**
   * Render style overrides
   */
  renderStyleOverrides(node, container) {
    const section = this.createSection('Appearance');

    // Background color
    const colorInput = this.createColorInput(
      'Background Color',
      node.style?.color || '#ffffff',
      (value) => {
        if (!node.style) node.style = {};
        node.style.color = value;
        save();
      }
    );
    section.appendChild(colorInput);

    // Border color
    const borderColorInput = this.createColorInput(
      'Border Color',
      node.style?.borderColor || '#cccccc',
      (value) => {
        if (!node.style) node.style = {};
        node.style.borderColor = value;
        save();
      }
    );
    section.appendChild(borderColorInput);

    container.appendChild(section);
  }

  /**
   * Render attributes section
   */
  renderAttributes(node, container) {
    const section = this.createSection('Attributes');

    if (node.attributes && typeof node.attributes === 'object') {
      const entries = Object.entries(node.attributes);

      if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No attributes';
        section.appendChild(empty);
      } else {
        entries.forEach(([key, value]) => {
          const attrRow = document.createElement('div');
          attrRow.className = 'attribute-row';

          const label = document.createElement('span');
          label.className = 'attribute-label';
          label.textContent = key + ':';

          const input = document.createElement('input');
          input.type = 'text';
          input.value = value;
          input.onchange = (e) => {
            node.attributes[key] = e.target.value;
            save();
          };

          const removeBtn = document.createElement('button');
          removeBtn.className = 'icon-btn';
          removeBtn.textContent = '×';
          removeBtn.onclick = () => {
            delete node.attributes[key];
            save();
            this.render(node);
          };

          attrRow.appendChild(label);
          attrRow.appendChild(input);
          attrRow.appendChild(removeBtn);
          section.appendChild(attrRow);
        });
      }
    }

    // Add attribute button
    const addBtn = document.createElement('button');
    addBtn.className = 'small-btn';
    addBtn.textContent = '+ Add Attribute';
    addBtn.onclick = () => this.showAddAttributeDialog(node);
    section.appendChild(addBtn);

    container.appendChild(section);
  }

  /**
   * Show add attribute dialog
   */
  showAddAttributeDialog(node) {
    const name = prompt('Attribute name:');
    if (!name) return;

    const value = prompt('Attribute value:');
    if (value === null) return;

    if (!node.attributes) {
      node.attributes = {};
    }

    node.attributes[name] = value;
    save();
    this.render(node);
  }

  /**
   * Create a section element
   */
  createSection(title) {
    const section = document.createElement('div');
    section.className = 'details-section';

    const header = document.createElement('h3');
    header.textContent = title;
    section.appendChild(header);

    return section;
  }

  /**
   * Create a read-only field
   */
  createReadOnlyField(label, value) {
    const field = document.createElement('div');
    field.className = 'details-field';
    field.innerHTML = `
      <span class="field-label">${label}:</span>
      <span class="field-value">${value}</span>
    `;
    return field;
  }

  /**
   * Create a color input
   */
  createColorInput(label, initialValue, onChange) {
    const field = document.createElement('div');
    field.className = 'details-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'field-label';
    labelEl.textContent = label + ':';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = initialValue;
    input.onchange = (e) => onChange(e.target.value);

    field.appendChild(labelEl);
    field.appendChild(input);

    return field;
  }

  /**
   * Refresh the current panel (if open)
   */
  refresh() {
    if (this.currentNodeId) {
      const node = findNode(this.currentNodeId);
      if (node) {
        this.render(node);
      } else {
        this.hide();
      }
    }
  }

  /**
   * Set render callback for triggering canvas re-render
   * @param {Function} callback
   */
  setRenderCallback(callback) {
    this.onRenderNeeded = callback;
  }

  /**
   * Trigger a canvas re-render
   */
  triggerRender() {
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }
}

// Create singleton instance
export const detailsPanel = new DetailsPanel();
