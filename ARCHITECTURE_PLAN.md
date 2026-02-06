# Mindmap Application Architecture Plan

## Overview

A modular mind mapping and code visualization tool with three modes:
1. **Hierarchical Mode** - Tree-based view of parsed project structure
2. **Flow Mode** - Connection graph showing code relationships
3. **Notes Mode** - Free-form note taking with connected nodes

All modes share a unified node system, connection framework, and serialization layer.

---

## Core Principles

1. **Modularity** - Each system is self-contained with clear interfaces
2. **Extensibility** - New node types, parsers, and modes can be added with minimal changes
3. **Consistency** - Same node/connection rendering across all modes
4. **Separation of Concerns** - Parsing, state, rendering, and IO are independent layers

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           APPLICATION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Hierarchical │  │  Flow Mode   │  │  Notes Mode  │   MODES      │
│  │    Mode      │  │              │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └────────────┬────┴────────────────┘                       │
│                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    NODE FRAMEWORK                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ NodeTypes   │  │ PortSystem  │  │ ConnectionSystem    │  │   │
│  │  │ Registry    │  │             │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ NodeRenderer│  │ EventManager│  │ GroupManager        │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                      │                                              │
│         ┌────────────┴────────────┐                                │
│         ▼                         ▼                                │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐   │
│  │  PARSER MODULE  │    │           STATE & IO                 │   │
│  │  ┌───────────┐  │    │  ┌─────────────┐  ┌──────────────┐  │   │
│  │  │ JS Parser │  │    │  │ StateManager│  │ Serializer   │  │   │
│  │  ├───────────┤  │    │  └─────────────┘  └──────────────┘  │   │
│  │  │ TS Parser │  │    │  ┌─────────────┐  ┌──────────────┐  │   │
│  │  ├───────────┤  │    │  │ StorageLayer│  │ ProjectStore │  │   │
│  │  │ Future... │  │    │  │ (Abstract)  │  │              │  │   │
│  │  └───────────┘  │    │  └─────────────┘  └──────────────┘  │   │
│  └─────────────────┘    └─────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Parser System

### Purpose
Parse source code projects into a structured, serializable format that can be used by all visualization modes.

### Current State
- `ParserIntegrationModule.js` - Monolithic regex-based parser
- Handles JS/TS files with class/function extraction
- Tightly coupled to node creation

### Target Architecture

```
v2/parser/
├── ParserRegistry.js      # Register/lookup parsers by file type
├── BaseParser.js          # Abstract parser interface
├── parsers/
│   ├── JavaScriptParser.js   # ES6+ JS parsing
│   ├── TypeScriptParser.js   # TS-specific parsing
│   └── HTMLParser.js         # HTML/script tag parsing
├── ast/
│   ├── ASTCache.js           # Cache parsed ASTs
│   └── ASTUtils.js           # Common AST operations
└── ProjectParser.js       # Orchestrates parsing a full project
```

### Parser Interface

```javascript
// BaseParser.js
export class BaseParser {
  // File extensions this parser handles
  static extensions = [];

  // Parse file content into structured data
  // Returns: { symbols: [], imports: [], exports: [], references: [] }
  parse(content, filePath) { throw new Error('Not implemented'); }

  // Extract references from parsed content
  extractReferences(parsed) { throw new Error('Not implemented'); }
}
```

### Parsed Data Structure

```javascript
// ProjectData - Serializable project structure
{
  id: "project-xxx",
  name: "ice",
  rootPath: "/home/jimmy/projects/ice",
  parsedAt: "2024-01-15T...",

  files: {
    "src/iso/scene.js": {
      path: "src/iso/scene.js",
      type: "javascript",
      symbols: [
        {
          name: "Scene",
          type: "class",
          line: 10,
          methods: ["draw", "update", "init"],
          properties: ["entities", "camera"]
        },
        {
          name: "createScene",
          type: "function",
          line: 150,
          params: ["config"],
          async: false
        }
      ],
      imports: [
        { from: "./entity.js", symbols: ["Entity"], type: "named" },
        { from: "./camera.js", symbols: ["Camera"], type: "default" }
      ],
      exports: [
        { name: "Scene", type: "class" },
        { name: "createScene", type: "function" }
      ],
      references: [
        { name: "Entity", type: "class", usages: [25, 30, 45] },
        { name: "draw", type: "method", on: "Camera", usages: [60] }
      ]
    }
  },

  // Pre-computed relationship graph
  graph: {
    nodes: ["src/iso/scene.js", "src/iso/entity.js", ...],
    edges: [
      { from: "src/iso/scene.js", to: "src/iso/entity.js", type: "imports" },
      { from: "src/iso/scene.js", to: "src/iso/camera.js", type: "imports" }
    ]
  }
}
```

