/**
 * Node Creator UI - Modal for creating nodes with port configuration
 * Provides user-friendly interface for node creation and customization
 */

import { nodeTypeRegistry } from '../node-types/NodeTypeRegistry.js';
import { state, addNode, save } from '../state.js';
import { BaseNodeType } from '../node-types/BaseNodeType.js';

export class NodeCreator {
  constructor() {
    this.modal = null;
    this.createPosition = { x: 0, y: 0 };
    this.selectedType = null;
    this.customPorts = [];
    this.onNodeCreated = null;
  }

  /**
   * Initialize the node creator UI
   */
  init() {
    this.createModal();
    console.log('NodeCreator initialized');
  }

  /**
   * Create the modal structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'node-creator-modal';
    this.modal.style.display = 'none';
    this.modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Node</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <!-- Node Type Selection -->
          <div class="form-section">
            <h3>Node Type</h3>
            <div id="node-type-categories"></div>
          </div>

          <!-- Node Properties -->
          <div class="form-section">
            <h3>Properties</h3>
            <div class="form-group">
              <label>Title:</label>
              <input type="text" id="node-title" placeholder="Node title" />
            </div>
            <div class="form-group">
              <label>Description:</label>
              <textarea id="node-description" placeholder="Optional description"></textarea>
            </div>
          </div>

          <!-- Port Configuration -->
          <div class="form-section">
            <h3>Ports</h3>
            <div id="port-preview" class="port-preview"></div>
            <button id="add-port-btn" class="secondary-btn">+ Add Custom Port</button>
            <div id="port-config" class="port-config"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancel-btn" class="secondary-btn">Cancel</button>
          <button id="create-btn" class="primary-btn">Create Node</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.attachEventListeners();
    this.renderTypeCategories();
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    // Close modal
    const closeBtn = this.modal.querySelector('.modal-close');
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    const backdrop = this.modal.querySelector('.modal-backdrop');

    closeBtn.onclick = () => this.hide();
    cancelBtn.onclick = () => this.hide();
    backdrop.onclick = () => this.hide();

    // Create node
    const createBtn = this.modal.querySelector('#create-btn');
    createBtn.onclick = () => this.createNode();

    // Add custom port
    const addPortBtn = this.modal.querySelector('#add-port-btn');
    addPortBtn.onclick = () => this.addCustomPort();
  }

  /**
   * Render node type categories
   */
  renderTypeCategories() {
    const container = this.modal.querySelector('#node-type-categories');
    const categories = nodeTypeRegistry.getCategories();

    container.innerHTML = '';

    categories.forEach(category => {
      const categorySection = document.createElement('div');
      categorySection.className = 'type-category';

      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categorySection.appendChild(categoryTitle);

      const typeGrid = document.createElement('div');
      typeGrid.className = 'type-grid';

      const types = nodeTypeRegistry.getByCategory(category);
      types.forEach(type => {
        const typeCard = document.createElement('div');
        typeCard.className = 'type-card';
        typeCard.dataset.typeId = type.id;
        typeCard.innerHTML = `
          <div class="type-icon">${type.icon}</div>
          <div class="type-name">${type.name}</div>
        `;

        typeCard.onclick = () => this.selectType(type.id);
        typeGrid.appendChild(typeCard);
      });

      categorySection.appendChild(typeGrid);
      container.appendChild(categorySection);
    });
  }

