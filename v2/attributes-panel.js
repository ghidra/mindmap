import { getCurrentNodes } from './state.js';
import { save } from './state.js';
import { ATTRIBUTE_TYPES, addAttributeToNode, removeAttributeFromNode, updateAttributeValue } from './attributes.js';
import { createNode } from './nodes.js';
import { 
  getTerminalNode, 
  isTerminalNode, 
  getTerminalNodeAttributes, 
  addTerminalAttribute, 
  removeTerminalAttribute, 
  updateTerminalAttributeValue 
} from './terminal-nodes.js';

const panel = document.getElementById('attributes-panel');
const attributesList = document.getElementById('attributes-list');
const addAttributeForm = document.getElementById('add-attribute-form');
const attributeNameInput = document.getElementById('attribute-name');
const attributeTypeSelect = document.getElementById('attribute-type');
const attributeValueInput = document.getElementById('attribute-value');

let selectedNodeId = null;
let onNodeRender = null;

export function showAttributesPanel() {
  panel.style.display = 'block';
}

export function hideAttributesPanel() {
  panel.style.display = 'none';
  selectedNodeId = null;
}

export function selectNode(nodeId) {
  selectedNodeId = nodeId;
  showAttributesPanel();
  renderNodeInfo();
  renderAttributes();
  renderChildren();
  renderColorPicker();
  renderTerminalNode();
}

export function refreshAttributesPanel() {
  if (selectedNodeId) {
    renderNodeInfo();
    renderAttributes();
    renderChildren();
    renderColorPicker();
    renderTerminalNode();
  }
}

export function initAttributesPanel(renderCallback) {
  onNodeRender = renderCallback;
  setupAddAttributeForm();
  setupTerminalAttributeForm();
  hideAttributesPanel();
}

function renderNodeInfo() {
  if (!selectedNodeId) return;
  
  const nodes = getCurrentNodes();
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  
  // Update panel header with node info
  const panelHeader = panel.querySelector('.panel-header');
  
  // Clear existing content except close button
  const closeBtn = panelHeader.querySelector('.close-btn');
  panelHeader.innerHTML = '';
  
  // Add title section
  const titleSection = document.createElement('div');
  titleSection.className = 'node-info';
  
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title:';
  titleLabel.className = 'node-label';
  
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = node.title;
  titleInput.className = 'node-title-input';
  titleInput.onchange = e => {
    node.title = e.target.value;
    save();
    if (onNodeRender) onNodeRender();
  };
  
  const idLabel = document.createElement('label');
  idLabel.textContent = 'ID:';
  idLabel.className = 'node-label';
  
  const idSpan = document.createElement('span');
  idSpan.textContent = node.id;
  idSpan.className = 'node-id';
  
  titleSection.appendChild(titleLabel);
  titleSection.appendChild(titleInput);
  titleSection.appendChild(idLabel);
  titleSection.appendChild(idSpan);
  
  panelHeader.appendChild(titleSection);
  panelHeader.appendChild(closeBtn);
}

function renderColorPicker() {
  if (!selectedNodeId) return;
  
  const nodes = getCurrentNodes();
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  
  // Find or create color picker section
  let colorSection = panel.querySelector('.color-section');
  if (!colorSection) {
    colorSection = document.createElement('div');
    colorSection.className = 'color-section';
    panel.insertBefore(colorSection, attributesList);
  }
  
  colorSection.innerHTML = '';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Node Color:';
  colorLabel.className = 'section-label';
  
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = node.color || '#ffffff';
  colorInput.className = 'color-picker';
  colorInput.onchange = e => {
    node.color = e.target.value;
    save();
    if (onNodeRender) onNodeRender();
  };
  
  colorSection.appendChild(colorLabel);
  colorSection.appendChild(colorInput);
}

