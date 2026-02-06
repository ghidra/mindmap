# Session Notes

## Current State

**Date**: 2026-02-04
**Overall Status**: Module 5 complete - Mode System implemented

---

## Completed (Before Refactor)

### Working Features
- [x] Hierarchical mode - basic tree navigation
- [x] Flow mode - focused flow with path input
- [x] Notes mode - basic (needs connections)
- [x] Node rendering pipeline
- [x] Connection rendering (bezier curves)
- [x] Minimap
- [x] Details panel
- [x] LocalStorage save/load
- [x] File/directory parsing (regex-based)

### Recent Session Work
- Fixed flow mode group node rendering
- Fixed flow mode panning and dragging
- Added flow groups using standard group node type
- Updated findNode() to search execution graph
- Created ARCHITECTURE_PLAN.md
- Created CLAUDE_WORKFLOW.md

---

## Completed: Module 5 (Mode System)

### Completed Tasks
- [x] **M5.1** Create `BaseMode` abstract class - `v2/modes/BaseMode.js`
  - Lifecycle methods (onEnter, onExit, onActivate, onDeactivate)
  - Node/connection retrieval methods
  - Position management with caching
  - View state management
  - Event handlers (onNodeDoubleClick, onCanvasDoubleClick, onNodeDrag)
  - Controls configuration interface

- [x] **M5.2** Create `ModeManager` with lifecycle hooks - `v2/modes/ModeManager.js`
  - Mode registration and lookup
  - Instance management (lazy creation)
  - Mode switching with lifecycle hooks
  - Event emission (beforeChange, afterChange, error, initialized)
  - Position cache management per mode
  - Delegation methods for current mode
  - Render/save callbacks integration

- [x] **M5.3** Refactor `HierarchicalMode` - `v2/modes/hierarchical/HierarchicalMode.js`
  - Path-based navigation (navigateInto, navigateUp, navigateToRoot)
  - Breadcrumb generation
  - Tree layout algorithms (horizontal, vertical)
  - Double-click to drill into nodes
  - Mode-specific controls (Up, Root, Auto Layout)

- [x] **M5.4** Refactor `FlowMode` - `v2/modes/flow/FlowMode.js`
  - Three flow types: entry-point, node-trace, focused
  - Flow-specific positioning (flowX, flowY)
  - Focused mode navigation (navigateToNode, navigateBack)
  - Layout direction (top-down, left-right)
  - Radial layout for focused mode
  - Mode-specific controls

- [x] **M5.5** Implement `NotesMode` - `v2/modes/notes/NotesMode.js`
  - Separate storage (state.notesData)
  - Double-click canvas to create notes
  - Color rotation for new notes
  - Grid layout option
  - Note-specific operations (updateDescription, updateSize, updateColor)

- [x] **M5.6** Extract layout algorithms - `v2/layouts/`
  - `FlowLayout.js` - Depth-based flow layouts with barycenter optimization
  - `RadialFlowLayout.js` - Radial layout for focused flow mode
  - `TreeLayout.js` - Hierarchical tree layouts (horizontal, vertical, balanced, indented)
  - `GridLayout.js` - Grid, masonry, row, column, centered layouts

- [x] **M5.7** Implement mode-specific toolbar - `v2/ui/ModeToolbar.js`
  - Dynamic control rendering based on current mode
  - Support for button, toggle, and select controls
  - Auto-updates on mode change
  - Integration with ModeManager events

### Files Created
```
v2/modes/
├── index.js                    # Module exports
├── BaseMode.js                 # Abstract base class
├── ModeManager.js              # Mode lifecycle management
├── hierarchical/
│   └── HierarchicalMode.js     # Tree navigation mode
├── flow/
│   └── FlowMode.js             # Execution graph mode
└── notes/
    └── NotesMode.js            # Free-form notes mode

v2/layouts/
├── index.js                    # Module exports
├── FlowLayout.js               # Flow mode layouts
├── TreeLayout.js               # Tree mode layouts
└── GridLayout.js               # Grid mode layouts

v2/ui/
└── ModeToolbar.js              # Dynamic mode toolbar
```