### Tasks

- [x] **P1.1** Create `BaseParser` abstract class with standard interface <!-- DONE 2024-01-15 -->
- [x] **P1.2** Create `ParserRegistry` for file-type to parser mapping <!-- DONE 2024-01-15 -->
- [x] **P1.3** Refactor JS parsing from `ParserIntegrationModule` into `JavaScriptParser` <!-- DONE 2024-01-15 -->
- [x] **P1.4** Create `ProjectParser` that orchestrates multi-file parsing <!-- DONE 2024-01-15 -->
- [x] **P1.5** Implement `ASTCache` for parsed content caching <!-- DONE 2024-01-15 -->
- [x] **P1.6** Define and implement `ProjectData` serialization format <!-- DONE 2024-01-15 -->
- [x] **P1.7** Add reference extraction (what symbols does a file use from others) <!-- DONE 2024-01-15 -->
- [x] **P1.8** Create `HTMLParser` for entry point detection <!-- DONE 2024-01-15 -->

---

## Module 2: Node Framework

### Purpose
Unified system for creating, rendering, and managing visual nodes across all modes.

### Current State
- `NodeTypeRegistry.js` - Type registration works
- `NodeRenderer.js` - Component-based rendering pipeline
- `PortSystem.js` - Basic port management
- `ConnectionSystem.js` - Bezier curve rendering
- Node types scattered across `node-types/` directory

### Target Architecture

```
v2/nodes/
├── NodeTypeRegistry.js    # Singleton registry
├── BaseNodeType.js        # Base class for all node types
├── NodeFactory.js         # Create nodes from parsed data or user action
├── types/
│   ├── code/
│   │   ├── FileNode.js
│   │   ├── ClassNode.js
│   │   ├── FunctionNode.js
│   │   ├── MethodNode.js
│   │   └── DirectoryNode.js
│   ├── organization/
│   │   ├── GroupNode.js
│   │   ├── NoteNode.js
│   │   └── TextNode.js
│   └── data/
│       ├── PassthroughNode.js
│       └── DataNode.js
└── rendering/
    ├── NodeRenderer.js
    ├── PortRenderer.js
    └── components/
        ├── NodeHeader.js
        ├── NodeContent.js
        └── NodeControls.js
```

### Node Type Interface

```javascript
// BaseNodeType.js
export class BaseNodeType {
  static id = '';           // Unique identifier
  static name = '';         // Display name
  static category = '';     // 'code' | 'organization' | 'data'
  static icon = '';         // Emoji or icon class

  // Port configuration
  static getDefaultPorts() { return []; }
  static getDynamicPorts(node) { return []; }

  // Rendering
  static getDefaultStyle() { return {}; }
  static renderContent(node, container) {}

  // Behavior
  static canHaveChildren() { return false; }
  static canConnect(fromPort, toPort) { return true; }
  static onDoubleClick(node) {}

  // Serialization
  static serialize(node) { return node; }
  static deserialize(data) { return data; }
}
```

### Tasks

- [x] **N2.1** Create `BaseNodeType` class with full interface <!-- DONE 2024-01-15 -->
- [x] **N2.2** Refactor existing node types to extend `BaseNodeType`
- [x] **N2.3** Create `NodeFactory` for consistent node creation <!-- DONE 2024-01-15 -->
- [x] **N2.4** Implement node serialization/deserialization methods <!-- DONE 2024-01-15 - in BaseNodeType -->
- [x] **N2.5** Add `MethodNode` type for class methods <!-- DONE 2026-02-03 -->
- [x] **N2.6** Standardize node data structure across all types <!-- DONE 2026-02-03 -->

---

## Module 3: Connection System

### Purpose
Manage connections between nodes with typed ports, validation, and visual rendering.

