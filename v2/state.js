// Application state management
export const state = {
  nodes: [],
  path: []
};

export function save() {
  localStorage.setItem('mindmap', JSON.stringify(state.nodes));
}

export function load() {
  const saved = localStorage.getItem('mindmap');
  if (saved) {
    try {
      state.nodes = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved mindmap:', e);
      state.nodes = [];
    }
  }
}

export function getCurrentNodes() {
  return state.path.reduce(
    (a, id) => a.find(n => n.id === id)?.children ?? a,
    state.nodes
  );
} 