// Initialize mind map after core/render/handlers have loaded
window.addEventListener('DOMContentLoaded', () => {
  load();
  render();
  wireEvents();
});