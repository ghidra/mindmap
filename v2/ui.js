import { state } from './state.js';

const breadcrumbEl = document.getElementById('breadcrumb');

export function updateBreadcrumb(onNavigate) {
  breadcrumbEl.style.display = '';
  breadcrumbEl.innerHTML = '';

  const rootBtn = document.createElement('button');
  rootBtn.textContent = state.currentMode === 'flow' ? 'Flow Root' : 'Root';
  rootBtn.onclick = () => {
    state.path = [];
    onNavigate();
  };
  breadcrumbEl.appendChild(rootBtn);

  // Build breadcrumb trail based on current mode
  if (state.currentMode === 'flow' && state.flowConfig.executionGraph) {
    // In flow mode, walk through execution graph nodes
    const allFlowNodes = state.flowConfig.executionGraph.nodes.map(gn => gn.originalNode);
    let walker = allFlowNodes;

    state.path.forEach((id, idx) => {
      const n = walker.find(nn => nn.id === id);
      if (!n) return;
      walker = n.children;
      const btn = document.createElement('button');
      btn.textContent = ' > ' + n.title;
      btn.onclick = () => {
        state.path = state.path.slice(0, idx + 1);
        onNavigate();
      };
      breadcrumbEl.appendChild(btn);
    });
  } else {
    // In hierarchical mode, walk through state.nodes
    let walker = state.nodes;
    state.path.forEach((id, idx) => {
      const n = walker.find(nn => nn.id === id);
      if (!n) return;
      walker = n.children;
      const btn = document.createElement('button');
      btn.textContent = ' > ' + n.title;
      btn.onclick = () => {
        state.path = state.path.slice(0, idx + 1);
        onNavigate();
      };
      breadcrumbEl.appendChild(btn);
    });
  }
} 