---

## Current Work: Module 7 (Command System)

### Completed Tasks
- [x] **CMD7.1** Create `Command` base class - `v2/commands/Command.js`
  - Base Command class with execute/undo interface
  - CompositeCommand for grouping multiple commands
  - NullCommand placeholder
  - Serialization support
  - canMerge/merge methods for command combining

- [x] **CMD7.2** Create `CommandManager` - `v2/commands/CommandManager.js`
  - Full undo/redo stack management
  - Command merging within time window (500ms default)
  - Batch mode for grouping commands
  - History size limit (100 default)
  - Event callbacks (onExecute, onUndo, onRedo, onStateChange)
  - Serialization for persistence
  - Singleton export (`commandManager`)

- [x] **CMD7.3** Implement node commands - `v2/commands/commands/NodeCommands.js`
  - CreateNodeCommand: Creates nodes with full undo support
    - Handles hierarchical and notes modes
    - Supports parent/child relationships
    - Captures insertion location for proper undo
  - DeleteNodeCommand: Deletes nodes with full state capture
    - Captures node data and connections before deletion
    - Restores node at exact position on undo
    - Handles notes mode separately
  - BatchDeleteNodesCommand: Delete multiple nodes as one action

- [x] **CMD7.4** Implement movement commands - `v2/commands/commands/NodeCommands.js`
  - MoveNodeCommand: Move single node with merge support
    - Handles x/y, position.x/y, and flowX/flowY formats
    - canMerge() for same node within time window
    - merge() updates new position, keeps original old position
  - BatchMoveNodesCommand: Move multiple nodes together
    - For selection/group movement
    - Supports merging batch moves
  - ResizeNodeCommand: Resize node with merge support
    - Tracks old/new width/height
    - Merges consecutive resizes

- [x] **CMD7.5** Implement connection commands - `v2/commands/commands/ConnectionCommands.js`
  - CreateConnectionCommand: Create connections with undo support
    - Handles port-based (hierarchical/flow) and simple (notes) formats
    - Duplicate checking
  - DeleteConnectionCommand: Delete with full state capture
    - Restores at original index on undo
  - BatchDeleteConnectionsCommand: Delete multiple connections
  - ReconnectCommand: Change connection endpoints
  - UpdateConnectionStyleCommand: Change visual style with merge support

- [x] **CMD7.6** Integrate CommandManager with EventManager - `v2/core/EventManager.js`
  - Node dragging creates MoveNodeCommand at drag end
  - Node resizing creates ResizeNodeCommand at resize end
  - Connection creation uses CreateConnectionCommand
  - Node deletion uses DeleteNodeCommand / BatchDeleteNodesCommand
  - Captures initial state at operation start
  - Skips command creation during undo/redo operations
  - Uses skipExecution=true for already-performed actions

- [x] **CMD7.7** Add undo/redo keyboard shortcuts - `v2/core/KeyboardShortcuts.js`
  - Ctrl+Z for undo
  - Ctrl+Y for redo
  - Ctrl+Shift+Z for redo (alternative)
  - Console feedback showing action description
  - Delete key now uses command system via eventManager

- [x] **CMD7.8** Add undo/redo buttons to toolbar
  - Added buttons to `index.html` in controls bar
  - Styled in `v2/style.css` with dark mode support
  - Wired up in `v2/main.js` with state change callback
  - Buttons enable/disable based on undo/redo availability
  - Tooltips show next action description
  - Clear Map also clears command history

### Module 7 Complete!
All undo/redo functionality is now implemented.

---

## Current Work: Module 1 (Parser System)

### Completed Tasks
- [x] **P1.1** Create `BaseParser` abstract class - `v2/parser/BaseParser.js`
  - Enumerations: SymbolType, ImportType, ExportType
  - JSDoc typedefs: ParsedSymbol, ParsedImport, ParsedExport, ParsedReference, ParsedFile
  - Abstract methods: parse(), extractReferences()
  - Helper methods: _createEmptyResult(), _createSymbol(), _createImport(), _createExport(), _createReference()
  - Utility methods: _normalizePath(), _addExtensionIfMissing()
  - Static: canParse() for extension checking

