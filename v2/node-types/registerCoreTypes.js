/**
 * Register Core Node Types
 * Registers all bundled node types with the registry
 */

import { nodeTypeRegistry } from './NodeTypeRegistry.js';

// Code category
import { FileNodeType } from './code/FileNode.js';
import { DirectoryNodeType } from './code/DirectoryNode.js';
import { ClassNodeType } from './code/ClassNode.js';
import { FunctionNodeType } from './code/FunctionNode.js';
import { MethodNodeType } from './code/MethodNode.js';
import { TerminalNodeType } from './code/TerminalNode.js';

// Organization category
import { NotesNodeType } from './organization/NotesNode.js';
import { TextNodeType } from './organization/TextNode.js';
import { ShapeNodeType } from './organization/ShapeNode.js';
import { GroupNodeType } from './organization/GroupNode.js';

// Data category
import { PassthroughNodeType } from './data/PassthroughNode.js';

/**
 * Register all core node types
 */
export function registerCoreNodeTypes() {
  console.log('Registering core node types...');

  // Code types
  nodeTypeRegistry.register(FileNodeType);
  nodeTypeRegistry.register(DirectoryNodeType);
  nodeTypeRegistry.register(ClassNodeType);
  nodeTypeRegistry.register(FunctionNodeType);
  nodeTypeRegistry.register(MethodNodeType);
  nodeTypeRegistry.register(TerminalNodeType);

  // Organization types
  nodeTypeRegistry.register(NotesNodeType);
  nodeTypeRegistry.register(TextNodeType);
  nodeTypeRegistry.register(ShapeNodeType);
  nodeTypeRegistry.register(GroupNodeType);

  // Data types
  nodeTypeRegistry.register(PassthroughNodeType);

  console.log(`✓ Registered ${nodeTypeRegistry.getAll().length} node types`);

  // Log categories
  const categories = nodeTypeRegistry.getCategories();
  categories.forEach(category => {
    const types = nodeTypeRegistry.getByCategory(category);
    console.log(`  ${category}: ${types.map(t => t.name).join(', ')}`);
  });
}

// Auto-register on module load (commented out - called explicitly in main.js)
// registerCoreNodeTypes();