function renderChildren() {
  if (!selectedNodeId) return;
  
  const nodes = getCurrentNodes();
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  
  // Find or create children section
  let childrenSection = panel.querySelector('.children-section');
  if (!childrenSection) {
    childrenSection = document.createElement('div');
    childrenSection.className = 'children-section';
    panel.insertBefore(childrenSection, addAttributeForm);
  }
  
  childrenSection.innerHTML = '';
  
  const childrenHeader = document.createElement('div');
  childrenHeader.className = 'section-header';
  
  const childrenLabel = document.createElement('label');
  childrenLabel.textContent = 'Children:';
  childrenLabel.className = 'section-label';
  
  const addChildBtn = document.createElement('button');
  addChildBtn.textContent = '+ Add Child';
  addChildBtn.className = 'add-child-btn';
  addChildBtn.onclick = () => {
    node.children.push(createNode(node.x + 40, node.y + 40));
    save();
    renderChildren();
    if (onNodeRender) onNodeRender();
  };
  
  childrenHeader.appendChild(childrenLabel);
  childrenHeader.appendChild(addChildBtn);
  childrenSection.appendChild(childrenHeader);
  
  // Filter out terminal nodes from children list
  const nonTerminalChildren = node.children ? node.children.filter(child => !isTerminalNode(child)) : [];
  
  if (nonTerminalChildren.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-children';
    emptyMessage.textContent = 'No children nodes.';
    childrenSection.appendChild(emptyMessage);
    return;
  }
  
  const childrenList = document.createElement('div');
  childrenList.className = 'children-list';
  
  nonTerminalChildren.forEach((child, index) => {
    const childItem = document.createElement('div');
    childItem.className = 'child-item';
    
    const childName = document.createElement('span');
    childName.className = 'child-name';
    childName.textContent = child.title;
    
    const removeChildBtn = document.createElement('button');
    removeChildBtn.textContent = '×';
    removeChildBtn.className = 'remove-child';
    removeChildBtn.onclick = () => {
      // Find the actual index in the original children array
      const actualIndex = node.children.findIndex(c => c.id === child.id);
      if (actualIndex !== -1) {
        node.children.splice(actualIndex, 1);
        save();
        renderChildren();
        if (onNodeRender) onNodeRender();
      }
    };
    
    childItem.appendChild(childName);
    childItem.appendChild(removeChildBtn);
    childrenList.appendChild(childItem);
  });
  
  childrenSection.appendChild(childrenList);
}

function renderTerminalNode() {
  // Find or create terminal node section
  let terminalSection = panel.querySelector('.terminal-section');
  if (!terminalSection) {
    terminalSection = document.createElement('div');
    terminalSection.className = 'terminal-section';
    // Position at the very bottom of the panel
    panel.appendChild(terminalSection);
  }
  
  // Ensure terminal section is at the very bottom
  if (terminalSection.parentNode) {
    terminalSection.parentNode.appendChild(terminalSection);
  }
  
  terminalSection.innerHTML = '';
  
  const terminalHeader = document.createElement('div');
  terminalHeader.className = 'section-header';
  
  const terminalLabel = document.createElement('label');
  terminalLabel.textContent = 'Level Attributes:';
  terminalLabel.className = 'section-label';
  terminalLabel.title = 'Attributes that apply to this entire level';
  
  const addTerminalAttrBtn = document.createElement('button');
  addTerminalAttrBtn.textContent = '+ Add Level Attr';
  addTerminalAttrBtn.className = 'add-terminal-attr-btn';
  addTerminalAttrBtn.onclick = () => {
    // Show terminal attribute form
    const terminalForm = panel.querySelector('#add-terminal-attribute-form');
    if (terminalForm) {
      terminalForm.style.display = 'block';
    }
  };
  
  terminalHeader.appendChild(terminalLabel);
  terminalHeader.appendChild(addTerminalAttrBtn);
  terminalSection.appendChild(terminalHeader);
  
  const terminalAttributes = getTerminalNodeAttributes();
  
  if (!terminalAttributes || terminalAttributes.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-terminal-attributes';
    emptyMessage.textContent = 'No level attributes defined.';
    terminalSection.appendChild(emptyMessage);
    return;
  }
  
  const terminalList = document.createElement('div');
  terminalList.className = 'terminal-attributes-list';
  
  terminalAttributes.forEach(attribute => {
    const attrItem = document.createElement('div');
    attrItem.className = 'terminal-attribute-item';
    
    const nameEl = document.createElement('div');
    nameEl.className = 'attribute-name';
    nameEl.textContent = attribute.name;
    
    const typeEl = document.createElement('div');
    typeEl.className = 'attribute-type';
    typeEl.textContent = attribute.type;
    
    const valueEl = document.createElement('input');
    valueEl.className = 'attribute-value';
    valueEl.type = attribute.type === ATTRIBUTE_TYPES.INTEGER || attribute.type === ATTRIBUTE_TYPES.FLOAT ? 'number' : 'text';
    valueEl.step = attribute.type === ATTRIBUTE_TYPES.FLOAT ? '0.1' : '1';
    valueEl.value = attribute.value;
    valueEl.onchange = e => {
      updateTerminalAttributeValue(attribute.id, e.target.value);
      save();
    };
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-attribute';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
      removeTerminalAttribute(attribute.id);
      save();
      renderTerminalNode();
    };
    
    attrItem.appendChild(nameEl);
    attrItem.appendChild(typeEl);
    attrItem.appendChild(valueEl);
    attrItem.appendChild(removeBtn);
    
    terminalList.appendChild(attrItem);
  });
  
  terminalSection.appendChild(terminalList);
}