### Current State
- `ConnectionSystem.js` - Basic bezier rendering
- `PortSystem.js` - Port positioning
- Connections stored in `state.connections[]`
- No connection validation or typing

### Target Architecture

```
v2/connections/
├── ConnectionManager.js   # CRUD operations for connections
├── PortManager.js         # Port registration and lookup
├── ConnectionValidator.js # Validate connection compatibility
├── ConnectionRenderer.js  # Visual rendering
└── types/
    ├── DataConnection.js     # Data flow connections
    ├── ReferenceConnection.js # Code reference connections
    └── FlowConnection.js     # Execution flow connections
```

### Port Types

```javascript
// Port definition
{
  id: "input-data",
  side: "left",           // 'left' | 'right' | 'top' | 'bottom'
  type: "input",          // 'input' | 'output'
  dataType: "any",        // 'any' | 'string' | 'number' | 'object' | 'array' | 'function'
  label: "Data In",
  maxConnections: 1,      // -1 for unlimited
  required: false
}
```

### Connection Types

```javascript
// Connection definition
{
  id: "conn-xxx",
  type: "reference",      // 'data' | 'reference' | 'flow' | 'hierarchy'

  from: {
    nodeId: "node-1",
    portId: "output"
  },
  to: {
    nodeId: "node-2",
    portId: "input"
  },

  metadata: {
    label: "imports",
    weight: 1,
    bidirectional: false
  },

  style: {
    stroke: "#666",
    strokeWidth: 2,
    animated: false,
    dashed: false
  }
}
```

### Connection Validation Rules

```javascript
// ConnectionValidator.js
export class ConnectionValidator {
  // Check if connection is allowed
  canConnect(fromPort, toPort) {
    // Rule 1: Can't connect to self
    // Rule 2: Input can only connect to output (and vice versa)
    // Rule 3: Data types must be compatible
    // Rule 4: Max connections not exceeded
    // Rule 5: No duplicate connections
  }

  // Get compatible ports for a given port
  getCompatiblePorts(port, allPorts) {}
}
```

### Tasks

- [x] **C3.1** Create `ConnectionManager` with CRUD operations <!-- DONE 2026-02-03 -->
- [x] **C3.2** Implement `ConnectionValidator` with rules <!-- DONE 2026-02-03 -->
- [x] **C3.3** Add connection type definitions <!-- DONE 2026-02-03 -->
- [x] **C3.4** Update `PortSystem` with data type support <!-- DONE 2026-02-03 -->
- [x] **C3.5** Implement connection labels on rendered bezier curves <!-- DONE 2026-02-03 -->
- [x] **C3.6** Add animated connections for active data flow <!-- DONE 2026-02-03 -->
- [x] **C3.7** Create connection context menu (delete, edit style) <!-- DONE 2026-02-03 -->

---

## Module 4: State & IO System

### Purpose
Centralized state management with pluggable storage backends.

### Current State
- `state.js` - Global mutable state object
- `save()`/`load()` - Direct localStorage operations
- No separation between project data and view state

### Target Architecture

```
v2/state/
├── StateManager.js        # Central state with events
├── stores/
│   ├── ProjectStore.js    # Parsed project data
│   ├── ViewStore.js       # Current view state (mode, viewport, selection)
│   └── PreferencesStore.js # User preferences
├── io/
│   ├── StorageAdapter.js  # Abstract storage interface
│   ├── LocalStorageAdapter.js
│   ├── IndexedDBAdapter.js
│   └── (future) APIAdapter.js
└── Serializer.js          # Serialize/deserialize state
```

### State Structure

```javascript
// Separated state concerns
const state = {
  // Project data (parsed code structure)
  project: {
    id: null,
    name: null,
    data: null,        // ProjectData from parser
    loadedAt: null
  },

  // View state (UI state per mode)
  views: {
    hierarchical: {
      nodes: [],       // Visual nodes with positions
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      path: [],        // Breadcrumb navigation
      selection: []
    },
    flow: {
      nodes: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      focusedNode: null,
      navigationStack: []
    },
    notes: {
      nodes: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  },

  // UI state
  ui: {
    currentMode: 'hierarchical',
    selectedNodes: [],
    activePanel: null,
    theme: 'dark'
  }
};
```

### Storage Adapter Interface

