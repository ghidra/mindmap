# Session Notes

## Current State

**Date**: 2024-01-15
**Overall Status**: Pre-refactor - existing code works, architecture plan created

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

## Current Architecture Issues

1. **Parser** - Monolithic, tightly coupled to node creation
2. **State** - Global mutable object, no separation of concerns
3. **Modes** - Logic scattered across files
4. **No undo/redo** - All changes immediate
5. **No session files** - Only localStorage
6. **Hardcoded shortcuts** - Not customizable

---

## Next Steps (Prioritized)

### Immediate (Pick One to Start)
1. **Module 1: Parser** - Foundation for everything else
2. **Module 4: State** - Needed for proper save/load
3. **Module 7: Commands** - Can be added incrementally

### After Foundation
4. Module 2: Node Framework refactor
5. Module 3: Connection System
6. Module 5: Mode refactor

### Polish Phase
7. Module 6: UI Components
8. Module 8: Settings
9. Module 9: Sessions

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

---

## Notes for Next Session

### If Starting Parser (Module 1):
1. Read ARCHITECTURE_PLAN.md Module 1 section
2. Create `v2/parser/` directory structure
3. Start with `BaseParser.js` interface
4. Then `ParserRegistry.js`
5. Then extract from `ParserIntegrationModule.js` into `JavaScriptParser.js`

### If Starting State (Module 4):
1. Read ARCHITECTURE_PLAN.md Module 4 section
2. Create `v2/state/` directory structure
3. Start with `StorageAdapter.js` interface
4. Then `LocalStorageAdapter.js`
5. Then `StateManager.js`
6. Finally migrate from `state.js`

### If Starting Commands (Module 7):
1. Read ARCHITECTURE_PLAN.md Module 7 section
2. Create `v2/commands/` directory
3. Start with `Command.js` base class
4. Then `CommandManager.js`
5. Then one command type (e.g., `CreateNodeCommand`)
6. Wire into EventManager

---

## Blocking Issues

None currently - ready to start refactor work.

---

## Test Project

Use `/home/jimmy/projects/ice` for all testing.

Quick test flow:
1. Load ice project via "Load Code"
2. Navigate hierarchical mode
3. Enter flow mode, search `src/iso/scene.js`
4. Create some notes in notes mode
5. Reload page - verify state persisted