  /**
   * Select a node type
   * @param {string} typeId - Type identifier
   */
  selectType(typeId) {
    this.selectedType = typeId;

    // Update UI - highlight selected
    this.modal.querySelectorAll('.type-card').forEach(card => {
      card.classList.remove('selected');
    });

    const selectedCard = this.modal.querySelector(`[data-type-id="${typeId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    // Load default ports for this type
    const typeDef = nodeTypeRegistry.get(typeId);
    if (typeDef) {
      this.customPorts = JSON.parse(JSON.stringify(typeDef.defaultPorts || []));
      this.renderPortPreview();

      // Update title placeholder
      const titleInput = this.modal.querySelector('#node-title');
      titleInput.placeholder = typeDef.name;
    }
  }

  /**
   * Render port preview
   */
  renderPortPreview() {
    const container = this.modal.querySelector('#port-preview');
    container.innerHTML = '';

    if (this.customPorts.length === 0) {
      container.innerHTML = '<div class="port-preview-empty">No ports</div>';
      return;
    }

    const preview = document.createElement('div');
    preview.className = 'port-preview-box';

    this.customPorts.forEach((port, index) => {
      const portEl = document.createElement('div');
      portEl.className = `port-preview-item port-${port.side}`;
      portEl.innerHTML = `
        <span class="port-label">${port.label || port.id}</span>
        <span class="port-type">${port.type}</span>
        <button class="port-remove" data-index="${index}">×</button>
      `;

      const removeBtn = portEl.querySelector('.port-remove');
      removeBtn.onclick = () => this.removePort(index);

      preview.appendChild(portEl);
    });

    container.appendChild(preview);
  }

  /**
   * Add a custom port
   */
  addCustomPort() {
    const portConfig = {
      id: `port-${this.customPorts.length}`,
      side: 'right',
      type: 'output',
      position: 0.5,
      label: `Port ${this.customPorts.length + 1}`
    };

    // Show port configuration form
    this.showPortConfig(portConfig, (updatedPort) => {
      this.customPorts.push(updatedPort);
      this.renderPortPreview();
    });
  }

  /**
   * Remove a port
   * @param {number} index - Port index
   */
  removePort(index) {
    this.customPorts.splice(index, 1);
    this.renderPortPreview();
  }

  /**
   * Show port configuration form
   * @param {Object} portConfig - Initial port configuration
   * @param {Function} callback - Callback when port is configured
   */
  showPortConfig(portConfig, callback) {
    const container = this.modal.querySelector('#port-config');
    container.innerHTML = `
      <div class="port-config-form">
        <h4>Configure Port</h4>
        <div class="form-group">
          <label>Label:</label>
          <input type="text" id="port-label" value="${portConfig.label}" />
        </div>
        <div class="form-group">
          <label>Side:</label>
          <select id="port-side">
            <option value="left" ${portConfig.side === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${portConfig.side === 'right' ? 'selected' : ''}>Right</option>
            <option value="top" ${portConfig.side === 'top' ? 'selected' : ''}>Top</option>
            <option value="bottom" ${portConfig.side === 'bottom' ? 'selected' : ''}>Bottom</option>
          </select>
        </div>
        <div class="form-group">
          <label>Type:</label>
          <select id="port-type">
            <option value="input" ${portConfig.type === 'input' ? 'selected' : ''}>Input</option>
            <option value="output" ${portConfig.type === 'output' ? 'selected' : ''}>Output</option>
            <option value="bidirectional" ${portConfig.type === 'bidirectional' ? 'selected' : ''}>Bidirectional</option>
          </select>
        </div>
        <div class="form-group">
          <label>Position (0-1):</label>
          <input type="number" id="port-position" min="0" max="1" step="0.1" value="${portConfig.position}" />
        </div>
        <div class="form-actions">
          <button id="port-cancel" class="secondary-btn">Cancel</button>
          <button id="port-save" class="primary-btn">Add Port</button>
        </div>
      </div>
    `;

    container.style.display = 'block';

    const saveBtn = container.querySelector('#port-save');
    const cancelBtn = container.querySelector('#port-cancel');

    saveBtn.onclick = () => {
      const updatedPort = {
        ...portConfig,
        label: container.querySelector('#port-label').value,
        side: container.querySelector('#port-side').value,
        type: container.querySelector('#port-type').value,
        position: parseFloat(container.querySelector('#port-position').value)
      };

      callback(updatedPort);
      container.style.display = 'none';
      container.innerHTML = '';
    };

    cancelBtn.onclick = () => {
      container.style.display = 'none';
      container.innerHTML = '';
    };
  }

  /**
   * Create the node
   */
  createNode() {
    if (!this.selectedType) {
      alert('Please select a node type');
      return;
    }

    const typeDef = nodeTypeRegistry.get(this.selectedType);
    if (!typeDef) {
      alert('Invalid node type');
      return;
    }

    // Get form values
    const title = this.modal.querySelector('#node-title').value || typeDef.name;
    const description = this.modal.querySelector('#node-description').value;

    // Create node using BaseNodeType
    const baseType = new BaseNodeType(typeDef);
    const node = baseType.createInstance({
      position: this.createPosition,
      title,
      description,
      ports: this.customPorts.length > 0 ? this.customPorts : undefined
    });

    // Add to state
    addNode(node);
    save();

    // Trigger callback
    if (this.onNodeCreated) {
      this.onNodeCreated(node);
    }

    // Close modal
    this.hide();
  }

  /**
   * Show the node creator modal
   * @param {number} x - X position for new node
   * @param {number} y - Y position for new node
   * @param {Function} callback - Callback when node is created
   */
  show(x, y, callback) {
    this.createPosition = { x, y };
    this.onNodeCreated = callback;
    this.selectedType = null;
    this.customPorts = [];

    // Reset form
    this.modal.querySelector('#node-title').value = '';
    this.modal.querySelector('#node-description').value = '';
    this.modal.querySelector('#port-config').innerHTML = '';
    this.renderPortPreview();

    // Clear selection
    this.modal.querySelectorAll('.type-card').forEach(card => {
      card.classList.remove('selected');
    });

    this.modal.style.display = 'flex';
  }

  /**
   * Hide the modal
   */
  hide() {
    this.modal.style.display = 'none';
  }
}

// Create singleton instance
export const nodeCreator = new NodeCreator();
