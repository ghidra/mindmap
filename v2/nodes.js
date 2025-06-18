import { state, save, getCurrentNodes } from './state.js';
import { ATTRIBUTE_TYPES, updateAttributeValue, removeAttributeFromNode } from './attributes.js';
import { refreshAttributesPanel } from './attributes-panel.js';

const canvas = document.getElementById('canvas');

export function createNode(x, y, title = 'New Node') {
  return {
    id: Date.now().toString(36),
    x,
    y,
    title,
    color: '#ffffff',
    expanded: true,
    attributesExpanded: false,
    connections: [],
    children: [],
    attributes: []
  };
}

export function renderNodes(onRender, onSelectNode) {
  const nodes = getCurrentNodes();
  
  canvas.innerHTML = '';

  nodes.forEach(n => {
    const el = document.createElement('div');
    el.dataset.id = n.id;
    el.className = 'node';
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.backgroundColor = n.color || '#ffffff';

    // Add drag-to-connect handle
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.dataset.nodeId = n.id;
    el.appendChild(handle);

    // Add title input
    const input = document.createElement('input');
    input.name = 'title_' + n.id;
    input.value = n.title;
    input.oninput = e => { n.title = e.target.value; save(); };
    el.appendChild(input);

    // Add examine button
    const examineBtn = document.createElement('button');
    examineBtn.textContent = 'Examine';
    examineBtn.className = n.children.length ? '' : 'hidden';
    examineBtn.onclick = e => {
      e.stopPropagation();
      state.path.push(n.id);
      onRender();
    };
    el.appendChild(examineBtn);

    // Add expand/collapse toggle for children
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = n.expanded ? '−' : '+';
    toggleBtn.className = n.children.length ? '' : 'hidden';
    toggleBtn.onclick = e => {
      e.stopPropagation();
      n.expanded = !n.expanded;
      onRender();
    };
    el.appendChild(toggleBtn);

    // Add attributes toggle button
    const attrToggleBtn = document.createElement('button');
    attrToggleBtn.textContent = n.attributesExpanded ? '−' : '+';
    attrToggleBtn.className = 'attr-toggle';
    attrToggleBtn.title = 'Toggle Attributes';
    attrToggleBtn.onclick = e => {
      e.stopPropagation();
      n.attributesExpanded = !n.attributesExpanded;
      onRender();
    };
    el.appendChild(attrToggleBtn);

    // Show children inline if expanded
    if (n.expanded && n.children.length) {
      const list = document.createElement('ul');
      list.className = 'child-list';
      n.children.forEach((child, i) => {
        const li = document.createElement('li');
        li.textContent = child.title;

        const rm = document.createElement('button');
        rm.textContent = 'x';
        rm.onclick = e => {
          e.stopPropagation();
          n.children.splice(i, 1);
          onRender();
        };
        li.appendChild(rm);

        list.appendChild(li);
      });
      el.appendChild(list);
    }

    // Show attributes inline if expanded
    if (n.attributesExpanded && n.attributes && n.attributes.length > 0) {
      const attrList = document.createElement('div');
      attrList.className = 'attributes-list';
      n.attributes.forEach(attribute => {
        const attrItem = document.createElement('div');
        attrItem.className = 'node-attribute-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'attr-name';
        nameSpan.textContent = attribute.name + ':';
        
        const valueInput = document.createElement('input');
        valueInput.className = 'attr-value';
        valueInput.type = attribute.type === ATTRIBUTE_TYPES.INTEGER || attribute.type === ATTRIBUTE_TYPES.FLOAT ? 'number' : 'text';
        valueInput.step = attribute.type === ATTRIBUTE_TYPES.FLOAT ? '0.1' : '1';
        valueInput.value = attribute.value;
        valueInput.onchange = e => {
          updateAttributeValue(n, attribute.id, e.target.value);
          save();
          refreshAttributesPanel();
        };
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-attr';
        removeBtn.textContent = '×';
        removeBtn.onclick = e => {
          e.stopPropagation();
          removeAttributeFromNode(n, attribute.id);
          save();
          refreshAttributesPanel();
          onRender();
        };
        
        attrItem.appendChild(nameSpan);
        attrItem.appendChild(valueInput);
        attrItem.appendChild(removeBtn);
        attrList.appendChild(attrItem);
      });
      el.appendChild(attrList);
    }

    canvas.appendChild(el);
  });
} 