```javascript
// StorageAdapter.js
export class StorageAdapter {
  // Save data with key
  async save(key, data) { throw new Error('Not implemented'); }

  // Load data by key
  async load(key) { throw new Error('Not implemented'); }

  // Delete data by key
  async delete(key) { throw new Error('Not implemented'); }

  // List all keys (with optional prefix)
  async list(prefix = '') { throw new Error('Not implemented'); }

  // Check if key exists
  async exists(key) { throw new Error('Not implemented'); }
}
```

### Storage Keys

```
mindmap/projects/{projectId}         # Parsed project data
mindmap/views/{projectId}/hierarchical  # Hierarchical view state
mindmap/views/{projectId}/flow          # Flow view state
mindmap/notes                           # Notes (not project-specific)
mindmap/preferences                     # User preferences
```

### Tasks

- [x] **S4.1** Create `StateManager` with event system <!-- DONE 2024-01-15 -->
- [x] **S4.2** Create `StorageAdapter` abstract interface <!-- DONE 2024-01-15 -->
- [x] **S4.3** Implement `LocalStorageAdapter` <!-- DONE 2024-01-15 -->
- [x] **S4.4** Implement `IndexedDBAdapter` for larger data <!-- DONE 2024-01-15 -->
- [x] **S4.5** Create `ProjectStore` for project data <!-- DONE 2024-01-15 -->
- [x] **S4.6** Create `ViewStore` for mode-specific view state <!-- DONE 2024-01-15 -->
- [x] **S4.7** Implement `Serializer` with versioning <!-- DONE 2024-01-15 -->
- [x] **S4.8** Migrate existing state to new structure <!-- DONE 2024-01-15 -->
- [x] **S4.9** Add auto-save with debouncing <!-- DONE 2024-01-15 -->

---

## Module 5: Modes

### Purpose
Mode-specific logic that uses shared node framework and state.

### Current State
- Mode switching in `mode-manager.js`
- Mode-specific rendering scattered across files
- Flow mode has focused flow implementation

### Target Architecture

```
v2/modes/
├── ModeManager.js         # Mode switching, lifecycle
├── BaseMode.js            # Abstract mode interface
├── hierarchical/
│   ├── HierarchicalMode.js
│   ├── HierarchicalLayout.js
│   └── BreadcrumbNav.js
├── flow/
│   ├── FlowMode.js
│   ├── FlowLayout.js
│   ├── FlowAnalyzer.js
│   └── NodeTracer.js
└── notes/
    ├── NotesMode.js
    └── NotesLayout.js
```

### Mode Interface

```javascript
// BaseMode.js
export class BaseMode {
  static id = '';
  static name = '';
  static icon = '';

  // Lifecycle
  onEnter(previousMode) {}
  onExit(nextMode) {}

  // Get nodes to render for current state
  getNodes() { return []; }

  // Get connections to render
  getConnections() { return []; }

  // Handle mode-specific actions
  onNodeDoubleClick(node) {}
  onCanvasDoubleClick(x, y) {}

  // Layout
  applyLayout(nodes, connections) {}

  // State
  getViewState() {}
  setViewState(state) {}
}
```

### Tasks

- [x] **M5.1** Create `BaseMode` abstract class <!-- DONE 2024-02-04 -->
- [x] **M5.2** Create `ModeManager` with lifecycle hooks <!-- DONE 2024-02-04 -->
- [x] **M5.3** Refactor `HierarchicalMode` to use interface <!-- DONE 2024-02-04 -->
- [x] **M5.4** Refactor `FlowMode` to use interface <!-- DONE 2024-02-04 -->
- [x] **M5.5** Implement `NotesMode` following same pattern <!-- DONE 2024-02-04 -->
- [x] **M5.6** Extract layout algorithms to separate files <!-- DONE 2024-02-04 -->
- [x] **M5.7** Implement mode-specific toolbar/controls <!-- DONE 2024-02-04 -->

---

## Module 6: UI Components

### Purpose
Reusable UI components for panels, menus, and controls.

### Current State
- `DetailsPanel.js` - Node properties panel
- `SimpleNodeMenu.js` - Node creation menu
- `Minimap.js` - Overview minimap
- Styles in monolithic `style.css`

### Target Architecture