- [x] **P1.2** Create `ParserRegistry` - `v2/parser/ParserRegistry.js`
  - register(ParserClass) - Register parser by file extensions
  - unregister(ParserClass) - Remove parser registration
  - getParser(filePath) - Get parser instance for a file
  - getParserClass(filePath) - Get parser class for a file
  - getParserById(id) - Get parser by fileType ID
  - canParse(filePath) - Check if parser exists for file type
  - getRegisteredExtensions() - List all registered extensions
  - getRegisteredParsers() - List all unique parser classes
  - getParserInfo() - Get info about all registered parsers
  - Singleton export: parserRegistry

- [x] **P1.3** Create `JavaScriptParser` - `v2/parser/parsers/JavaScriptParser.js`
  - Extends BaseParser for .js, .mjs, .jsx files
  - parse() method with regex-based extraction:
    - _parseImports() - ES6 imports (default, named, namespace, side-effect, dynamic)
    - _parseExports() - ES6 exports (default, named, declaration, re-export, all)
    - _parseStandardClasses() - class ClassName { } declarations
    - _parseClassExpressions() - namespace.ClassName = class { } patterns
    - _parseFunctions() - Regular and async function declarations
    - _parseArrowFunctions() - Arrow function expressions
    - _parseVariables() - const/let/var declarations
  - _extractClassMembers() - Methods, properties, getters, setters
  - extractReferences() - Cross-file reference resolution via imports
  - Helper: _getLineNumber(), _findMatchingBrace(), _isInsideRange()

- [x] **P1.4** Create `ProjectParser` - `v2/parser/ProjectParser.js`
  - parseProject(files, options) - Parse array of ProjectFile objects
  - parseFromFileObjects(fileObjects) - Parse browser File objects from directory picker
  - Returns ProjectData: { id, name, rootPath, parsedAt, files, graph, stats, errors }
  - _extractAllReferences() - Cross-file reference extraction after all files parsed
  - _buildGraph() - Builds relationship graph with nodes (files) and edges (imports/references)
  - _resolveImportPath() - Resolves relative imports with extension resolution
  - Query methods:
    - getFile(path), getAllFiles()
    - findImporters(targetPath) - Files that import a given file
    - findImports(sourcePath) - Files imported by a given file
    - findSymbol(name, type) - Find symbol across all files
    - getSymbolsByType(type) - Get all symbols of a type
  - Statistics: totalFiles, parsedFiles, symbols, imports, exports, references, duration
  - Progress callback support: onProgress(current, total, file)
  - Error handling: onError callback, errors array in result
  - Singleton export: projectParser

- [x] **P1.5** Implement `ASTCache` - `v2/parser/ast/ASTCache.js`
  - Content-based cache with hash comparison (djb2 algorithm)
  - get(filePath, content) - Get cached result if content unchanged
  - set(filePath, content, data) - Store parsed result
  - has(filePath, content) - Check if valid cache exists
  - invalidate(filePath) - Remove single entry
  - invalidatePattern(pattern) - Remove entries matching regex
  - clear() - Remove all entries
  - prune() - Remove expired entries
  - LRU eviction when maxEntries reached
  - Options: maxEntries (500), maxAge (1 hour), persist (localStorage)
  - Statistics: hits, misses, hitRate, entries, size, evictions
  - Integrated with ProjectParser (useCache option)
  - Singleton export: astCache

- [x] **P1.6** Create `ProjectSerializer` - `v2/parser/ProjectSerializer.js`
  - serialize(projectData) - Convert ProjectData to JSON-compatible object
  - deserialize(data) - Convert JSON object back to ProjectData (with Maps)
  - toJSON() / fromJSON() - String serialization
  - saveToLocalStorage() / loadFromLocalStorage() - Browser storage
  - deleteFromLocalStorage() - Remove saved project
  - listSavedProjects() - List all saved projects from index
  - exportToFile() / importFromFile() - File download/upload
  - calculateSize() - Estimate serialized size in bytes
  - validate() - Validate serialized data structure
  - Version support: FORMAT_VERSION for migrations
  - Project index: Tracks saved projects in localStorage
  - Singleton export: projectSerializer

