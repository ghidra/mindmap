import { state } from './state.js';

const breadcrumbEl = document.getElementById('breadcrumb');

export function updateBreadcrumb(onNavigate) {
  breadcrumbEl.innerHTML = '';
  const rootBtn = document.createElement('button');
  rootBtn.textContent = 'Root';
  rootBtn.onclick = () => { 
    state.path = []; 
    onNavigate(); 
  };
  breadcrumbEl.appendChild(rootBtn);

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