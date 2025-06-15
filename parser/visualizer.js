function renderMindMap(parsedData) {
  const container = document.getElementById('mindMap');
  if (!container) return;

  container.innerHTML = '';

  const classMap = {};
  parsedData.forEach(file => {
    (file.classes || []).forEach(cls => {
      classMap[cls.name] = { ...cls, file: file.file, children: [] };
    });
  });

  Object.values(classMap).forEach(cls => {
    if (cls.parent && classMap[cls.parent]) {
      classMap[cls.parent].children.push(cls);
    }
  });

  const rootClasses = Object.values(classMap).filter(
    cls => !cls.parent || !classMap[cls.parent]
  );

  function renderClassTree(cls) {
    const hasChildren = cls.children.length > 0;
    const methodsHTML = (cls.methods || [])
      .map(m => `<li class="method">${m}()</li>`)
      .join('');

    return `
      <li>
        <div class="class-node ${hasChildren ? 'has-children' : ''}">
          <span class="toggle-btn">${hasChildren ? '▶' : ''}</span>
          <strong>${cls.name}</strong> <em>(${cls.file})</em>
        </div>
        ${methodsHTML ? `<ul class="method-list">${methodsHTML}</ul>` : ''}
        ${
          hasChildren
            ? `<ul class="child-list hidden">
                ${cls.children.map(renderClassTree).join('')}
               </ul>`
            : ''
        }
      </li>`;
  }

  const treeHTML = rootClasses.map(renderClassTree).join('');
  container.innerHTML = `
    <h2>Class Inheritance Map</h2>
    <ul class="class-tree">${treeHTML}</ul>
  `;

  // Setup toggling behavior
  container.querySelectorAll('.class-node.has-children').forEach(node => {
    node.addEventListener('click', () => {
      const childList = node.nextElementSibling?.nextElementSibling;
      if (childList && childList.classList.contains('child-list')) {
        childList.classList.toggle('hidden');
        const toggle = node.querySelector('.toggle-btn');
        if (toggle) {
          toggle.textContent = childList.classList.contains('hidden') ? '▶' : '▼';
        }
      }
    });
  });
}


/////

function renderClassGraph(parsedData) {
  const nodes = [];
const edges = [];
const addedNodeIds = new Set();

const sanitizeId = id => id.replace(/[^\w\-]/g, '_'); // make safe string

parsedData.forEach(file => {
  (file.classes || []).forEach(cls => {
    const nodeId = sanitizeId(cls.name);
    if (addedNodeIds.has(nodeId)) return;
    addedNodeIds.add(nodeId);

    nodes.push({
      id: nodeId,
      label: cls.name,
      title: `File: ${file.file}`,
      shape: 'box',
      color: '#97C2FC'
    });

    if (cls.parent) {
      edges.push({
        from: sanitizeId(cls.parent),
        to: nodeId,
        arrows: 'to'
      });
    }
  });
});


  // Remove orphaned parent edges
  const validEdges = edges.filter(e => classSet.has(e.from));

  const container = document.getElementById('classGraph');
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(validEdges) };

  const network = new vis.Network(container, data, {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed'
      }
    },
    edges: {
      smooth: true,
      arrows: { to: true }
    },
    physics: false
  });
}