- [x] **P1.7** Create `ReferenceExtractor` - `v2/parser/ast/ReferenceExtractor.js`
  - extract(content, parsedFile, allFiles) - Full reference extraction
  - extractForSymbol(content, symbolName) - Find usages of specific symbol
  - Detects usage types:
    - 'call' - Function calls: foo()
    - 'new' - Class instantiations: new Foo()
    - 'access' - Property access: foo.bar
    - 'extends' - Class inheritance: class X extends Foo
    - 'typeof' - Type checks: instanceof Foo
    - 'reference' - General identifier usage
  - Returns detailed usages with line numbers and context
  - Infers symbol type from usage patterns
  - Resolves import sources to actual file paths
  - Integrated with JavaScriptParser.extractReferences()
  - Singleton export: referenceExtractor

- [x] **P1.8** Create `HTMLParser` - `v2/parser/parsers/HTMLParser.js`
  - Parses .html, .htm files
  - Extracts scripts: src, inline content, type="module", async, defer
  - Extracts styles: link[rel=stylesheet], inline <style>
  - Extracts metadata: title, meta tags, charset
  - Entry point detection: identifies main.js, index.js, app.js, modules
  - Creates imports for external scripts/styles
  - Creates symbols for scripts (external and inline)
  - extractReferences() resolves script paths to project files
  - Handles relative paths, absolute paths, skips external URLs

### Module 1 Complete!
All Parser System tasks (P1.1-P1.8) are now implemented.

### Files Created
- `v2/parser/BaseParser.js` - Abstract base class
- `v2/parser/ParserRegistry.js` - Central parser registry
- `v2/parser/ProjectParser.js` - Multi-file project orchestrator
- `v2/parser/ProjectSerializer.js` - Serialization/deserialization with versioning
- `v2/parser/parsers/JavaScriptParser.js` - JavaScript/JSX parser
- `v2/parser/parsers/HTMLParser.js` - HTML parser for entry point detection
- `v2/parser/ast/ASTCache.js` - Parsed content cache with localStorage persistence
- `v2/parser/ast/ReferenceExtractor.js` - Symbol usage detection
- `v2/parser/parsers/` - Directory for language parsers
- `v2/parser/ast/` - Directory for AST utilities

---

## Current Work: Module 4 (State & IO System)

### Completed Tasks
- [x] **S4.1** Create `StateManager` with event system - `v2/state/StateManager.js`
  - Central state management class
  - Path-based get/set/update/delete operations (e.g., 'views.hierarchical.nodes')
  - Event system with subscriptions
  - Pattern matching for subscriptions ('*' for all, 'views.*' for prefix)
  - Batch mode for grouping changes and minimizing re-renders
  - Transaction support with rollback capability
  - Global listeners for debugging/logging
  - Initial state structure separating:
    - `project` - parsed code structure
    - `views` - per-mode UI state (hierarchical, flow, notes)
    - `ui` - current mode, selection, theme
    - `preferences` - user preferences
  - Singleton export: `stateManager`

- [x] **S4.2** Create `StorageAdapter` abstract interface - `v2/state/io/StorageAdapter.js`
  - Abstract base class for storage backends
  - Async methods: save(), load(), delete(), exists()
  - Listing: list(), getMetadata(), listWithMetadata()
  - Batch operations: saveMany(), loadMany(), deleteMany()
  - Utilities: clear(), getStats(), prune()
  - Key prefixing for namespacing
  - StorageError class with error codes:
    - QUOTA_EXCEEDED, NOT_FOUND, INVALID_DATA, UNAVAILABLE, PERMISSION_DENIED

