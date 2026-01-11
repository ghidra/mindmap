# Testing Checklist - Modular Node Framework

## Phase 1: Core Infrastructure

- [ ] NodeTypeRegistry
  - [ ] Can register new node types
  - [ ] Can retrieve types by ID
  - [ ] Can retrieve types by category
  - [ ] Can list all categories
  - [ ] Can unregister types

- [ ] BaseNodeType
  - [ ] Creates valid node instances
  - [ ] Applies default properties correctly
  - [ ] Validates node structure
  - [ ] Generates unique IDs

- [ ] PortSystem
  - [ ] Calculates port positions correctly
  - [ ] Handles all 4 sides (left, right, top, bottom)
  - [ ] Determines orientation correctly (horizontal/vertical)
  - [ ] Validates port connections (input/output compatibility)
  - [ ] Manages port lifecycle (add/remove)

## Phase 2: Node Rendering

- [ ] NodeRenderer
  - [ ] Renders nodes with correct positioning
  - [ ] Applies type-specific styling
  - [ ] Renders ports in correct positions
  - [ ] Handles viewport offset correctly
  - [ ] Updates nodes without full re-render
  - [ ] Cleans up removed nodes

- [ ] EventManager
  - [ ] Node dragging works smoothly
  - [ ] Multi-select with Ctrl/Cmd key
  - [ ] Canvas panning with middle mouse / space+drag
  - [ ] Port dragging creates temporary connection
  - [ ] Resize handles work for resizable nodes
  - [ ] Delete button removes nodes
  - [ ] Keyboard shortcuts trigger correctly
  - [ ] Event delegation (no re-binding on render)

## Phase 3: Bezier Connections

- [ ] ConnectionSystem
  - [ ] Draws smooth bezier curves
  - [ ] Control points calculated based on port orientation
  - [ ] Horizontal ports (left/right) have horizontal control points
  - [ ] Vertical ports (top/bottom) have vertical control points
  - [ ] Temporary connection shown during drag
  - [ ] Arrowhead markers display correctly
  - [ ] Connections update with viewport pan
  - [ ] Animated connections work (if enabled)

- [ ] Connection Validation
  - [ ] Can't connect port to itself
  - [ ] Input ports only connect to output ports
  - [ ] Bidirectional ports connect to anything
  - [ ] Duplicate connections prevented

## Phase 4: Core Node Types

### File Node
- [ ] Displays file icon (📄)
- [ ] Shows file path if provided
- [ ] Shows child count if has children
- [ ] Can have children (classes, functions, etc.)
- [ ] Has output port on right

### Class Node
- [ ] Displays class icon (🔷)
- [ ] Shows constructor if present
- [ ] Displays method/property count
- [ ] Has extends port (left)
- [ ] Has instantiated-by port (left)
- [ ] Has output port (right)
- [ ] Blue color scheme

### Function Node
- [ ] Displays function icon (⚡)
- [ ] Shows parameter count
- [ ] Shows async indicator if async
- [ ] Shows return type if specified
- [ ] Has params port (left)
- [ ] Has return port (right)
- [ ] Purple color scheme

### Notes Node
- [ ] Yellow sticky note appearance
- [ ] Resizable
- [ ] 4-sided ports (top, right, bottom, left)
- [ ] Textarea for content
- [ ] Saves on blur

### Text Node
- [ ] Transparent background
- [ ] No ports by default
- [ ] Displays title centered
- [ ] Supports font customization

### Shape Node
- [ ] Displays in different shapes (rectangle, circle, diamond)
- [ ] Resizable
- [ ] 4-sided ports
- [ ] Color customizable

### Group Node
- [ ] Semi-transparent background
- [ ] Dashed border
- [ ] Shows contained node count
- [ ] Drop zone indicator when empty
- [ ] Renders behind other nodes (z-index: 0)

### Passthrough Node
- [ ] Minimal appearance
- [ ] Small size (80x60)
- [ ] Input port (left)
- [ ] Output port (right)
- [ ] Arrow icon

## Phase 5: Group Nodes

- [ ] GroupManager
  - [ ] Can create groups
  - [ ] Adds nodes to group when dragged inside
  - [ ] Removes nodes when dragged outside
  - [ ] Dragging group moves all contained nodes
  - [ ] Bounds checking works correctly
  - [ ] Resizing group removes nodes that don't fit
  - [ ] Group deletion handles contained nodes correctly

- [ ] Visual
  - [ ] Group background visible
  - [ ] Contained nodes render above group
  - [ ] Drop zone shows when empty
  - [ ] Resize handle appears on hover

## Phase 6: Node Creator UI

- [ ] Modal Display
  - [ ] Opens when triggered
  - [ ] Closes on backdrop click
  - [ ] Closes on close button
  - [ ] Closes on cancel
  - [ ] Closes on ESC key

- [ ] Type Selection
  - [ ] All 8 node types displayed
  - [ ] Grouped by category (Code, Organization, Data)
  - [ ] Icons display correctly
  - [ ] Selection highlights card
  - [ ] Loads default ports for selected type

- [ ] Port Configuration
  - [ ] Shows default ports for type
  - [ ] Can add custom ports
  - [ ] Port configuration form works
  - [ ] Can set port side (left/right/top/bottom)
  - [ ] Can set port type (input/output/bidirectional)
  - [ ] Can set port position (0-1)
  - [ ] Can remove ports
  - [ ] Preview updates when ports change