```
v2/ui/
├── components/
│   ├── Panel.js           # Base panel component
│   ├── DetailsPanel.js
│   ├── Minimap.js
│   ├── Toolbar.js
│   └── ContextMenu.js
├── dialogs/
│   ├── NodeCreatorDialog.js
│   ├── ProjectLoaderDialog.js
│   └── SettingsDialog.js
└── styles/
    ├── base.css
    ├── nodes.css
    ├── connections.css
    ├── panels.css
    └── themes/
        ├── dark.css
        └── light.css
```

### Tasks

- [x] **U6.1** Split `style.css` into modular CSS files <!-- DONE 2026-02-04 -->
- [x] **U6.2** Create `ContextMenu` component for right-click menus <!-- DONE 2026-02-04 -->
- [x] **U6.3** Create `Toolbar` component for mode-specific controls <!-- DONE 2026-02-04 (ModeToolbar) -->
- [x] **U6.4** Implement theme switching <!-- DONE 2026-02-04 -->
- [x] **U6.5** Add keyboard shortcut hints to UI <!-- DONE 2026-02-04 -->

---

## Module 7: Command System (Undo/Redo)

### Purpose
Track all state-changing actions as commands that can be undone and redone.

### Target Architecture

```
v2/commands/
├── CommandManager.js      # Execute, undo, redo, history
├── Command.js             # Base command interface
└── commands/
    ├── NodeCommands.js    # Create, delete, move, resize nodes
    ├── ConnectionCommands.js  # Create, delete connections
    ├── SelectionCommands.js   # Select, deselect, multi-select
    └── ViewCommands.js    # Pan, zoom (optional - may skip)
```

### Command Interface

```javascript
// Command.js
export class Command {
  // Human-readable description for undo menu
  get description() { return ''; }

  // Execute the command
  execute() { throw new Error('Not implemented'); }

  // Reverse the command
  undo() { throw new Error('Not implemented'); }

  // Optional: merge with previous command of same type
  // (e.g., multiple small moves become one drag)
  canMerge(other) { return false; }
  merge(other) { return this; }
}
```

### CommandManager

```javascript
// CommandManager.js
export class CommandManager {
  constructor(maxHistory = 100) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action
    this.trimHistory();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
}
```

### Tasks

- [x] **CMD7.1** Create `Command` base class <!-- DONE 2024-01-15 -->
- [x] **CMD7.2** Create `CommandManager` with history management <!-- DONE 2024-01-15 -->
- [x] **CMD7.3** Implement `CreateNodeCommand`, `DeleteNodeCommand` <!-- DONE 2024-01-15 -->
- [x] **CMD7.4** Implement `MoveNodeCommand` with merge support <!-- DONE 2024-01-15 -->
- [x] **CMD7.5** Implement `CreateConnectionCommand`, `DeleteConnectionCommand` <!-- DONE 2024-01-15 -->
- [x] **CMD7.6** Integrate CommandManager with EventManager <!-- DONE 2024-01-15 -->
- [x] **CMD7.7** Add Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts <!-- DONE 2024-01-15 -->
- [x] **CMD7.8** Add undo/redo buttons to toolbar <!-- DONE 2024-01-15 -->

---

## Module 8: Settings & Shortcuts System

### Purpose
User-configurable preferences and keyboard shortcuts.

### Target Architecture

```
v2/settings/
├── SettingsManager.js     # Load, save, get, set preferences
├── ShortcutManager.js     # Register, trigger, customize shortcuts
├── defaults.js            # Default settings and shortcuts
└── SettingsPanel.js       # UI for editing settings
```

### Settings Structure

```javascript
// Default settings
{
  // Appearance
  theme: 'dark',
  nodeDefaultWidth: 180,
  nodeDefaultHeight: 100,
  connectionStyle: 'bezier',  // 'bezier' | 'straight' | 'step'
  animateConnections: false,

  // Behavior
  autoSave: true,
  autoSaveInterval: 30000,    // ms
  snapToGrid: false,
  gridSize: 20,
  confirmDelete: true,

  // Shortcuts (customizable)
  shortcuts: {
    'undo': 'Ctrl+Z',
    'redo': 'Ctrl+Shift+Z',
    'delete': 'Delete',
    'selectAll': 'Ctrl+A',
    'newNode': 'N',
    'save': 'Ctrl+S',
    'toggleMinimap': 'M',
    'escape': 'Escape',
    'zoomIn': 'Ctrl+=',
    'zoomOut': 'Ctrl+-',
    'zoomReset': 'Ctrl+0',
    'panMode': 'Space',
  }
}
```