function renderAttributes() {
  if (!selectedNodeId) return;
  
  const nodes = getCurrentNodes();
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  
  // Clear existing attributes
  attributesList.innerHTML = '';
  
  if (!node.attributes || node.attributes.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-attributes';
    emptyMessage.textContent = 'No attributes defined for this node.';
    attributesList.appendChild(emptyMessage);
    return;
  }
  
  // Render each attribute
  node.attributes.forEach(attribute => {
    const attributeEl = document.createElement('div');
    attributeEl.className = 'attribute-item';
    attributeEl.dataset.attributeId = attribute.id;
    
    const nameEl = document.createElement('div');
    nameEl.className = 'attribute-name';
    nameEl.textContent = attribute.name;
    
    const typeEl = document.createElement('div');
    typeEl.className = 'attribute-type';
    typeEl.textContent = attribute.type;
    
    const valueEl = document.createElement('input');
    valueEl.className = 'attribute-value';
    valueEl.type = attribute.type === ATTRIBUTE_TYPES.INTEGER || attribute.type === ATTRIBUTE_TYPES.FLOAT ? 'number' : 'text';
    valueEl.step = attribute.type === ATTRIBUTE_TYPES.FLOAT ? '0.1' : '1';
    valueEl.value = attribute.value;
    valueEl.onchange = e => {
      updateAttributeValue(node, attribute.id, e.target.value);
      save();
    };
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-attribute';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
      removeAttributeFromNode(node, attribute.id);
      save();
      renderAttributes();
      if (onNodeRender) onNodeRender();
    };
    
    attributeEl.appendChild(nameEl);
    attributeEl.appendChild(typeEl);
    attributeEl.appendChild(valueEl);
    attributeEl.appendChild(removeBtn);
    
    attributesList.appendChild(attributeEl);
  });
}

function setupAddAttributeForm() {
  addAttributeForm.onsubmit = e => {
    e.preventDefault();
    
    if (!selectedNodeId) return;
    
    const name = attributeNameInput.value.trim();
    const type = attributeTypeSelect.value;
    const value = attributeValueInput.value;
    
    if (!name) return;
    
    const nodes = getCurrentNodes();
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    
    addAttributeToNode(node, name, type, value);
    save();
    
    // Clear form
    attributeNameInput.value = '';
    attributeValueInput.value = '';
    attributeTypeSelect.value = ATTRIBUTE_TYPES.STRING;
    
    // Re-render attributes and trigger node re-render
    renderAttributes();
    if (onNodeRender) onNodeRender();
  };
}

function setupTerminalAttributeForm() {
  // Create terminal attribute form
  const terminalForm = document.createElement('form');
  terminalForm.id = 'add-terminal-attribute-form';
  terminalForm.className = 'terminal-attribute-form';
  terminalForm.style.display = 'none';
  
  const formTitle = document.createElement('h4');
  formTitle.textContent = 'Add Level Attribute';
  
  const nameRow = document.createElement('div');
  nameRow.className = 'form-row';
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Attribute name';
  nameInput.required = true;
  
  const typeSelect = document.createElement('select');
  typeSelect.innerHTML = `
    <option value="string">String</option>
    <option value="integer">Integer</option>
    <option value="float">Float</option>
  `;
  
  nameRow.appendChild(nameInput);
  nameRow.appendChild(typeSelect);
  
  const valueRow = document.createElement('div');
  valueRow.className = 'form-row';
  
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Value';
  
  const addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.textContent = 'Add';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    terminalForm.style.display = 'none';
    nameInput.value = '';
    valueInput.value = '';
    typeSelect.value = 'string';
  };
  
  valueRow.appendChild(valueInput);
  valueRow.appendChild(addBtn);
  valueRow.appendChild(cancelBtn);
  
  terminalForm.appendChild(formTitle);
  terminalForm.appendChild(nameRow);
  terminalForm.appendChild(valueRow);
  
  terminalForm.onsubmit = e => {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const value = valueInput.value;
    
    if (!name) return;
    
    addTerminalAttribute(name, type, value);
    save();
    
    // Clear form and hide it
    nameInput.value = '';
    valueInput.value = '';
    typeSelect.value = 'string';
    terminalForm.style.display = 'none';
    
    // Re-render terminal node
    renderTerminalNode();
  };
  
  panel.appendChild(terminalForm);
} 