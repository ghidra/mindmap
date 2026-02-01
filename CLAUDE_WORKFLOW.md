# Claude Workflow Guide

How to effectively use Claude Code agents with this project.

---

## Quick Start

When starting a new Claude session, begin with:

```
Read ARCHITECTURE_PLAN.md and CLAUDE.md.
I want to work on [specific task or module].
```

This ensures Claude has full context before starting work.

---

## Referencing the Plan

### Make Claude Read the Plan First

Always start sessions or major tasks with:

```
Read /srv/http/mindmap/ARCHITECTURE_PLAN.md first,
then work on task [X.X] from Module [N].
```

### Reference Specific Tasks

Tasks in the plan are labeled like `P1.3` (Parser module, task 3). Reference them directly:

```
Implement task P1.3 - Refactor JS parsing into JavaScriptParser class.
Follow the interface defined in the plan.
```

### Reference Interfaces

The plan includes code interfaces. Tell Claude to follow them:

```
Create the ConnectionValidator class following the interface
in ARCHITECTURE_PLAN.md Module 3.
```

---

## Breaking Work Into Agent-Assignable Chunks

### Rule: One Module or Sub-Module Per Agent

Each agent session should focus on ONE coherent piece:

| Good Scope | Bad Scope |
|------------|-----------|
| "Implement ParserRegistry" | "Refactor the whole parser system" |
| "Create BaseNodeType class" | "Fix all node types" |
| "Add undo for node creation" | "Implement all undo/redo" |

### Task Sizing Guidelines

**Small (1 agent, 1 session):**
- Single class implementation
- Single feature addition
- Bug fix with clear scope

**Medium (1 agent, may need continuation):**
- Full sub-module (e.g., all node commands)
- Refactoring a single file into new structure
- Implementing one complete interface

**Large (multiple agents or sessions):**
- Full module implementation
- Cross-cutting refactors
- Features touching many files

### Example: Breaking Down Module 7 (Commands)

Instead of: "Implement the command system"

Break into:
1. Agent 1: "Implement Command base class and CommandManager (tasks CMD7.1, CMD7.2)"
2. Agent 2: "Implement node commands (task CMD7.3, CMD7.4)"
3. Agent 3: "Implement connection commands (task CMD7.5)"
4. Agent 4: "Integrate with EventManager and add shortcuts (CMD7.6, CMD7.7, CMD7.8)"

---

## Maintaining Continuity Across Sessions

### Strategy 1: Task Status Tracking

After each session, update the plan with completed tasks:

```markdown
- [x] **P1.1** Create `BaseParser` abstract class  <!-- DONE 2024-01-15 -->
- [x] **P1.2** Create `ParserRegistry`              <!-- DONE 2024-01-15 -->
- [ ] **P1.3** Refactor JS parsing                  <!-- IN PROGRESS -->
```

### Strategy 2: Session Notes File

Create a session notes file that agents update:

```
/srv/http/mindmap/SESSION_NOTES.md
```

Template:
```markdown
# Session Notes

## Current Focus
Module 1: Parser System

## Last Session (2024-01-15)
- Completed: BaseParser, ParserRegistry
- In Progress: JavaScriptParser - extractReferences() not done
- Blocked: None
- Next: Finish extractReferences, then ProjectParser

## Files Modified
- v2/parser/BaseParser.js (new)
- v2/parser/ParserRegistry.js (new)
- v2/parser/parsers/JavaScriptParser.js (partial)

## Notes for Next Session
The extractReferences function needs to handle:
- Class instantiation: new ClassName()
- Function calls: functionName()
- Property access: object.property
See line 45 in JavaScriptParser.js for TODO
```

### Strategy 3: Git Commits as Checkpoints

Commit after each logical unit of work:

```bash
git add -A
git commit -m "Module 1: Implement BaseParser and ParserRegistry

Tasks completed:
- P1.1 BaseParser abstract class
- P1.2 ParserRegistry with file-type mapping

Next: P1.3 JavaScriptParser refactor"
```

### Strategy 4: In-Code TODOs

Leave clear TODOs when stopping mid-task:

```javascript
// TODO(next-session): Implement reference extraction
// Need to handle: class instantiation, function calls, property access
// See ARCHITECTURE_PLAN.md Module 1 for ProjectData.references format
extractReferences(parsed) {
  throw new Error('Not implemented - continue from here');
}
```

---

## Parallel Agent Work

### Safe to Parallelize (No Conflicts)

These modules are independent and can be worked on simultaneously:

| Agent 1 | Agent 2 | Agent 3 |
|---------|---------|---------|
| Module 1: Parser | Module 7: Commands | Module 8: Settings |
| Module 6: UI styles | Module 3: Connections | Module 9: Sessions |

