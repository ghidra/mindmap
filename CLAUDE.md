# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Read These First

When starting any significant work, read these planning documents:

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE_PLAN.md` | Master architecture, module definitions, task lists |
| `CLAUDE_WORKFLOW.md` | How to work with Claude on this project |
| `SESSION_NOTES.md` | Current progress, what to work on next |

**Test project**: `/home/jimmy/projects/ice` - use for all testing.

## Project Overview

A vanilla JavaScript mind mapping visualization tool with three modes: hierarchical (tree-like code structure), flow (execution graph tracing), and notes (free-form sticky notes). Zero dependencies, ES6 modules, no build process.

## Development

**Running the app:** Serve via any HTTP server (uses ES modules). Project is in `/srv/http/mindmap/`, accessed via browser.

**No build/test/lint commands** - Pure vanilla JS loaded directly by browser.

## Architecture

### Entry Point
`index.html` → `v2/main.js` which initializes all systems:
1. Registers core node types via `registerCoreNodeTypes()`
2. Loads state from localStorage
3. Initializes EventManager, ConnectionSystem, UI components, keyboard shortcuts

### Core Systems (`v2/core/`)

| File | Purpose |
|------|---------|
| `NodeRenderer.js` | Component-based rendering pipeline (background → header → content → ports → controls) |
| `EventManager.js` | Event delegation - single listener on canvas, no re-binding on render |
| `ConnectionSystem.js` | Bezier curve connections with orientation-aware control points |
| `PortSystem.js` | Port positioning and connection validation |
| `GroupManager.js` | Visual container groups that move children together |
| `KeyboardShortcuts.js` | Global shortcuts (N=new node, Delete, Esc, Ctrl+S, Ctrl+A, I, C, ?) |

### Plugin System (`v2/node-types/`)

Node types registered via `NodeTypeRegistry` singleton. To add a custom type:

```javascript
import { nodeTypeRegistry } from './node-types/NodeTypeRegistry.js';
import { inferDataType } from './core/PortSystem.js';

nodeTypeRegistry.register({
  id: 'custom-type',
  name: 'Custom Node',
  category: 'organization', // 'code' | 'organization' | 'data'
  icon: '🎨',
  // Dynamic ports based on node data (preferred)
  getPorts: (node) => {
    const ports = [];
    // Add input ports from node.inputPorts or node data
    if (node.inputPorts) {
      node.inputPorts.forEach((p, i) => {
        const name = typeof p === 'string' ? p : p.name;
        ports.push({ id: `input-${name}`, side: 'left', type: 'input',
                     position: (i+1)/(node.inputPorts.length+1), label: name,
                     dataType: inferDataType(p.value) });
      });
    }
    // Add output port
    ports.push({ id: 'output', side: 'right', type: 'output', position: 0.5,
                 label: 'output', dataType: 'unknown' });
    return ports;
  },
  defaultStyle: { width: 180, height: 100, color: '#fff', borderColor: '#333' },
  features: { canHaveChildren: false, canHaveAttributes: true, canResize: false },
  renderContent: (node, container) => { /* custom DOM rendering */ }
});
```

Bundled types: File, Class, Function, Directory, Terminal (code); Notes, Text, Shape, Group (organization); Passthrough (data).

### Dynamic Port System

Ports are determined in priority order:
1. **Manual override**: `node.inputPorts` / `node.outputPorts` arrays
2. **Dynamic generation**: `getPorts(node)` function on type definition
3. **Static defaults**: `defaultPorts` array on type definition

**Port colors by data type** (inferred from values):
| Type | Color | Example Value |
|------|-------|---------------|
| number | Orange | `42`, `3.14` |
| string | Green | `'hello'`, `"world"` |
| boolean | Purple | `true`, `false` |
| array | Blue | `[1, 2, 3]` |
| object | Red | `{}`, `new Foo()` |
| function | Teal | `() => {}` |
| unknown | Black | unrecognized |

**To customize ports on any node:**
```javascript
node.inputPorts = ['param1', { name: 'param2', value: '42' }];
node.outputPorts = [{ name: 'result', value: '[]' }];
```

### State Management (`v2/state.js`)

Single global `state` object with:
- `nodes[]` - flat array, hierarchy in `node.children`
- `connections[]` - separate from nodes
- `viewport` - pan/zoom
- `currentMode` - 'hierarchical' | 'flow' | 'notes'
- `path[]` - navigation breadcrumb
- `notesData` - separate storage for notes mode

State persists to localStorage. Notes saved separately (`mindmap-notes` key).

### Key Architectural Decisions

1. **Fixed ports** - Configured at node creation, immutable after
2. **Bezier curves always** - No straight line option
3. **Event delegation** - Single canvas listener for performance
4. **Mode-agnostic state** - Single `nodes` array, modes are viewport views
5. **Visual container groups** - Groups have bounds, dragging moves children

### Parser Integration (`v2/ParserIntegrationModule.js`)

Regex-based JS/TS parser for loading code directories. Creates hierarchical node structure from file system with AST-based extraction of classes, functions, methods.

### Flow Analysis (`v2/flow-analysis/`)

Execution graph generation and tracing. Entry-point analysis and node trace modes.

## File Organization

```
v2/
├── core/           # Core framework (rendering, events, connections)
├── node-types/     # Plugin node type definitions
│   ├── code/       # File, Class, Function, Directory, Terminal
│   ├── organization/  # Notes, Text, Shape, Group
│   └── data/       # Passthrough
├── ui/             # UI components (menu, details panel, minimap)
├── flow-analysis/  # Flow mode analysis
├── main.js         # Application entry
├── state.js        # Global state
└── style.css       # Main styles (30KB)
```

## Working With This Codebase

- All rendering goes through `NodeRenderer.render(node, canvas)`
- Connections rendered by `ConnectionSystem.renderConnections()`
- After state changes, call the render callback set via `eventManager.setRenderCallback()`
- Node types define their own `renderContent()` for custom DOM in node body
- The `getCurrentNodes()` function in state.js handles mode-specific node retrieval
