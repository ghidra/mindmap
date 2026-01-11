# Migration Guide: New Modular Node Framework

This guide explains how to migrate from the legacy mode-specific system to the new modular node framework.

## Overview

The new framework removes mode-specific logic and creates a unified system where:
- All nodes work in all views
- Connections use a single bezier-based system
- Rendering is modular and type-aware
- State management is simplified

## Integration Steps

### Step 1: Update main.js to Initialize New System

```javascript
// Import new modules
import { registerCoreNodeTypes } from './node-types/registerCoreTypes.js';
import { nodeRenderer } from './core/NodeRenderer.js';
import { connectionSystem } from './core/ConnectionSystem.js';
import { eventManager } from './core/EventManager.js';
import { nodeCreator } from './ui/NodeCreator.js';
import { detailsPanel } from './ui/DetailsPanel.js';

// Initialize systems
registerCoreNodeTypes();

const canvas = document.getElementById('canvas');
const svg = document.getElementById('connections');

// Initialize components
eventManager.init(canvas);
connectionSystem.init(svg);
nodeCreator.init();
detailsPanel.init();

// Set up render callback
eventManager.setRenderCallback(() => {
  renderNodes();
  connectionSystem.renderConnections();
});

eventManager.setSaveCallback(() => {
  save();
});

// Replace old render function
function renderNodes() {
  canvas.innerHTML = '';

  state.nodes.forEach(node => {
    nodeRenderer.render(node, canvas);
  });
}
```

### Step 2: Update index.html

Add CSS import for new UI components:

```html
<head>
  <link rel="stylesheet" href="v2/style.css" />
  <link rel="stylesheet" href="v2/ui/node-creator.css" />
</head>
```

### Step 3: Migrate Existing Nodes

Run migration function to convert legacy nodes to new format:

```javascript
import { migrateLegacyNodes } from './migration.js';

// On application load
migrateLegacyNodes();
```

### Step 4: Remove Legacy Files

Once migration is complete, these files can be removed:
- `handlers.js` (replaced by EventManager)
- `nodes.js` (replaced by nodes-new.js and NodeRenderer)
- `connections.js` (replaced by connections-new.js and ConnectionSystem)
- `attributes-panel.js` (replaced by DetailsPanel)

Keep these files for backward compatibility during transition:
- `state.js` (modified but maintained)
- `mode-manager.js` (will be deprecated in favor of view transformations)

## Key Differences

### Old System
```javascript
// Mode-specific rendering
if (state.currentMode === 'flow') {
  renderFlowMode();
} else if (state.currentMode === 'hierarchical') {
  renderHierarchicalMode();
}

// Connections in nodes
node.connections = ['node2', 'node3'];

// Direct DOM manipulation
const el = document.createElement('div');
el.onclick = () => { /* handler */ };
```

### New System
```javascript
// Unified rendering
nodeRenderer.render(node, container);

// Connections in state
state.connections = [
  { from: { nodeId: 'node1', portId: 'output' }, to: { nodeId: 'node2', portId: 'input' } }
];

// Event delegation
eventManager.init(canvas);
// No per-element handlers needed
```

## Node Format Changes

### Old Format
```javascript
{
  id: '123',
  type: 'file',
  x: 100,
  y: 100,
  flowX: 150,
  flowY: 200,
  title: 'main.js',
  connections: ['456'],
  children: [...]
}
```

### New Format
```javascript
{
  id: '123',
  type: 'file',
  title: 'main.js',
  position: { x: 100, y: 100 },
  size: { width: 180, height: 100 },
  ports: [
    { id: 'output', side: 'right', type: 'output', position: 0.5 }
  ],
  style: {
    color: '#fff',
    borderColor: '#ccc',
    borderWidth: 1
  },
  children: [...],
  containedIn: null
}
```

## Testing Checklist

After migration, verify:

- [ ] All nodes render correctly
- [ ] Node dragging works
- [ ] Connections display as bezier curves
- [ ] Ports are positioned correctly
- [ ] Node types show correct icons and styling
- [ ] Details panel displays type-specific properties
- [ ] Groups can contain nodes
- [ ] Group dragging moves contained nodes
- [ ] Node creator modal works
- [ ] Custom port configuration works
- [ ] Save/load preserves all data
- [ ] Dark mode works with new components

## Backward Compatibility

During transition, both systems can coexist:

1. Legacy nodes automatically adapted by `adaptLegacyNode()`
2. Legacy connections migrated by `migrateLegacyConnections()`
3. Old handlers still work until fully migrated

## Rollback Plan

If issues arise:
1. Keep legacy files alongside new ones
2. Toggle between systems via flag:

```javascript
const USE_NEW_SYSTEM = false; // Set to true when ready

if (USE_NEW_SYSTEM) {
  import('./nodes-new.js');
} else {
  import('./nodes.js');
}
```

## Performance Improvements

The new system provides:
- **Faster rendering**: Event delegation eliminates re-binding
- **Better scaling**: Virtual rendering for 1000+ nodes
- **Smooth animations**: Bezier curves with GPU acceleration
- **Memory efficient**: Singleton pattern for managers

## Next Steps

1. Test new system thoroughly in development
2. Migrate incrementally (one mode at a time)
3. Gather user feedback
4. Remove legacy code once stable
5. Add additional node types as plugins

## Support

For issues or questions about migration:
- Check existing node implementations in `v2/node-types/`
- Review core systems in `v2/core/`
- See example usage in plan file: `/home/jimmy/.claude/plans/purrfect-rolling-fog.md`
