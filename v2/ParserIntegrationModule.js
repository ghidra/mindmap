/**
 * Integration layer between Parser and v2 visualization
 * Handles loading, parsing, and rendering of code structure
 */

import { ParserAdapter } from './ParserAdapterToNodeGraphConverter.js';
import { createNode } from './nodes.js';
import { state, save } from './state.js';
import { render } from './render.js';
import { DirectoryStructureBuilder } from './DirectoryStructureBuilder.js';
import { ASTParser } from './ast-parser.js';

export class ParserIntegration {
  constructor() {
    this.adapter = new ParserAdapter();
    this.astParser = new ASTParser();
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
   * Parse code using the built-in regex parser
   * Supports both standard class declarations and property assignment class expressions
   * @param {string} code - Source code text
   * @param {string} fileName - Name of the file
   */
  async parseCode(code, fileName) {
    // Use the built-in fallback parser which supports:
    // - Standard: class ClassName { }
    // - Property assignment: namespace.ClassName = class { }
    const parseResult = this.fallbackParse(code);

    console.log(`Parsed ${fileName}: ${parseResult.classes?.length || 0} classes, ${parseResult.functions?.length || 0} functions`);

    return {
      ...parseResult,
      fileName,
      parsingMethod: 'regex'
    };
  }

  /**
   * Fallback parser for basic structure
   */
  fallbackParse(code) {
    const classes = [];
    const functions = [];
    const imports = [];
    const variables = [];

    // Track positions of classes and functions to avoid detecting variables inside them
    const classPositions = [];
    const functionPositions = [];

    // Pattern 1: Standard class declaration - class ClassName { }
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const className = match[1];
      const extendsClass = match[2] || null;
      const implementsList = match[3] ? match[3].split(',').map(s => s.trim()) : [];

      // Find the end of the class (roughly)
      const classEnd = this.findMatchingBrace(code, match.index + match[0].length - 1);
      classPositions.push({ start: match.index, end: classEnd });

      // Find methods and properties in this class
      const { methods, properties } = this.extractClassMembers(code, match.index, classEnd);

      classes.push({
        name: className,
        extends: extendsClass,
        implements: implementsList,
        methods: methods,
        properties: properties
      });
    }

    // Pattern 2: Property assignment class expression - namespace.ClassName = class { }
    // Matches: iso.camera = class extends iso.moveable { }
    const classExprRegex = /([\w.]+)\s*=\s*class(?:\s+extends\s+([\w.]+))?\s*\{/g;
    while ((match = classExprRegex.exec(code)) !== null) {
      const fullName = match[1];  // e.g., "iso.camera"
      const extendsClass = match[2] || null;  // e.g., "iso.moveable"

      // Extract just the class name (last part after dot)
      const className = fullName.includes('.') ? fullName.split('.').pop() : fullName;

      // Find the end of the class
      const classEnd = this.findMatchingBrace(code, match.index + match[0].length - 1);
      classPositions.push({ start: match.index, end: classEnd });

      // Find methods and properties in this class
      const { methods, properties } = this.extractClassMembers(code, match.index, classEnd);

      classes.push({
        name: className,
        fullName: fullName,  // Keep the full namespace.name for reference
        extends: extendsClass,
        implements: [],
        methods: methods,
        properties: properties
      });
    }

    // Simple function detection (not in classes)
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((match = functionRegex.exec(code)) !== null) {
      // Skip if inside a class
      if (this.isInsideRange(match.index, classPositions)) continue;

      const isExported = code.substring(Math.max(0, match.index - 10), match.index).includes('export');
      const isAsync = code.substring(Math.max(0, match.index - 10), match.index).includes('async');

      const fnEnd = this.findMatchingBrace(code, match.index + match[0].length - 1);
      functionPositions.push({ start: match.index, end: fnEnd });

      functions.push({
        name: match[1],
        isAsync: isAsync,
        isExported: isExported,
        parameters: match[2].split(',').map(p => p.trim()).filter(Boolean)
      });
    }

    // Arrow function detection (these are also variables, but we treat them as functions)
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(code)) !== null) {
      // Skip if inside a class or function
      if (this.isInsideRange(match.index, [...classPositions, ...functionPositions])) continue;

      const isExported = code.substring(Math.max(0, match.index - 10), match.index).includes('export');
      const isAsync = match[0].includes('async');

      functions.push({
        name: match[1],
        isAsync: isAsync,
        isExported: isExported,
        parameters: []
      });
    }