### ShortcutManager

```javascript
// ShortcutManager.js
export class ShortcutManager {
  constructor() {
    this.shortcuts = new Map();  // action -> key combo
    this.handlers = new Map();   // action -> callback
  }

  // Register a shortcut action with handler
  register(action, handler) {
    this.handlers.set(action, handler);
  }

  // Set key binding for action
  bind(action, keyCombo) {
    this.shortcuts.set(action, this.parseKeyCombo(keyCombo));
  }

  // Handle keydown event
  handleKeyDown(event) {
    for (const [action, combo] of this.shortcuts) {
      if (this.matchesCombo(event, combo)) {
        const handler = this.handlers.get(action);
        if (handler) {
          event.preventDefault();
          handler();
          return;
        }
      }
    }
  }

  // Get current binding for action
  getBinding(action) {}

  // Get all bindings
  getAllBindings() {}
}
```

### Tasks

- [x] **SET8.1** Create `SettingsManager` with localStorage persistence <!-- DONE 2026-02-04 -->
- [x] **SET8.2** Create `ShortcutManager` with customizable bindings <!-- DONE 2026-02-04 -->
- [x] **SET8.3** Define default settings and shortcuts <!-- DONE 2026-02-04 -->
- [x] **SET8.4** Create `SettingsPanel` UI component <!-- DONE 2026-02-04 -->
- [x] **SET8.5** Add shortcut customization UI <!-- DONE 2026-02-04 -->
- [x] **SET8.6** Migrate existing shortcuts to ShortcutManager <!-- DONE 2026-02-04 -->
- [x] **SET8.7** Add settings button to toolbar <!-- DONE 2026-02-04 -->

---

## Module 9: Session Management

### Purpose
Save and load complete sessions (project + all view states) as files.

### Target Architecture

```
v2/session/
├── SessionManager.js      # Save, load, export, import sessions
└── SessionFormat.js       # Session file format definition
```

### Session File Format

```javascript
// .mindmap session file (JSON)
{
  version: "1.0",
  savedAt: "2024-01-15T...",
  name: "ice-project-session",

  // Parsed project data
  project: {
    id: "proj-xxx",
    name: "ice",
    rootPath: "/home/jimmy/projects/ice",
    files: { ... },
    graph: { ... }
  },

  // View states for all modes
  views: {
    hierarchical: {
      nodes: [...],
      connections: [...],
      viewport: { x, y, zoom },
      path: []
    },
    flow: {
      nodes: [...],
      connections: [...],
      viewport: { x, y, zoom },
      focusedNode: null
    },
    notes: {
      nodes: [...],
      connections: [...],
      viewport: { x, y, zoom }
    }
  },

  // User's current state
  ui: {
    currentMode: 'hierarchical',
    selectedNodes: []
  }
}
```

### SessionManager

```javascript
// SessionManager.js
export class SessionManager {
  // Create new empty session
  newSession() {}

  // Export current state to downloadable file
  exportSession(filename) {
    const session = this.buildSession();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    // Trigger download
  }

  // Import session from file
  async importSession(file) {
    const content = await file.text();
    const session = JSON.parse(content);
    this.validateSession(session);
    this.loadSession(session);
  }

  // Save to localStorage (auto-save)
  saveToStorage() {}

  // Load from localStorage
  loadFromStorage() {}

  // Check for unsaved changes
  hasUnsavedChanges() {}
}
```

### Tasks

- [x] **SES9.1** Define session file format with versioning <!-- DONE 2026-02-04 -->
- [x] **SES9.2** Create `SessionManager` with export/import <!-- DONE 2026-02-04 -->
- [x] **SES9.3** Add "New Session" functionality <!-- DONE 2026-02-04 -->
- [x] **SES9.4** Add "Save Session" / "Save Session As" <!-- DONE 2026-02-04 -->
- [x] **SES9.5** Add "Open Session" with file picker <!-- DONE 2026-02-04 -->
- [x] **SES9.6** Add unsaved changes warning on close/new <!-- DONE 2026-02-04 -->
- [x] **SES9.7** Add recent sessions list <!-- DONE 2026-02-04 -->