### Requires Coordination

These depend on each other - work sequentially or merge carefully:

```
Module 4 (State) ──► Module 5 (Modes) ──► Module 9 (Sessions)
                          │
Module 2 (Nodes) ─────────┘
```

### Parallel Work Protocol

When running multiple agents:

1. **Assign non-overlapping files**
   ```
   Agent 1: Only touch v2/parser/*
   Agent 2: Only touch v2/commands/*
   ```

2. **Create integration points last**
   - Each agent creates their module in isolation
   - Final session integrates them in main.js

3. **Use feature flags if needed**
   ```javascript
   // Temporary flag while both systems exist
   const USE_NEW_PARSER = false;
   ```

---

## Prompts for Common Tasks

### Starting a New Module

```
Read ARCHITECTURE_PLAN.md, focus on Module [N].

Create the directory structure and base files for this module.
Implement the core interfaces first, then we'll fill in implementations.

Start with [specific file] following the interface in the plan.
```

### Continuing Incomplete Work

```
Read ARCHITECTURE_PLAN.md and SESSION_NOTES.md.

Continue work on Module [N]. The last session completed [X]
and left off at [specific point].

Pick up from there and complete [specific tasks].
```

### Refactoring Existing Code

```
Read ARCHITECTURE_PLAN.md Module [N].

Refactor [existing file] to follow the new architecture:
1. Keep existing functionality working
2. Extract into new structure defined in plan
3. Update imports in files that use this
4. Test that existing features still work

Do NOT break existing functionality during refactor.
```

### Bug Fix Within Architecture

```
Read ARCHITECTURE_PLAN.md for context.

There's a bug in [module/file]: [description]

Fix it while following the architectural patterns in the plan.
Explain how your fix aligns with the intended architecture.
```

### Adding a New Feature

```
Read ARCHITECTURE_PLAN.md.

I want to add [feature]. This should fit into Module [N].

1. First, explain where this fits in the architecture
2. Propose any additions to the plan if needed
3. Implement following existing patterns
```

---

## Handling Interruptions

### If Context Runs Out Mid-Task

Before the session ends, Claude should:

1. Commit or stash current changes
2. Update SESSION_NOTES.md with:
   - What was completed
   - What's in progress
   - Specific line/function to resume from
   - Any decisions made

### If You Need to Stop Manually

Ask Claude:
```
We need to stop. Please:
1. Save all current work
2. Update SESSION_NOTES.md with progress
3. Add TODO comments at stopping points
4. Summarize what the next session should do first
```

### Resuming After Interruption

```
Read ARCHITECTURE_PLAN.md and SESSION_NOTES.md.
Continue from where we left off. Check the SESSION_NOTES
for specific stopping point and resume from there.
```

---

## Best Practices

### DO

- Start every session with plan context
- Work on one focused task at a time
- Commit frequently with descriptive messages
- Update session notes before ending
- Test changes before moving to next task

### DON'T

- Try to implement multiple modules at once
- Make architectural changes without updating the plan
- Leave code in broken state between sessions
- Skip reading the plan "to save time"
- Ignore the defined interfaces

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `ARCHITECTURE_PLAN.md` | Master architecture and task list |
| `CLAUDE.md` | Codebase conventions and structure |
| `SESSION_NOTES.md` | Current progress and continuation notes |
| `CLAUDE_WORKFLOW.md` | This file - how to work with Claude |

---

## Example Full Workflow

### Day 1: Start Parser Module

```
Session 1:
"Read ARCHITECTURE_PLAN.md. Implement tasks P1.1 and P1.2 -
create BaseParser and ParserRegistry."

[Claude implements, commits]
[Update SESSION_NOTES.md]
[Mark P1.1, P1.2 as done in plan]

Session 2:
"Read ARCHITECTURE_PLAN.md and SESSION_NOTES.md.
Implement P1.3 - refactor JavaScriptParser from existing code."

[Claude implements, commits]
[Context runs out mid-task]
[Claude updates SESSION_NOTES with stopping point]
```

### Day 2: Continue and Start Parallel Work

```
Session 1 (Agent 1 - Parser):
"Read plans and notes. Continue P1.3 from where we left off."

Session 2 (Agent 2 - Commands, parallel):
"Read ARCHITECTURE_PLAN.md. Start Module 7 - implement CMD7.1
and CMD7.2. Only touch v2/commands/ directory."

[Both complete their tasks]
[Both update SESSION_NOTES]
```

### Day 3: Integration

```
Session 1:
"Read all plans and notes. Both Parser and Commands modules
are complete. Integrate them into main.js:
1. Import new parser system
2. Wire up command system to EventManager
3. Test both work together"
```