- [x] **S4.3** Implement `LocalStorageAdapter` - `v2/state/io/LocalStorageAdapter.js`
  - Extends StorageAdapter for browser localStorage
  - Automatic JSON serialization/deserialization
  - Entry metadata: savedAt, expiresAt, size, type
  - TTL support with automatic expiration cleanup
  - Quota detection and error handling (~5MB limit)
  - Backwards compatibility with legacy raw values
  - Automatic prune on startup
  - Storage statistics tracking
  - Singleton export: `localStorageAdapter`

- [x] **S4.4** Implement `IndexedDBAdapter` - `v2/state/io/IndexedDBAdapter.js`
  - Extends StorageAdapter for browser IndexedDB
  - Supports much larger data (hundreds of MB vs ~5MB)
  - Fully async/non-blocking operations
  - Single object store with indexes on savedAt, expiresAt, type
  - Optimized batch operations using transactions
  - Storage estimate via navigator.storage API
  - Automatic prune on startup
  - Proper database connection lifecycle (open/close)
  - Singleton export: `indexedDBAdapter`

- [x] **S4.5** Create `ProjectStore` - `v2/state/stores/ProjectStore.js`
  - Domain store for managing parsed project data
  - CRUD operations: loadProject(), saveProject(), deleteProject()
  - Intelligent storage selection (IndexedDB for large projects > 500KB)
  - Project index with metadata (stored in localStorage)
  - Current project tracking via StateManager
  - Query methods: getFile(), findSymbol(), findImporters(), findImports()
  - Last project restoration on startup
  - Project ID generation utility
  - Singleton export: `projectStore`

- [x] **S4.6** Create `ViewStore` - `v2/state/stores/ViewStore.js`
  - Domain store for mode-specific view state (hierarchical, flow, notes)
  - Node operations: getNodes(), setNodes(), addNode(), removeNode(), updateNode(), findNode()
  - Connection operations: getConnections(), setConnections(), addConnection(), removeConnection()
  - Viewport management: getViewport(), setViewport(), updateViewport(), resetViewport()
  - Selection management: getSelection(), setSelection(), addToSelection(), clearSelection()
  - Hierarchical-specific: getPath(), setPath(), pushPath(), popPath()
  - Flow-specific: getFocusedNode(), getNavigationStack(), getExecutionGraph(), getFlowType()
  - UI state: getCurrentMode(), getActivePanel(), getTheme()
  - Persistence: saveViewState(), loadViewState(), saveNotes(), saveUIState()
  - Notes stored globally (not per-project)
  - Singleton export: `viewStore`

- [x] **S4.7** Implement `Serializer` with versioning - `v2/state/Serializer.js`
  - Serialize/deserialize complete application state
  - FORMAT_VERSION constant for tracking schema changes
  - serialize() / deserialize() for object conversion
  - toJSON() / fromJSON() for string conversion
  - validate() for structure validation
  - calculateSize() for size estimation
  - Handles Map, Set, Date conversion for JSON compatibility
  - Version migration system with sequential migrations
  - createSnapshot() / applySnapshot() for partial state
  - Optional compression (base64 encoding)
  - Path-based utilities for nested access
  - Singleton export: `serializer`

- [x] **S4.8** Migrate existing state to new structure - `v2/state/StateMigration.js`
  - Reads legacy localStorage formats ('mindmap', 'mindmap-notes')
  - Converts to new StateManager/ViewStore structure
  - Handles multiple legacy formats (array-only, object with config)
  - Node conversion with recursive children handling
  - Connection extraction from legacy node.connections
  - Notes migration with font/color properties
  - Automatic backup before migration
  - Migration flag to prevent re-migration
  - Restore from backup capability
  - Status reporting (migrated, hasBackup, hasLegacyData)
  - runAutoMigration() for automatic migration on startup
  - Singleton export: `stateMigration`

- [x] **S4.9** Add auto-save with debouncing - `v2/state/AutoSave.js`
  - Debounced saves (configurable delay, default 2s)
  - Max delay timer (forces save after 30s of continuous changes)
  - Dirty tracking per category (project, hierarchical, flow, notes, ui)
  - Selective saving (enable/disable per category)
  - Callbacks: onSaveStart, onSaveComplete, onSaveError
  - Status reporting: saving, dirty, lastSaved, lastError
  - Manual save: saveNow() bypasses debounce
  - Time display: getLastSavedDisplay() for UI
  - Subscribes to StateManager for automatic change detection
  - Convenience functions: startAutoSave(), stopAutoSave()
  - Singleton export: `autoSaveManager`

