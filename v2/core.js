const state = {
  nodes: [],
  path: []
};

function load() {
  state.nodes = JSON.parse(localStorage.getItem('mindmap') || '[]');
}

function save() {
  localStorage.setItem('mindmap', JSON.stringify(state.nodes));
}
