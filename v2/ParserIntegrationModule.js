/**
 * Integration layer between Parser and v2 visualization
 * Handles loading, parsing, and rendering of code structure
 */

import { ParserAdapter } from './ParserAdapterToNodeGraphConverter.js';
import { createNode } from './nodes.js';
import { state, save } from './state.js';
import { render } from './render.js';
import { DirectoryStructureBuilder } from './DirectoryStructureBuilder.js';

export class ParserIntegration {
  constructor() {
    this.adapter = new ParserAdapter();
  }

  /**
   * Load and parse a code file
   * @param {File} file - File object from input
   */
  async loadFromFile(file) {
    try {
      const code = await file.text();
      const fileName = file.name;

      // Parse the code
      const parseResult = await this.parseCode(code, fileName);
      
      // Load into v2
      await this.loadFromParseResult(parseResult);
      
      return { success: true, fileName };
    } catch (error) {
      console.error('Error loading file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse code using the parser module
   * @param {string} code - Source code text
   * @param {string} fileName - Name of the file
   */
  async parseCode(code, fileName) {
    try {
      // Try to dynamically import parser
      const parserModule = await import('../parser/parser.js');
      
      // Call parseCode function from parser
      let parseResult;
      if (typeof parserModule.parseCode === 'function') {
        parseResult = parserModule.parseCode(code);
      } else if (typeof parserModule.default === 'function') {
        parseResult = parserModule.default(code);
      } else {
        parseResult = this.fallbackParse(code);
      }
      
      // Add filename to result
      return {
        ...parseResult,
        fileName
      };
    } catch (error) {
      return {
        ...this.fallbackParse(code),
        fileName
      };
    }
  }

  /**
   * Fallback parser for basic structure
   */
  fallbackParse(code) {
    const classes = [];
    const functions = [];
    const imports = [];

    // Simple class detection
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const className = match[1];
      const extendsClass = match[2] || null;
      const implementsList = match[3] ? match[3].split(',').map(s => s.trim()) : [];
      
      // Find methods in this class
      const methods = this.extractMethodsFromClass(code, match.index);
      
      classes.push({
        name: className,
        extends: extendsClass,
        implements: implementsList,
        methods: methods,
        properties: []
      });
    }

    // Simple function detection (not in classes)
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    while ((match = functionRegex.exec(code)) !== null) {
      const isExported = code.substring(Math.max(0, match.index - 10), match.index).includes('export');
      const isAsync = code.substring(Math.max(0, match.index - 10), match.index).includes('async');
      
      functions.push({
        name: match[1],
        isAsync: isAsync,
        isExported: isExported,
        parameters: match[2].split(',').map(p => p.trim()).filter(Boolean)
      });
    }

    // Arrow function detection
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(code)) !== null) {
      const isExported = code.substring(Math.max(0, match.index - 10), match.index).includes('export');
      const isAsync = match[0].includes('async');
      
      functions.push({
        name: match[1],
        isAsync: isAsync,
        isExported: isExported,
        parameters: []
      });
    }

    // Simple import detection
    const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))?\s*(?:from\s+)?['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(code)) !== null) {
      const namedImports = match[1] ? match[1].split(',').map(s => s.trim()) : [];
      const defaultImport = match[2];
      const namespaceImport = match[3];
      const module = match[4];
      
      imports.push({
        module: module,
        items: [
          ...(defaultImport ? [defaultImport] : []),
          ...(namespaceImport ? [namespaceImport] : []),
          ...namedImports
        ]
      });
    }

    return { classes, functions, imports };
  }

  /**
   * Extract methods from a class
   */
  extractMethodsFromClass(code, classStartIndex) {
    const methods = [];
    const classCode = code.substring(classStartIndex);
    
    // Find the class body
    const openBrace = classCode.indexOf('{');
    if (openBrace === -1) return methods;
    
    // Simple method detection within class
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    
    while ((match = methodRegex.exec(classCode)) !== null) {
      if (match.index > openBrace && match.index < 2000) { // Rough class body estimate
        methods.push({
          name: match[1],
          isAsync: classCode.substring(Math.max(0, match.index - 10), match.index).includes('async'),
          parameters: match[2].split(',').map(p => p.trim()).filter(Boolean),
          visibility: 'public'
        });
      }
    }
    
    return methods;
  }

  /**
   * Load parsed structure into v2 visualization
   * @param {Object} parseResult - Parsed code structure
   */
  async loadFromParseResult(parseResult) {
    // Clear existing visualization
    this.clearCanvas();

    // Reset adapter counter
    this.adapter.reset();

    // Convert to node graph
    const { nodes, connections } = this.adapter.convertToNodeGraph(parseResult);
    
    console.log(`Creating ${nodes.length} nodes and ${connections.length} connections`);

    // Build node lookup map
    const nodeMap = new Map();

    // Create all nodes first
    nodes.forEach(nodeData => {
      const node = createNode(
        nodeData.x,
        nodeData.y,
        nodeData.label || nodeData.title || 'Node'
      );

      // Preserve adapter data
      node.id = nodeData.id;
      node.level = nodeData.level;
      node.type = nodeData.type;

      // Store metadata (not user attributes)
      if (nodeData.attributes) {
        node.metadata = nodeData.attributes;
      }

      // Store parent reference
      if (nodeData.parent) {
        node.parentId = nodeData.parent;
      }
      
      nodeMap.set(node.id, node);
      state.nodes.push(node);
    });

    // Set up parent-child relationships
    state.nodes.forEach(node => {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          node.parent = parent;
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    });

    // Create connections
    connections.forEach(conn => {
      const fromNode = nodeMap.get(conn.from);
      const toNode = nodeMap.get(conn.to);
      
      if (fromNode && toNode) {
        state.connections.push({
          from: fromNode,
          to: toNode
        });
      }
    });

    // Render everything
    render();
  }

  /**
   * Clear the canvas
   */
  clearCanvas() {
    state.nodes = [];
    state.connections = [];
    state.selectedNode = null;
    
    // Clear canvas DOM
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.innerHTML = '';
    }
    
    // Clear connections SVG
    const svg = document.getElementById('connections');
    if (svg) {
      svg.innerHTML = '';
    }
  }

  /**
   * Export current structure
   */
  exportStructure() {
    return {
      nodes: state.nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        level: node.level,
        attributes: node.attributes,
        x: node.x,
        y: node.y
      })),
      connections: state.connections.map(conn => ({
        from: conn.from.id,
        to: conn.to.id
      }))
    };
  }

  /**
   * Load and visualize a directory structure
   * @param {File[]} files - Array of File objects from directory picker
   */
  async loadFromDirectory(files) {
    try {
      // Clear existing visualization
      this.clearCanvas();
      this.adapter.reset();

      // Build directory tree
      const builder = new DirectoryStructureBuilder();
      const filteredFiles = files.filter(file =>
        builder.shouldInclude(builder.getRelativePath(file))
      );

      // Check for large directories
      if (filteredFiles.length > 500) {
        if (!confirm(`This directory has ${filteredFiles.length} files. Load anyway?`)) {
          return { success: false, cancelled: true };
        }
      }

      if (filteredFiles.length === 0) {
        alert('No parseable JavaScript/TypeScript files found in this directory.');
        return { success: false, error: 'No parseable files found' };
      }

      const directoryTree = builder.buildDirectoryTree(filteredFiles);

      // Get project name from first file's path
      const projectName = filteredFiles.length > 0
        ? filteredFiles[0].webkitRelativePath.split('/')[0]
        : 'Code Project';

      // Convert to node graph
      const { nodes, connections } = await this.convertDirectoryToNodes(
        directoryTree,
        projectName,
        filteredFiles
      );

      // Load into state
      this.loadNodesIntoState(nodes, connections);

      // Render
      render();

      return { success: true, fileCount: filteredFiles.length };
    } catch (error) {
      console.error('Error loading directory:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert directory tree to node graph
   */
  async convertDirectoryToNodes(directoryTree, projectName, allFiles) {
    const nodes = [];
    const connections = [];

    // Create root project node
    const rootNode = this.adapter.createNode({
      label: projectName,
      type: 'project',
      level: 0,
      x: 400,
      y: 50,
      attributes: {
        type: 'project',
        fileCount: allFiles.length
      }
    });
    nodes.push(rootNode);

    // Process directory tree recursively
    const result = await this.processDirectoryNode(
      directoryTree,
      rootNode,
      1,
      400,
      150
    );

    nodes.push(...result.nodes);
    connections.push(...result.connections);

    return { nodes, connections };
  }

  /**
   * Process a directory node and its children
   * Returns only the immediate children, with their children nested
   */
  async processDirectoryNode(dirNode, parentNode, level, startX, startY) {
    const nodes = [];
    const connections = [];

    const totalItems = dirNode.children.length + dirNode.files.length;
    const spacingX = 200;
    const currentX = startX - (totalItems * spacingX / 2);
    let offsetX = 0;

    // Process subdirectories
    for (const subDir of dirNode.children) {
      const dirDisplayNode = this.adapter.createNode({
        label: subDir.name + '/',
        type: 'directory',
        level: level,
        parent: parentNode.id,
        x: currentX + offsetX,
        y: startY,
        attributes: {
          type: 'directory',
          path: subDir.name
        }
      });

      // Only add the directory node itself, not its children
      nodes.push(dirDisplayNode);
      connections.push({
        from: parentNode.id,
        to: dirDisplayNode.id
      });

      // Recursively process children and store them IN the directory node
      const childResult = await this.processDirectoryNode(
        subDir,
        dirDisplayNode,
        level + 1,
        currentX + offsetX,
        startY + 120
      );

      // Store children in the directory node's children array
      // These will be shown when the user clicks "Examine" on the directory
      dirDisplayNode.childNodes = childResult.nodes;
      dirDisplayNode.childConnections = childResult.connections;

      offsetX += spacingX;
    }

    // Process files
    for (const fileNode of dirNode.files) {
      const fileDisplayNode = this.adapter.createNode({
        label: fileNode.name,
        type: 'file',
        level: level,
        parent: parentNode.id,
        x: currentX + offsetX,
        y: startY,
        attributes: {
          type: 'file',
          path: fileNode.file.webkitRelativePath,
          parsed: false
        },
        fileObject: fileNode.file
      });

      nodes.push(fileDisplayNode);
      connections.push({
        from: parentNode.id,
        to: fileDisplayNode.id
      });

      offsetX += spacingX;
    }

    return { nodes, connections };
  }

  /**
   * Examine a file node - parse its content and create child nodes
   * @param {Object} fileNode - The file node to examine
   */
  async examineFile(fileNode) {
    if (!fileNode.fileObject) {
      throw new Error('No file object attached to node');
    }

    try {
      // Read file content
      const code = await fileNode.fileObject.text();
      const fileName = fileNode.fileObject.name;

      // Parse the code
      const parseResult = await this.parseCode(code, fileName);

      // Mark as parsed
      if (!fileNode.metadata) {
        fileNode.metadata = {};
      }
      fileNode.metadata.parsed = true;

      // Convert parse result to child nodes
      const { nodes, connections } = this.convertFileStructureToNodes(
        parseResult,
        fileNode
      );

      // Attach children to file node
      const nodeMap = new Map();

      nodes.forEach(nodeData => {
        const childNode = createNode(
          nodeData.x,
          nodeData.y,
          nodeData.label || nodeData.title || 'Node'
        );

        childNode.id = nodeData.id;
        childNode.level = nodeData.level;
        childNode.type = nodeData.type;
        childNode.parent = fileNode;

        // Store metadata (not user attributes)
        if (nodeData.attributes) {
          childNode.metadata = nodeData.attributes;
        }

        if (!fileNode.children) {
          fileNode.children = [];
        }
        fileNode.children.push(childNode);

        nodeMap.set(childNode.id, childNode);
        state.nodes.push(childNode);
      });

      // Create connections
      connections.forEach(conn => {
        const fromNode = nodeMap.get(conn.from) || fileNode;
        const toNode = nodeMap.get(conn.to);

        if (fromNode && toNode) {
          state.connections.push({
            from: fromNode,
            to: toNode
          });
        }
      });

      // Mark file as expanded
      fileNode.expanded = true;

      save();
    } catch (error) {
      console.error('Error examining file:', error);
      throw error;
    }
  }

  /**
   * Convert parsed file structure to child nodes
   */
  convertFileStructureToNodes(parseResult, parentNode) {
    const nodes = [];
    const connections = [];

    const startX = parentNode.x;
    const startY = parentNode.y + 120;
    let offsetX = 0;
    const spacingX = 150;

    // Process classes
    if (parseResult.classes && parseResult.classes.length > 0) {
      parseResult.classes.forEach(cls => {
        const classNode = this.adapter.createNode({
          label: cls.name,
          type: 'class',
          level: parentNode.level + 1,
          parent: parentNode.id,
          x: startX + offsetX,
          y: startY,
          attributes: {
            type: 'class',
            extends: cls.extends,
            implements: cls.implements
          }
        });

        nodes.push(classNode);
        connections.push({
          from: parentNode.id,
          to: classNode.id
        });

        // Process methods
        if (cls.methods && cls.methods.length > 0) {
          cls.methods.forEach((method, idx) => {
            const methodLabel = typeof method === 'object'
              ? `${method.name}(${(method.parameters || []).join(', ')})`
              : method;

            const methodNode = this.adapter.createNode({
              label: methodLabel,
              type: 'method',
              level: parentNode.level + 2,
              parent: classNode.id,
              x: startX + offsetX,
              y: startY + 80 + (idx * 30),
              attributes: {
                type: 'method',
                name: typeof method === 'object' ? method.name : method
              }
            });

            nodes.push(methodNode);
            connections.push({
              from: classNode.id,
              to: methodNode.id
            });
          });
        }

        offsetX += spacingX;
      });
    }

    // Process functions
    if (parseResult.functions && parseResult.functions.length > 0) {
      parseResult.functions.forEach(fn => {
        const fnLabel = typeof fn === 'object'
          ? `${fn.name}(${(fn.parameters || []).join(', ')})`
          : fn;

        const fnNode = this.adapter.createNode({
          label: fnLabel,
          type: 'function',
          level: parentNode.level + 1,
          parent: parentNode.id,
          x: startX + offsetX,
          y: startY,
          attributes: {
            type: 'function',
            isAsync: typeof fn === 'object' ? (fn.isAsync || false) : false,
            isExported: typeof fn === 'object' ? (fn.isExported || false) : false
          }
        });

        nodes.push(fnNode);
        connections.push({
          from: parentNode.id,
          to: fnNode.id
        });

        offsetX += spacingX;
      });
    }

    // Process imports (as a group)
    if (parseResult.imports && parseResult.imports.length > 0) {
      const importsNode = this.adapter.createNode({
        label: `Imports (${parseResult.imports.length})`,
        type: 'imports',
        level: parentNode.level + 1,
        parent: parentNode.id,
        x: startX + offsetX,
        y: startY,
        attributes: {
          type: 'imports',
          count: parseResult.imports.length,
          imports: parseResult.imports
        }
      });

      nodes.push(importsNode);
      connections.push({
        from: parentNode.id,
        to: importsNode.id
      });
    }

    return { nodes, connections };
  }

  /**
   * Load nodes into state
   * Recursively processes nested node structures
   */
  loadNodesIntoState(nodes, connections) {
    const nodeMap = new Map();

    // Recursive function to convert node data to actual nodes
    const convertNode = (nodeData) => {
      const node = createNode(
        nodeData.x,
        nodeData.y,
        nodeData.label || nodeData.title || 'Node'
      );

      // Preserve adapter data
      node.id = nodeData.id;
      node.level = nodeData.level;
      node.type = nodeData.type;
      node.fileObject = nodeData.fileObject;

      // Store metadata (not user attributes)
      if (nodeData.attributes) {
        node.metadata = nodeData.attributes;
      }

      // Store parent reference
      if (nodeData.parent) {
        node.parentId = nodeData.parent;
      }

      nodeMap.set(node.id, node);

      // Recursively process nested children (for directories)
      if (nodeData.childNodes && nodeData.childNodes.length > 0) {
        node.children = nodeData.childNodes.map(childData => {
          const childNode = convertNode(childData);
          childNode.parent = node;
          return childNode;
        });

        // Add child connections to state
        if (nodeData.childConnections) {
          nodeData.childConnections.forEach(conn => {
            const fromNode = nodeMap.get(conn.from);
            const toNode = nodeMap.get(conn.to);
            if (fromNode && toNode) {
              state.connections.push({
                from: fromNode,
                to: toNode
              });
            }
          });
        }
      }

      return node;
    };

    // Convert all root-level nodes
    nodes.forEach(nodeData => {
      const node = convertNode(nodeData);
      state.nodes.push(node);
    });

    // Set up parent-child relationships for root level
    state.nodes.forEach(node => {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          node.parent = parent;
          if (!parent.children) {
            parent.children = [];
          }
          if (!parent.children.includes(node)) {
            parent.children.push(node);
          }
        }
      }
    });

    // Create root-level connections
    connections.forEach(conn => {
      const fromNode = nodeMap.get(conn.from);
      const toNode = nodeMap.get(conn.to);

      if (fromNode && toNode) {
        state.connections.push({
          from: fromNode,
          to: toNode
        });
      }
    });
  }
}

// Create singleton instance
export const parserIntegration = new ParserIntegration();