### Module 4 Complete!
All State & IO System tasks (S4.1-S4.9) are now implemented.

### Files Created
- `v2/state/StateManager.js` - Central state management with events
- `v2/state/Serializer.js` - State serialization with versioning
- `v2/state/StateMigration.js` - Legacy state migration
- `v2/state/AutoSave.js` - Auto-save with debouncing
- `v2/state/io/StorageAdapter.js` - Abstract storage interface
- `v2/state/io/LocalStorageAdapter.js` - localStorage implementation
- `v2/state/io/IndexedDBAdapter.js` - IndexedDB implementation for large data
- `v2/state/stores/ProjectStore.js` - Domain store for project data
- `v2/state/stores/ViewStore.js` - Domain store for view state
- `v2/state/stores/` - Directory for domain stores
- `v2/state/io/` - Directory for storage adapters

### Files Created
- `v2/commands/Command.js` - Base classes
- `v2/commands/CommandManager.js` - Central manager
- `v2/commands/commands/NodeCommands.js` - Create/Delete node commands

---

## Current Work: Module 2 (Node Framework)

### Completed Tasks
- [x] **N2.1** Create `BaseNodeType` class with full interface - `v2/node-types/BaseNodeType.js`
  - Full interface: serialize, deserialize, canConnect, onDoubleClick, clone
  - Supports both class-based and object-based type definitions
  - JSDoc typedefs: PortDefinition, NodeStyle, NodeFeatures, NodeInstance
  - Node normalization: normalizeNode(), normalizeNodes(), validateAndNormalize()
  - Attribute normalization to consistent {name, value} format
  - Preserves type-specific properties during normalization

- [x] **N2.3** Create `NodeFactory` - `v2/node-types/NodeFactory.js`
  - Centralized factory for creating nodes consistently
  - create() - Create node from type definition
  - Convenience methods: createFileNode, createDirectoryNode, createClassNode,
    createFunctionNode, createMethodNode, createSymbolNode, createNoteNode, createGroupNode
  - Clone and duplicate with ID regeneration
  - Batch creation: createMany(), createFromConfigs()
  - Normalization: normalize(), normalizeMany(), normalizeTree(), normalizeFromStorage()
  - Works with NodeTypeRegistry

- [x] **N2.4** Implement node serialization/deserialization - in `BaseNodeType.js`
  - serialize() excludes non-serializable properties (parent, fileObject, _cached)
  - deserialize() recursively handles children
  - Both static and instance method versions

- [x] **N2.5** Add `MethodNode` type - `v2/node-types/code/MethodNode.js`
  - Method-specific properties: visibility, isStatic, isConstructor, isAsync
  - Getter/setter support: isGetter, isSetter
  - Visibility badges: public (green), protected (orange), private (red)
  - Constructor, static, async badges
  - Parameter filtering (excludes `this`/`self`)
  - Parent class reference display
  - Registered in `registerCoreTypes.js`

- [x] **N2.6** Standardize node data structure
  - `BaseNodeType.normalizeNode()` handles property name variations:
    - `title` → `name`, `position.x` → `x`, `label` → `name`
  - Standard structure documented in BaseNodeType
  - `_normalizeAttributes()` converts various formats to [{name, value}]
  - NodeFactory integration: normalize(), normalizeTree(), normalizeFromStorage()
  - validateAndNormalize() returns errors for invalid nodes

- [ ] **N2.2** Refactor existing node types to extend BaseNodeType (optional)
  - Current object-based types work with both registry and factory
  - Low priority since existing types function correctly

### Module 2 Complete!
All essential Node Framework tasks (N2.1, N2.3-N2.6) are now implemented.

### Files Created/Modified
- `v2/node-types/BaseNodeType.js` - Enhanced with full interface, normalization
- `v2/node-types/NodeFactory.js` - Centralized node creation factory
- `v2/node-types/code/MethodNode.js` - New method node type
- `v2/node-types/registerCoreTypes.js` - Added MethodNode registration