---

## Implementation Phases

### Phase 1: Foundation (Parser & State)
Focus: Create solid data layer
Modules: 1 (Parser), 4 (State/IO)

1. Implement new parser architecture
2. Implement new state/storage architecture
3. Create migration from old to new state format
4. Test with ice project

### Phase 2: Node & Connection Framework
Focus: Standardize visual components
Modules: 2 (Nodes), 3 (Connections)

1. Refactor all node types to new base class
2. Implement proper connection system with validation
3. Standardize port definitions
4. Test rendering consistency across modes

### Phase 3: Mode Refactoring
Focus: Clean mode implementations
Modules: 5 (Modes)

1. Create mode base class and manager
2. Refactor hierarchical mode
3. Refactor flow mode
4. Implement notes mode with visual connections

### Phase 4: Command System
Focus: Undo/Redo support
Modules: 7 (Commands)

1. Create command infrastructure
2. Wrap all state changes in commands
3. Implement undo/redo UI

### Phase 5: Settings & Sessions
Focus: User configuration and persistence
Modules: 8 (Settings), 9 (Sessions)

1. Create settings system with shortcuts
2. Implement session save/load
3. Add settings UI

### Phase 6: Polish
Focus: User experience
Modules: 6 (UI)

1. Split CSS into modules
2. Add context menus
3. Create settings panel
4. Add keyboard shortcut customization UI

---

## File Changes Summary

### New Files to Create
```
v2/parser/
  BaseParser.js
  ParserRegistry.js
  ProjectParser.js
  parsers/JavaScriptParser.js
  parsers/TypeScriptParser.js
  ast/ASTCache.js

v2/nodes/
  BaseNodeType.js
  NodeFactory.js

v2/connections/
  ConnectionManager.js
  ConnectionValidator.js

v2/state/
  StateManager.js
  stores/ProjectStore.js
  stores/ViewStore.js
  io/StorageAdapter.js
  io/LocalStorageAdapter.js
  io/IndexedDBAdapter.js
  Serializer.js

v2/modes/
  BaseMode.js
  ModeManager.js
  hierarchical/HierarchicalMode.js
  flow/FlowMode.js
  notes/NotesMode.js
```

### Files to Refactor
```
v2/ParserIntegrationModule.js → Split into parser/
v2/state.js → Migrate to state/StateManager.js
v2/mode-manager.js → Migrate to modes/
v2/node-types/*.js → Refactor to extend BaseNodeType
v2/core/ConnectionSystem.js → Enhance with ConnectionManager
v2/style.css → Split into ui/styles/
```

### Files to Keep (with updates)
```
v2/core/NodeRenderer.js - Minor updates for new node types
v2/core/EventManager.js - Keep as-is
v2/core/PortSystem.js - Enhance with data types
v2/main.js - Update to use new modules
```

---

## Testing Strategy

### Unit Tests (Future)
- Parser tests with sample code snippets
- Connection validation tests
- Serialization round-trip tests

### Integration Tests
- Load ice project, verify all files parsed
- Switch modes, verify state preserved
- Save/load, verify data integrity

### Manual Tests
- Load `/home/jimmy/projects/ice`
- Navigate hierarchical mode
- Use flow mode to trace from `scene.js`
- Create notes, save, reload
- Verify connections render correctly

---

## Decisions Made

1. **Notes Mode Connections**: Notes mode DOES have connections - for visual flow and organization, not data flow. Same connection rendering as other modes.

2. **Undo/Redo**: YES - Implement using command pattern. Required for good UX.

3. **Multi-Project/Sessions**: Handle via session files:
   - Save session to file (JSON export)
   - Open session from file
   - Overwrite existing session
   - Each session contains: project data + all view states

4. **UI System**: Robust, with:
   - Customizable keyboard shortcuts
   - Settings panel for user preferences
   - Persistent user configuration

## Open Questions

1. **AST vs Regex**: Should we use a proper AST parser (acorn, babel) or keep regex?
   - Pro AST: More accurate, handles edge cases
   - Pro Regex: Simpler, no dependencies, faster

---

## References

- Current codebase: `/srv/http/mindmap/v2/`
- Test project: `/home/jimmy/projects/ice`
- CLAUDE.md: Development guidelines