- [ ] Node Creation
  - [ ] Creates node at specified position
  - [ ] Applies custom title and description
  - [ ] Uses configured ports
  - [ ] Adds to state correctly
  - [ ] Triggers render callback
  - [ ] Saves to localStorage

## Phase 7: Details Panel

- [ ] Panel Display
  - [ ] Slides in from right
  - [ ] Shows node icon and type
  - [ ] Displays node title
  - [ ] Hides when close button clicked

- [ ] Basic Properties
  - [ ] Shows node ID (read-only)
  - [ ] Shows position
  - [ ] Shows size

- [ ] Port Information
  - [ ] Lists all ports
  - [ ] Shows port side, type, and label
  - [ ] Color-coded by type (input/output/bidirectional)

- [ ] Group Membership
  - [ ] Shows if node is in a group
  - [ ] Shows group name
  - [ ] Can remove from group
  - [ ] Shows contained nodes if node is a group

- [ ] Type-Specific Properties
  - [ ] File node shows file path and item count
  - [ ] Function node shows async status and parameters
  - [ ] Class node shows constructor and members

- [ ] Style Overrides
  - [ ] Can change background color
  - [ ] Can change border color
  - [ ] Changes save and update immediately

- [ ] Attributes
  - [ ] Shows existing attributes
  - [ ] Can edit attribute values
  - [ ] Can remove attributes
  - [ ] Can add new attributes

## Phase 8: Mode Integration

- [ ] Migration
  - [ ] `migrateLegacyNodes()` converts old format to new
  - [ ] Position format (x, y → position.x, position.y)
  - [ ] Size format (width, height → size.width, size.height)
  - [ ] Style format (color → style.color)
  - [ ] Attributes format (array → object)
  - [ ] `migrateLegacyConnections()` moves connections to state
  - [ ] `cleanupLegacyProperties()` removes old fields
  - [ ] `validateMigration()` detects issues

- [ ] Backward Compatibility
  - [ ] `adaptLegacyNode()` works at runtime
  - [ ] Old nodes render correctly
  - [ ] Both systems can coexist

## Phase 9: Polish & Testing

- [ ] CSS
  - [ ] All components styled consistently
  - [ ] Dark mode works for all components
  - [ ] Responsive on mobile
  - [ ] Animations smooth
  - [ ] Hover states work
  - [ ] Focus states for accessibility

- [ ] Keyboard Shortcuts
  - [ ] `N` - Create new node
  - [ ] `Delete` - Delete selected
  - [ ] `Escape` - Clear selection
  - [ ] `Ctrl+S` - Save
  - [ ] `Ctrl+A` - Select all
  - [ ] `I` - Toggle details panel
  - [ ] `Ctrl++` - Zoom in
  - [ ] `Ctrl+-` - Zoom out
  - [ ] `Ctrl+0` - Reset zoom
  - [ ] `C` - Center view
  - [ ] `?` - Show shortcuts help
  - [ ] Shortcuts don't trigger in text inputs

- [ ] Performance
  - [ ] Renders 100 nodes smoothly
  - [ ] Renders 500 nodes smoothly
  - [ ] Renders 1000 nodes smoothly (may need virtual rendering)
  - [ ] Dragging is responsive
  - [ ] Panning is smooth
  - [ ] Zooming is smooth

- [ ] Save/Load
  - [ ] Saves to localStorage
  - [ ] Loads from localStorage
  - [ ] Preserves all node properties
  - [ ] Preserves connections
  - [ ] Preserves viewport state
  - [ ] Handles corrupted data gracefully

## Cross-Browser Testing

- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## Accessibility

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader support (ARIA labels)
- [ ] Color contrast sufficient
- [ ] No reliance on color alone for information

## Edge Cases

- [ ] Empty state (no nodes)
- [ ] Single node
- [ ] Many nodes (1000+)
- [ ] Deeply nested hierarchies
- [ ] Circular connections (should prevent)
- [ ] Very long node titles
- [ ] Very large nodes
- [ ] Very small nodes
- [ ] Nodes outside viewport
- [ ] Negative positions
- [ ] Overlapping nodes
- [ ] Overlapping groups

## Integration Tests

- [ ] Create node → drag → save → reload → verify position
- [ ] Create connection → save → reload → verify connection
- [ ] Create group → add nodes → save → reload → verify containment
- [ ] Edit node → save → reload → verify changes
- [ ] Delete node → verify connections removed
- [ ] Delete group → verify contained nodes handled

## Regression Tests

Run these after any changes:

- [ ] Basic node creation works
- [ ] Basic connection creation works
- [ ] Dragging nodes works
- [ ] Panning canvas works
- [ ] Save/load works
- [ ] Details panel works

## Performance Benchmarks

Record performance metrics:

- [ ] Time to render 100 nodes: _____ms
- [ ] Time to render 500 nodes: _____ms
- [ ] Time to render 1000 nodes: _____ms
- [ ] FPS during drag (target: 60fps): _____fps
- [ ] FPS during pan (target: 60fps): _____fps
- [ ] Memory usage with 1000 nodes: _____MB

## Documentation

- [ ] Migration guide complete
- [ ] API documentation for each class
- [ ] Usage examples provided
- [ ] Troubleshooting guide created
- [ ] Performance tips documented

## Deployment

- [ ] All files have correct permissions (644)
- [ ] CSS files imported in HTML
- [ ] JS modules imported correctly
- [ ] No console errors
- [ ] No 404s for resources
- [ ] Works with .htaccess configuration