---

## Current Work: Module 3 (Connection System)

### Completed Tasks
- [x] **C3.1** Create `ConnectionManager` with CRUD operations - `v2/connections/ConnectionManager.js`
  - Full CRUD: create(), delete(), update(), getById(), getAll()
  - Query methods: getByNode(), getByPort(), getByType(), getBetweenNodes()
  - Batch operations: createMany(), deleteMany(), deleteByNode(), deleteByPort()
  - Reconnection support with validation
  - Event system: on(), off() for created/deleted/updated/reconnected/cleared/loaded
  - Serialization/deserialization with validation
  - Connection type constants: DATA, REFERENCE, FLOW, HIERARCHY
  - Default styles per connection type
  - Singleton export: `connectionManager`

- [x] **C3.2** Implement `ConnectionValidator` with rules - `v2/connections/ConnectionValidator.js`
  - Rule 1: Cannot connect port to itself
  - Rule 2: Input/output port type compatibility
  - Rule 3: Data type compatibility (with coercion support)
  - Rule 4: Max connections per port check
  - Rule 5: Duplicate connection prevention
  - Rule 6: Node type specific rules
  - Custom rule support: addRule(), removeRule(), setRuleEnabled()
  - Data type compatibility matrix with coercion
  - getCompatiblePorts() for finding valid targets
  - validateAllConnections() for bulk validation
  - Configurable: strictTypeChecking, allowSelfConnection
  - Singleton export: `connectionValidator`

- [x] **C3.3** Add connection type definitions - `v2/connections/types/`
  - `ConnectionType.js` - Base class with style, validation, rendering methods
  - `DataConnection.js` - Data flow with type-based coloring
  - `ReferenceConnection.js` - Code references (import, call, extends, etc.)
    - Subtypes: IMPORT, CALL, EXTENDS, IMPLEMENTS, USES, TYPEOF, NEW
  - `FlowConnection.js` - Execution flow with animation
    - Subtypes: SEQUENTIAL, CONDITIONAL, LOOP, CALLBACK, ERROR, RETURN
  - `ConnectionTypeRegistry.js` - Central registry for connection types
    - register(), get(), getAll(), getDefaultStyle()
    - getConnectionStyle(), getStateStyle(), getAnimationConfig()
  - Singleton export: `connectionTypeRegistry`

- [x] **C3.4** Update `PortSystem` with data type support - `v2/core/PortSystem.js`
  - DATA_TYPE_COMPATIBILITY matrix for type checking
  - DATA_TYPE_COERCION for coercible types
  - areTypesCompatible(fromType, toType) method
  - canCoerce(fromType, toType) method
  - getTypeCompatibility() returns 'exact'|'compatible'|'coerce'|'incompatible'
  - getCompatibleTypes() returns all compatible types
  - validateDataTypes() for connection validation
  - validateConnection() for detailed validation results
  - Enhanced canConnect() with checkDataTypes option

- [x] **C3.5** Implement connection labels on bezier curves - `v2/connections/ConnectionRenderer.js`
  - Full rendering with type-based styling
  - Label positioning (start, middle, end)
  - Label background with rounded corners
  - State-based styling (selected, hovered)
  - Arrowhead markers per connection type/color
  - SVG defs for reusable markers
  - Connection hit detection with findConnectionAtPoint()
  - Singleton export: `connectionRenderer`

- [x] **C3.6** Add animated connections for data flow - integrated in ConnectionRenderer
  - Flow animations using SVG animateMotion
  - Configurable dot size, color, duration
  - Type-specific animation speeds
  - Loop connections animate faster
  - Callback connections animate slower

- [x] **C3.7** Create connection context menu - `v2/connections/ConnectionContextMenu.js`
  - Delete connection
  - Edit/add label
  - Toggle animation
  - Toggle label visibility
  - Change connection type (submenu)
  - Change style: color, width, dash pattern (submenus)
  - Keyboard shortcuts (Del for delete, Esc to close)
  - Callbacks: onConnectionModified, onRenderNeeded
  - Singleton export: `connectionContextMenu`

