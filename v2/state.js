// Application state management
export const state = {
  nodes: [],
  path: []
};

export function save() {
  // Custom replacer to exclude non-serializable properties
  const replacer = (key, value) => {
    // Exclude fileObject (File object can't be serialized)
    // Exclude parent (creates circular reference, use parentId instead)
    if (key === 'fileObject' || key === 'parent') {
      return undefined;
    }
    return value;
  };
  localStorage.setItem('mindmap', JSON.stringify(state.nodes, replacer));
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