    // File-level variable detection (const, let, var that aren't functions)
    const varRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*([^;=>\n]+)/g;
    while ((match = varRegex.exec(code)) !== null) {
      // Skip if inside a class or function
      if (this.isInsideRange(match.index, [...classPositions, ...functionPositions])) continue;

      // Skip arrow functions (already handled)
      if (match[2].trim().startsWith('(') || match[2].includes('=>')) continue;
      // Skip function expressions
      if (match[2].trim().startsWith('function')) continue;

      const value = match[2].trim();
      // Truncate long values
      const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;

      variables.push({
        name: match[1],
        value: displayValue,
        kind: match[0].includes('const') ? 'const' : match[0].includes('let') ? 'let' : 'var'
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

    return { classes, functions, imports, variables };
  }

  /**
   * Find the matching closing brace for an opening brace
   */
  findMatchingBrace(code, openIndex) {
    let depth = 1;
    for (let i = openIndex + 1; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      if (depth === 0) return i;
    }
    return code.length;
  }

  /**
   * Check if a position is inside any of the given ranges
   */
  isInsideRange(pos, ranges) {
    return ranges.some(r => pos >= r.start && pos <= r.end);
  }

  /**
   * Extract class members (methods and properties)
   */
  extractClassMembers(code, classStart, classEnd) {
    const methods = [];
    const properties = [];
    const classCode = code.substring(classStart, classEnd);

    // Find the class body start
    const openBrace = classCode.indexOf('{');
    if (openBrace === -1) return { methods, properties };

    // Keywords to exclude from method detection
    const controlFlowKeywords = ['if', 'for', 'while', 'switch', 'catch', 'with', 'function'];

    // Property detection (this.x = ... in constructor)
    const propRegex = /this\.(\w+)\s*=\s*([^;}\n]+)/g;
    let match;
    const seenProps = new Set();

    while ((match = propRegex.exec(classCode)) !== null) {
      if (match.index > openBrace && !seenProps.has(match[1])) {
        seenProps.add(match[1]);
        properties.push({
          name: match[1],
          value: match[2].trim().substring(0, 30)
        });
      }
    }

    // Method detection within class - look for methods at class level (after newline+whitespace)
    // Pattern: newline, optional whitespace, optional async/static, method name, params, brace
    const methodRegex = /(?:^|[\n\r])[\t ]*(?:(async)\s+)?(?:(static)\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;

    while ((match = methodRegex.exec(classCode)) !== null) {
      const isAsync = match[1] === 'async';
      const isStatic = match[2] === 'static';
      const methodName = match[3];
      const params = match[4];

      // Skip control flow keywords
      if (controlFlowKeywords.includes(methodName)) continue;

      // Skip if inside the constructor or another method (rough check - only accept top-level)
      if (match.index > openBrace) {
        methods.push({
          name: methodName,
          isAsync: isAsync,
          isStatic: isStatic,
          parameters: params.split(',').map(p => p.trim()).filter(Boolean),
          visibility: 'public'
        });
      }
    }

    return { methods, properties };
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

      // Reset to hierarchical mode when loading new project
      state.currentMode = 'hierarchical';
      state.path = [];
      state.panX = 0;
      state.panY = 0;

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

      // Detect and store entry point for flow mode
      this.detectAndStoreEntryPoint(state.nodes);

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

    // The directoryTree is a synthetic 'root' with the project folder as first child
    // Process the synthetic root's children and files directly at root level
    // This shows the project contents without an extra wrapper node

    const totalItems = directoryTree.children.length + directoryTree.files.length;
    const spacingX = 200;
    const startX = 400;
    const startY = 50;
    const currentX = startX - (totalItems * spacingX / 2);
    let offsetX = 0;

    // Process subdirectories (usually just the project folder)
    for (const subDir of directoryTree.children) {
      const dirDisplayNode = this.adapter.createNode({
        label: subDir.name + '/',
        type: 'directory',
        level: 0,
        parent: null,
        x: currentX + offsetX,
        y: startY,
        attributes: {
          type: 'directory',
          path: subDir.name
        }
      });

      nodes.push(dirDisplayNode);

      // Recursively process children and store them IN the directory node
      const childResult = await this.processDirectoryNode(
        subDir,
        dirDisplayNode,
        1,
        currentX + offsetX,
        startY + 120
      );

      // Store children in the directory node for lazy loading
      dirDisplayNode.childNodes = childResult.nodes;
      dirDisplayNode.childConnections = childResult.connections;

      offsetX += spacingX;
    }

    // Process root-level files - parse them to determine type
    for (const fileNode of directoryTree.files) {
      const parsedNode = await this.parseAndCreateFileNode(
        fileNode.file,
        null,  // No parent for root-level files
        0,
        currentX + offsetX,
        startY
      );

      nodes.push(parsedNode);
      offsetX += spacingX;
    }

    console.log('Created', nodes.length, 'root-level nodes');

    return { nodes, connections };
  }

  /**
   * Create input ports from function/method parameters
   * @param {Array} params - Array of parameter objects or strings
   * @returns {Array} Array of port definitions
   */
  createParameterPorts(params) {
    if (!params || params.length === 0) return [];

    const ports = [];
    params.forEach((param, idx) => {
      const paramName = typeof param === 'object' ? param.name : param;
      ports.push({
        id: `param-${paramName}`,
        side: 'left',
        type: 'input',
        position: (idx + 1) / (params.length + 1),
        label: paramName
      });
    });

    // Add output port for return value
    ports.push({
      id: 'return',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'return'
    });

    return ports;
  }

  /**
   * Parse a file and create the appropriate node type
   * - Single class file → class node with methods as children
   * - Multiple classes or functions → file node with children
   */
  async parseAndCreateFileNode(file, parentNode, level, x, y) {
    try {
      const code = await file.text();
      const fileName = file.name;

      // Parse the code
      const parseResult = await this.parseCode(code, fileName);

      const classCount = parseResult.classes?.length || 0;
      const functionCount = parseResult.functions?.length || 0;

      // CASE 1: Single class file - create a class node
      if (classCount === 1 && functionCount === 0) {
        const cls = parseResult.classes[0];
        const classNode = this.adapter.createNode({
          label: cls.name,
          type: 'class',
          level: level,
          parent: parentNode?.id,
          x: x,
          y: y,
          attributes: {
            type: 'class',
            extends: cls.extends,
            implements: cls.implements,
            originalFileName: fileName,
            path: file.webkitRelativePath
          },
          fileObject: file
        });

        // Add class properties as attributes
        if (cls.properties && cls.properties.length > 0) {
          classNode.nodeAttributes = {};
          classNode.ports = [];
          cls.properties.forEach((prop, idx) => {
            const propValue = prop.value !== undefined ? String(prop.value).substring(0, 50) : '';
            classNode.nodeAttributes[prop.name] = propValue;
            classNode.ports.push({
              id: `prop-${prop.name}`,
              side: 'left',
              type: 'input',
              position: (idx + 1) / (cls.properties.length + 1),
              label: prop.name
            });
          });
        }

        // Add output port
        if (!classNode.ports) classNode.ports = [];
        classNode.ports.push({
          id: 'class-output',
          side: 'right',
          type: 'output',
          position: 0.5,
          label: 'instance'
        });

        // Create method children
        classNode.childNodes = [];
        let methodOffsetX = 0;
        const methodSpacing = 160;
        const methodStartY = y + 100;

        // Add constructor
        if (cls.constructor) {
          const ctorParams = cls.constructor.parameters || [];
          const ctorNode = this.adapter.createNode({
            label: 'constructor(' + (ctorParams.map(p => typeof p === 'object' ? p.name : p).join(', ') || '') + ')',
            type: 'function',
            level: level + 1,
            parent: classNode.id,
            x: x + methodOffsetX,
            y: methodStartY,
            ports: this.createParameterPorts(ctorParams)
          });
          classNode.childNodes.push(ctorNode);
          methodOffsetX += methodSpacing;
        }

        // Add methods
        if (cls.methods && cls.methods.length > 0) {
          cls.methods.forEach(method => {
            const methodName = typeof method === 'object' ? method.name : method;
            const params = typeof method === 'object' && method.parameters ? method.parameters : [];
            const paramNames = params.map(p => typeof p === 'object' ? p.name : p).join(', ');

            const methodNode = this.adapter.createNode({
              label: `${methodName}(${paramNames})`,
              type: 'function',
              level: level + 1,
              parent: classNode.id,
              x: x + methodOffsetX,
              y: methodStartY,
              attributes: {
                isAsync: typeof method === 'object' ? method.isAsync : false,
                isStatic: typeof method === 'object' ? method.isStatic : false
              },
              ports: this.createParameterPorts(params)
            });
            classNode.childNodes.push(methodNode);
            methodOffsetX += methodSpacing;
          });
        }

        console.log(`Parsed "${fileName}" as class: ${cls.name}`);
        return classNode;
      }

      // CASE 2: Multiple classes, functions, or empty - create file node
      const fileNode = this.adapter.createNode({
        label: fileName,
        type: 'file',
        level: level,
        parent: parentNode?.id,
        x: x,
        y: y,
        attributes: {
          type: 'file',
          path: file.webkitRelativePath,
          parsed: true
        },
        fileObject: file
      });

      fileNode.childNodes = [];
      fileNode.ports = [];
      fileNode.nodeAttributes = {};

      let childOffsetX = 0;
      const childSpacing = 180;
      const childStartY = y + 120;

      // Add file-level variables as attributes and ports
      if (parseResult.variables && parseResult.variables.length > 0) {
        parseResult.variables.forEach((variable, idx) => {
          const varValue = variable.value !== undefined ? String(variable.value).substring(0, 50) : '';
          fileNode.nodeAttributes[variable.name] = varValue;
          fileNode.ports.push({
            id: `var-${variable.name}`,
            side: 'left',
            type: 'input',
            position: (idx + 1) / (parseResult.variables.length + 1),
            label: variable.name
          });
        });
      }

      // Add classes as children
      if (parseResult.classes && parseResult.classes.length > 0) {
        for (const cls of parseResult.classes) {
          const classChildNode = this.adapter.createNode({
            label: cls.name,
            type: 'class',
            level: level + 1,
            parent: fileNode.id,
            x: x + childOffsetX,
            y: childStartY,
            attributes: {
              extends: cls.extends,
              implements: cls.implements
            }
          });

          // Add class methods as childNodes of the class
          classChildNode.childNodes = [];
          if (cls.methods && cls.methods.length > 0) {
            let methodOffset = 0;
            cls.methods.forEach(method => {
              const methodName = typeof method === 'object' ? method.name : method;
              const params = typeof method === 'object' && method.parameters ? method.parameters : [];
              const paramNames = params.map(p => typeof p === 'object' ? p.name : p).join(', ');

              const methodNode = this.adapter.createNode({
                label: `${methodName}(${paramNames})`,
                type: 'function',
                level: level + 2,
                parent: classChildNode.id,
                x: x + childOffsetX + methodOffset,
                y: childStartY + 100,
                ports: this.createParameterPorts(params)
              });
              classChildNode.childNodes.push(methodNode);
              methodOffset += 140;
            });
          }

          fileNode.childNodes.push(classChildNode);
          childOffsetX += childSpacing;
        }
      }

      // Add functions as children
      if (parseResult.functions && parseResult.functions.length > 0) {
        parseResult.functions.forEach(fn => {
          const fnName = typeof fn === 'object' ? fn.name : fn;
          const params = typeof fn === 'object' && fn.parameters ? fn.parameters : [];
          const paramNames = params.map(p => typeof p === 'object' ? p.name : p).join(', ');

          const fnNode = this.adapter.createNode({
            label: `${fnName}(${paramNames})`,
            type: 'function',
            level: level + 1,
            parent: fileNode.id,
            x: x + childOffsetX,
            y: childStartY,
            attributes: {
              isAsync: typeof fn === 'object' ? fn.isAsync : false,
              isExported: typeof fn === 'object' ? fn.isExported : false
            },
            ports: this.createParameterPorts(params)
          });
          fileNode.childNodes.push(fnNode);
          childOffsetX += childSpacing;
        });
      }

      console.log(`Parsed "${fileName}" as file with ${classCount} classes, ${functionCount} functions`);
      return fileNode;

    } catch (error) {
      console.error(`Error parsing file ${file.name}:`, error);
      // Return a basic file node on error
      return this.adapter.createNode({
        label: file.name,
        type: 'file',
        level: level,
        parent: parentNode?.id,
        x: x,
        y: y,
        attributes: {
          type: 'file',
          path: file.webkitRelativePath,
          parsed: false,
          parseError: error.message
        },
        fileObject: file
      });
    }
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

      // Only create connection if there's a parent
      if (parentNode) {
        connections.push({
          from: parentNode.id,
          to: dirDisplayNode.id
        });
      }

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

    // Process files - parse them to determine their type (class or file)
    for (const fileNode of dirNode.files) {
      // Parse the file and create appropriate node type
      const parsedNode = await this.parseAndCreateFileNode(
        fileNode.file,
        parentNode,
        level,
        currentX + offsetX,
        startY
      );

      nodes.push(parsedNode);

      // Only create connection if there's a parent
      if (parentNode) {
        connections.push({
          from: parentNode.id,
          to: parsedNode.id
        });
      }

      offsetX += spacingX;
    }

    return { nodes, connections };
  }

  /**
   * Examine a file node - parse its content and create child nodes
   *
   * Smart file handling:
   * - Single class file → Promote file node to class node
   * - Multiple classes → File node with class children
   * - Functions without class → Children of file node
   * - Methods in class → Children of class node
   *
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

      const classCount = parseResult.classes?.length || 0;
      const functionCount = parseResult.functions?.length || 0;

      // CASE 1: Single class file with no top-level functions
      // Promote the file node to a class node
      if (classCount === 1 && functionCount === 0) {
        this.promoteFileToClass(fileNode, parseResult.classes[0], parseResult.variables);
      }
      // CASE 2: Multiple classes or classes + functions or just functions
      // Keep as file node with children
      else {
        this.populateFileNode(fileNode, parseResult);
      }

      // Mark file as expanded
      fileNode.expanded = true;

      save();
    } catch (error) {
      console.error('Error examining file:', error);
      throw error;
    }
  }

  /**
   * Promote a file node to a class node (single-class file)
   * The file essentially becomes the class
   */
  promoteFileToClass(fileNode, classData, fileVariables) {
    // Change the node type to class
    fileNode.type = 'class';

    // Update title to class name (keep file name in metadata)
    fileNode.metadata.originalFileName = fileNode.title;
    fileNode.title = classData.name;

    // Store class metadata
    fileNode.metadata.extends = classData.extends;
    fileNode.metadata.implements = classData.implements;

    // Initialize arrays
    if (!fileNode.children) fileNode.children = [];
    if (!fileNode.ports) fileNode.ports = [];
    if (!fileNode.attributes) fileNode.attributes = {};

    // Add class properties as attributes and input ports
    if (classData.properties && classData.properties.length > 0) {
      classData.properties.forEach((prop, idx) => {
        const propValue = prop.value !== undefined ? String(prop.value).substring(0, 50) : '';
        fileNode.attributes[prop.name] = propValue;

        fileNode.ports.push({
          id: `prop-${prop.name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (classData.properties.length + 1),
          label: prop.name
        });
      });
    }

    // Add output port for the class
    fileNode.ports.push({
      id: 'class-output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'instance'
    });

    // Add methods as children
    const startX = fileNode.x || 100;
    const startY = (fileNode.y || 100) + 120;
    let offsetX = 0;
    const spacingX = 160;

    // Add constructor if present
    if (classData.constructor) {
      const ctorNode = this.createMethodChildNode(
        { ...classData.constructor, name: 'constructor', isConstructor: true },
        fileNode,
        startX + offsetX,
        startY
      );
      fileNode.children.push(ctorNode);
      offsetX += spacingX;
    }

    // Add methods
    if (classData.methods && classData.methods.length > 0) {
      classData.methods.forEach(method => {
        const methodNode = this.createMethodChildNode(method, fileNode, startX + offsetX, startY);
        fileNode.children.push(methodNode);
        offsetX += spacingX;
      });
    }

    console.log(`Promoted file "${fileNode.metadata.originalFileName}" to class "${classData.name}"`);
  }

  /**
   * Populate a file node with its parsed contents (multiple classes or mixed content)
   */
  populateFileNode(fileNode, parseResult) {
    // Initialize arrays
    if (!fileNode.children) fileNode.children = [];
    if (!fileNode.ports) fileNode.ports = [];
    if (!fileNode.attributes) fileNode.attributes = {};

    const startX = fileNode.x || 100;
    const startY = (fileNode.y || 100) + 120;
    let offsetX = 0;
    const spacingX = 180;

    // Add file-level variables as attributes and input ports
    if (parseResult.variables && parseResult.variables.length > 0) {
      parseResult.variables.forEach((variable, idx) => {
        const varValue = variable.value !== undefined ? String(variable.value).substring(0, 50) : '';
        fileNode.attributes[variable.name] = varValue;

        fileNode.ports.push({
          id: `var-${variable.name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (parseResult.variables.length + 1),
          label: variable.name
        });
      });
    }

    // Add classes as children
    if (parseResult.classes && parseResult.classes.length > 0) {
      parseResult.classes.forEach(cls => {
        const classNode = this.createClassNode(cls, fileNode, startX + offsetX, startY);
        fileNode.children.push(classNode);
        offsetX += spacingX;
      });
    }

    // Add top-level functions as children
    if (parseResult.functions && parseResult.functions.length > 0) {
      parseResult.functions.forEach(fn => {
        const fnNode = this.createFunctionChildNode(fn, fileNode, startX + offsetX, startY);
        fileNode.children.push(fnNode);
        offsetX += spacingX;
      });
    }

    const classCount = parseResult.classes?.length || 0;
    const fnCount = parseResult.functions?.length || 0;
    console.log(`Populated file "${fileNode.title}" with ${classCount} classes and ${fnCount} functions`);
  }

  /**
   * Create a class node with methods as children and properties as attributes/ports
   */
  createClassNode(cls, parentNode, x, y) {
    const classNode = createNode(x, y, cls.name);
    classNode.id = this.adapter.generateId();
    classNode.type = 'class';
    classNode.level = (parentNode.level || 0) + 1;
    classNode.parent = parentNode;
    classNode.children = [];
    classNode.ports = [];
    classNode.attributes = {};

    // Store class metadata
    classNode.metadata = {
      extends: cls.extends,
      implements: cls.implements
    };

    // Add class properties as attributes and input ports
    if (cls.properties && cls.properties.length > 0) {
      cls.properties.forEach((prop, idx) => {
        // Add as attribute
        const propValue = prop.value !== undefined ? String(prop.value).substring(0, 50) : '';
        classNode.attributes[prop.name] = propValue;

        // Add as input port
        classNode.ports.push({
          id: `prop-${prop.name}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (cls.properties.length + 1),
          label: prop.name
        });
      });
    }

    // Add output port for the class
    classNode.ports.push({
      id: 'class-output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'instance'
    });

    const methodStartY = y + 100;
    let methodOffsetX = 0;
    const methodSpacing = 160;

    // Add constructor if present
    if (cls.constructor) {
      const ctorNode = this.createMethodChildNode(
        { ...cls.constructor, name: 'constructor', isConstructor: true },
        classNode,
        x + methodOffsetX,
        methodStartY
      );
      classNode.children.push(ctorNode);
      methodOffsetX += methodSpacing;
    }

    // Add methods as children
    if (cls.methods && cls.methods.length > 0) {
      cls.methods.forEach(method => {
        const methodNode = this.createMethodChildNode(method, classNode, x + methodOffsetX, methodStartY);
        classNode.children.push(methodNode);
        methodOffsetX += methodSpacing;
      });
    }

    return classNode;
  }

  /**
   * Create a function node as a child (no deep parsing)
   */
  createFunctionChildNode(fn, parentNode, x, y) {
    const fnName = typeof fn === 'object' ? fn.name : fn;
    const params = typeof fn === 'object' && fn.parameters ? fn.parameters : [];
    const paramNames = params.map(p => typeof p === 'object' ? p.name : p).join(', ');

    const fnNode = createNode(x, y, `${fnName}(${paramNames})`);
    fnNode.id = this.adapter.generateId();
    fnNode.type = 'function';
    fnNode.level = (parentNode.level || 0) + 1;
    fnNode.parent = parentNode;
    fnNode.ports = [];
    fnNode.attributes = {};

    // Store function metadata
    fnNode.metadata = {
      isAsync: typeof fn === 'object' ? fn.isAsync : false,
      isExported: typeof fn === 'object' ? fn.isExported : false
    };

    // Add parameters as input ports
    if (params.length > 0) {
      params.forEach((param, idx) => {
        const paramName = typeof param === 'object' ? param.name : param;
        fnNode.ports.push({
          id: `param-${paramName}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (params.length + 1),
          label: paramName
        });
      });
    }

    // Add output port
    fnNode.ports.push({
      id: 'fn-output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'return'
    });

    return fnNode;
  }

  /**
   * Create a method node as a child of a class
   */
  createMethodChildNode(method, parentNode, x, y) {
    const methodName = typeof method === 'object' ? method.name : method;
    const params = typeof method === 'object' && method.parameters ? method.parameters : [];
    const paramNames = params.map(p => typeof p === 'object' ? p.name : p).join(', ');

    const methodNode = createNode(x, y, `${methodName}(${paramNames})`);
    methodNode.id = this.adapter.generateId();
    methodNode.type = 'function';
    methodNode.level = (parentNode.level || 0) + 1;
    methodNode.parent = parentNode;
    methodNode.ports = [];

    // Store method metadata
    methodNode.metadata = {
      isAsync: typeof method === 'object' ? method.isAsync : false,
      isStatic: typeof method === 'object' ? method.isStatic : false,
      visibility: typeof method === 'object' ? method.visibility : 'public'
    };

    // Add parameters as input ports
    if (params.length > 0) {
      params.forEach((param, idx) => {
        const paramName = typeof param === 'object' ? param.name : param;
        methodNode.ports.push({
          id: `param-${paramName}`,
          side: 'left',
          type: 'input',
          position: (idx + 1) / (params.length + 1),
          label: paramName
        });
      });
    }

    // Add output port
    methodNode.ports.push({
      id: 'method-output',
      side: 'right',
      type: 'output',
      position: 0.5,
      label: 'return'
    });

    return methodNode;
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

    // Check if this is deep AST parsing (has body info)
    const isDeepParsing = parseResult.parsingMethod === 'ast';

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

        // Process constructor
        if (isDeepParsing && cls.constructor) {
          const ctorResult = this.createMethodNodes(
            cls.constructor,
            classNode,
            parentNode.level + 2,
            startX + offsetX,
            startY + 60
          );
          nodes.push(...ctorResult.nodes);
          connections.push(...ctorResult.connections);
        }

        // Process methods
        if (cls.methods && cls.methods.length > 0) {
          cls.methods.forEach((method, idx) => {
            if (isDeepParsing) {
              // Deep parsing: create method with children
              const methodResult = this.createMethodNodes(
                method,
                classNode,
                parentNode.level + 2,
                startX + offsetX,
                startY + 80 + (idx * 40)
              );
              nodes.push(...methodResult.nodes);
              connections.push(...methodResult.connections);
            } else {
              // Simple parsing: just method node
              const methodLabel = typeof method === 'object'
                ? `${method.name}(${(method.parameters || []).join(', ')})`
                : method;

              const methodNode = this.adapter.createNode({
                label: methodLabel,
                type: 'function',
                level: parentNode.level + 2,
                parent: classNode.id,
                x: startX + offsetX,
                y: startY + 80 + (idx * 30),
                attributes: {
                  type: 'function',
                  name: typeof method === 'object' ? method.name : method
                }
              });

              nodes.push(methodNode);
              connections.push({
                from: classNode.id,
                to: methodNode.id
              });
            }
          });
        }

        // Process properties
        if (isDeepParsing && cls.properties && cls.properties.length > 0) {
          const propsResult = this.createPropertyNodes(
            cls.properties,
            classNode,
            parentNode.level + 2,
            startX + offsetX,
            startY + 100
          );
          nodes.push(...propsResult.nodes);
          connections.push(...propsResult.connections);
        }

        offsetX += spacingX;
      });
    }

    // Process functions
    if (parseResult.functions && parseResult.functions.length > 0) {
      parseResult.functions.forEach(fn => {
        if (isDeepParsing) {
          // Deep parsing: create function with children
          const fnResult = this.createFunctionNodes(
            fn,
            parentNode,
            parentNode.level + 1,
            startX + offsetX,
            startY
          );
          nodes.push(...fnResult.nodes);
          connections.push(...fnResult.connections);
        } else {
          // Simple parsing: just function node
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
        }

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
   * Create method nodes with deep hierarchy (parameters, variables, control flow)
   */
  createMethodNodes(method, parentNode, level, x, y) {
    const nodes = [];
    const connections = [];

    const methodLabel = method.isConstructor
      ? 'constructor'
      : `${method.name}(${(method.parameters || []).map(p => p.name).join(', ')})`;

    const methodNode = this.adapter.createNode({
      label: methodLabel,
      type: 'function',
      level: level,
      parent: parentNode.id,
      x: x,
      y: y,
      attributes: {
        type: 'function',
        name: method.name,
        isAsync: method.isAsync,
        isStatic: method.isStatic
      }
    });

    nodes.push(methodNode);
    connections.push({
      from: parentNode.id,
      to: methodNode.id
    });

    // Create child nodes for method body
    if (method.body) {
      const bodyResult = this.createBodyNodes(method.body, methodNode, method.parameters, level + 1, x, y + 60);
      nodes.push(...bodyResult.nodes);
      connections.push(...bodyResult.connections);
    }

    return { nodes, connections };
  }

  /**
   * Create function nodes with deep hierarchy
   */
  createFunctionNodes(fn, parentNode, level, x, y) {
    const nodes = [];
    const connections = [];

    const fnLabel = `${fn.isAsync ? 'async ' : ''}${fn.name}(${(fn.parameters || []).map(p => p.name).join(', ')})`;

    const fnNode = this.adapter.createNode({
      label: fnLabel,
      type: 'function',
      level: level,
      parent: parentNode.id,
      x: x,
      y: y,
      attributes: {
        type: 'function',
        isAsync: fn.isAsync,
        isExported: fn.isExported
      }
    });

    nodes.push(fnNode);
    connections.push({
      from: parentNode.id,
      to: fnNode.id
    });

    // Create child nodes for function body
    if (fn.body) {
      const bodyResult = this.createBodyNodes(fn.body, fnNode, fn.parameters, level + 1, x, y + 60);
      nodes.push(...bodyResult.nodes);
      connections.push(...bodyResult.connections);
    }

    return { nodes, connections };
  }

  /**
   * Create body nodes (parameters, variables, control flow, etc.)
   */
  createBodyNodes(body, parentNode, parameters, level, x, y) {
    const nodes = [];
    const connections = [];
    let offsetY = 0;
    const spacingY = 30;

    // Create parameter nodes
    if (parameters && parameters.length > 0) {
      parameters.forEach((param, idx) => {
        const paramLabel = param.defaultValue
          ? `${param.name} = ${param.defaultValue}`
          : param.name;

        const paramNode = this.adapter.createNode({
          label: `param: ${paramLabel}`,
          type: 'parameter',
          level: level,
          parent: parentNode.id,
          x: x,
          y: y + offsetY,
          attributes: {
            type: 'parameter',
            name: param.name,
            defaultValue: param.defaultValue,
            isRest: param.isRest
          }
        });

        nodes.push(paramNode);
        connections.push({
          from: parentNode.id,
          to: paramNode.id
        });

        offsetY += spacingY;
      });
    }

    // Create local variable nodes
    if (body.variables && body.variables.length > 0) {
      body.variables.forEach(variable => {
        const varLabel = variable.value
          ? `${variable.kind} ${variable.name} = ${String(variable.value).substring(0, 30)}`
          : `${variable.kind} ${variable.name}`;

        const varNode = this.adapter.createNode({
          label: varLabel,
          type: 'local-variable',
          level: level,
          parent: parentNode.id,
          x: x,
          y: y + offsetY,
          attributes: {
            type: 'local-variable',
            name: variable.name,
            kind: variable.kind,
            value: variable.value,
            isInstantiation: variable.isInstantiation,
            className: variable.className
          }
        });

        nodes.push(varNode);
        connections.push({
          from: parentNode.id,
          to: varNode.id
        });

        offsetY += spacingY;
      });
    }

    // Create control flow nodes
    if (body.controlFlow && body.controlFlow.length > 0) {
      body.controlFlow.forEach(cf => {
        const cfLabel = cf.condition
          ? `${cf.type} (${String(cf.condition).substring(0, 20)})`
          : cf.type;

        const cfNode = this.adapter.createNode({
          label: cfLabel,
          type: 'control-flow',
          level: level,
          parent: parentNode.id,
          x: x,
          y: y + offsetY,
          attributes: {
            type: 'control-flow',
            flowType: cf.type,
            condition: cf.condition
          }
        });

        nodes.push(cfNode);
        connections.push({
          from: parentNode.id,
          to: cfNode.id
        });

        // Create nodes for branches (limited depth to avoid explosion)
        if (cf.branches && cf.branches.length > 0 && level < (state.parsingConfig?.maxDepth || 6)) {
          cf.branches.forEach((branch, idx) => {
            const branchLabel = `${branch.name}`;

            const branchNode = this.adapter.createNode({
              label: branchLabel,
              type: 'block',
              level: level + 1,
              parent: cfNode.id,
              x: x + 30,
              y: y + offsetY + 30 + (idx * 25),
              attributes: {
                type: 'block',
                name: branch.name
              }
            });

            nodes.push(branchNode);
            connections.push({
              from: cfNode.id,
              to: branchNode.id
            });

            // Recursively create nodes for branch body (variables, nested control flow)
            const branchResult = this.createBodyNodes(branch, branchNode, [], level + 2, x + 60, y + offsetY + 60);
            nodes.push(...branchResult.nodes);
            connections.push(...branchResult.connections);
          });
        }

        offsetY += spacingY + (cf.branches ? cf.branches.length * 30 : 0);
      });
    }

    // Create function call nodes
    if (body.calls && body.calls.length > 0) {
      body.calls.forEach(call => {
        const callLabel = `call: ${call.callee}()`;

        const callNode = this.adapter.createNode({
          label: callLabel,
          type: 'call',
          level: level,
          parent: parentNode.id,
          x: x,
          y: y + offsetY,
          attributes: {
            type: 'call',
            callee: call.callee,
            arguments: call.arguments
          }
        });

        nodes.push(callNode);
        connections.push({
          from: parentNode.id,
          to: callNode.id
        });

        offsetY += spacingY;
      });
    }

    // Create nested function nodes
    if (body.nestedFunctions && body.nestedFunctions.length > 0) {
      body.nestedFunctions.forEach(nestedFn => {
        const nestedResult = this.createFunctionNodes(nestedFn, parentNode, level, x, y + offsetY);
        nodes.push(...nestedResult.nodes);
        connections.push(...nestedResult.connections);

        offsetY += spacingY * 2;
      });
    }

    return { nodes, connections };
  }

  /**
   * Create property nodes
   */
  createPropertyNodes(properties, parentNode, level, x, y) {
    const nodes = [];
    const connections = [];

    properties.forEach((prop, idx) => {
      const propLabel = prop.value
        ? `${prop.name} = ${String(prop.value).substring(0, 20)}`
        : prop.name;

      const propNode = this.adapter.createNode({
        label: propLabel,
        type: 'property',
        level: level,
        parent: parentNode.id,
        x: x,
        y: y + (idx * 30),
        attributes: {
          type: 'property',
          name: prop.name,
          value: prop.value,
          isStatic: prop.isStatic
        }
      });

      nodes.push(propNode);
      connections.push({
        from: parentNode.id,
        to: propNode.id
      });
    });

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

  /**
   * Detect and store entry point for flow mode
   * Searches for index.html, main.js, app.js, or index.js
   * Prioritizes files at higher levels of the hierarchy
   */
  detectAndStoreEntryPoint(nodes) {
    // Entry point priority: HTML first, then main/index JS files
    const entryPointNames = [
      { name: 'index.html', priority: 1, type: 'html' },
      { name: 'main.js', priority: 2, type: 'js-entry' },
      { name: 'index.js', priority: 3, type: 'js-entry' },
      { name: 'app.js', priority: 4, type: 'js' }
    ];

    let bestCandidate = null;
    let bestDepth = Infinity;
    let bestPriority = Infinity;

    // Breadth-first search to prioritize files at higher levels
    const searchLevel = (nodeList, depth) => {
      for (const node of nodeList) {
        const title = node.title ? node.title.toLowerCase() : '';

        // Check if this is an entry point candidate
        for (const candidate of entryPointNames) {
          if (title === candidate.name) {
            // Prefer files at shallower depth, or higher priority if same depth
            if (depth < bestDepth || (depth === bestDepth && candidate.priority < bestPriority)) {
              bestCandidate = node;
              bestDepth = depth;
              bestPriority = candidate.priority;
              console.error(`Found candidate: ${title} at depth ${depth} (priority ${candidate.priority})`);
            }
          }
        }
      }

      // Search children at next depth level
      for (const node of nodeList) {
        if (node.children && node.children.length > 0) {
          searchLevel(node.children, depth + 1);
        }
        if (node.childNodes && node.childNodes.length > 0) {
          searchLevel(node.childNodes, depth + 1);
        }
      }
    };

    // Start breadth-first search from root
    searchLevel(nodes, 0);

    if (bestCandidate) {
      state.flowConfig.entryPoint = bestCandidate.id;
      console.log(`Entry point: ${bestCandidate.title}`);
      save();
    } else {
      console.error('No entry point found in', nodes.length, 'root nodes');
      state.flowConfig.entryPoint = null;
    }
  }
}

// Create singleton instance
export const parserIntegration = new ParserIntegration();