### Module 3 Complete!
All Connection System tasks (C3.1-C3.7) are now implemented.

### Files Created
- `v2/connections/ConnectionManager.js` - CRUD operations and event system
- `v2/connections/ConnectionValidator.js` - Validation rules engine
- `v2/connections/ConnectionRenderer.js` - Visual rendering with labels
- `v2/connections/ConnectionContextMenu.js` - Right-click context menu
- `v2/connections/types/ConnectionType.js` - Base connection type class
- `v2/connections/types/DataConnection.js` - Data flow connections
- `v2/connections/types/ReferenceConnection.js` - Code reference connections
- `v2/connections/types/FlowConnection.js` - Execution flow connections
- `v2/connections/types/ConnectionTypeRegistry.js` - Type registry
- `v2/connections/index.js` - Module exports

### Files Modified
- `v2/core/PortSystem.js` - Added data type compatibility checking

---

## Current Architecture Issues

1. **Parser** - Monolithic, tightly coupled to node creation
2. **State** - Global mutable object, no separation of concerns
3. **Modes** - Logic scattered across files
4. ~~**No undo/redo** - All changes immediate~~ (In progress - Module 7)
5. **No session files** - Only localStorage
6. **Hardcoded shortcuts** - Not customizable

---

## Next Steps (Prioritized)

### Current Focus
All foundation modules complete (1, 2, 3, 4, 7). Ready for:

### Immediate Next
1. **Module 5: Mode System** - Refactor mode switching and state
2. **Module 6: UI Components** - Panel system, toolbars

### After Foundation
3. Module 8: Settings
4. Module 9: Sessions

### Completed Modules
- ✅ Module 1: Parser System
- ✅ Module 2: Node Framework
- ✅ Module 3: Connection System
- ✅ Module 4: State & IO System
- ✅ Module 7: Command System (undo/redo)

---

## Files to Reference

| File | Status |
|------|--------|
| `ARCHITECTURE_PLAN.md` | Complete - master plan |
| `CLAUDE_WORKFLOW.md` | Complete - how to use Claude |
| `CLAUDE.md` | Complete - codebase guide |
| `v2/main.js` | Working - entry point |
| `v2/state.js` | Working - needs refactor |
| `v2/mode-manager.js` | Working - needs refactor |
| `v2/ParserIntegrationModule.js` | Working - needs refactor |
| `v2/commands/Command.js` | **New** - base command classes |
| `v2/commands/CommandManager.js` | **New** - undo/redo manager |
| `v2/commands/commands/NodeCommands.js` | **New** - node create/delete/move commands |
| `v2/commands/commands/ConnectionCommands.js` | **New** - connection commands |
| `v2/parser/BaseParser.js` | **New** - abstract parser base class |

---

## Notes for Next Session

### Available Options:
1. **Module 5: Mode System** - Refactor mode switching
   - BaseMode class
   - Mode-specific state management
   - Cleaner mode transitions

2. **Module 6: UI Components** - Panel system, toolbars
   - Unified panel system
   - Toolbar refactoring
   - Better modal handling

3. **Flow Mode Implementation** - Plan exists in `~/.claude/plans/`
   - Path input for focused flow mode
   - Radial layout for connections
   - Drill-down navigation

### Integration Notes for Module 3:
The new Connection System components need to be integrated with the existing codebase:
- Replace `connectionSystem` usage with `connectionManager` + `connectionRenderer`
- Wire up `connectionContextMenu` to right-click events
- Use `connectionValidator` in EventManager when creating connections
- Register the connection types in main.js initialization

---

## Blocking Issues

None currently - all foundation modules complete.

---

## Test Project

Use `/home/jimmy/projects/ice` for all testing.

Quick test flow:
1. Load ice project via "Load Code"
2. Navigate hierarchical mode
3. Enter flow mode, search `src/iso/scene.js`
4. Create some notes in notes mode
5. Reload page - verify state persisted
