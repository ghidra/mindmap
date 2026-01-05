/**
 * Flow Analyzer - Analyzes code execution flow from entry point
 * Builds execution graph by parsing files and tracking dependencies
 */

export class FlowAnalyzer {
  constructor() {
    this.visited = new Set(); // Track visited nodes to avoid cycles
    this.executionGraph = {
      nodes: [],
      edges: []
    };
    this.executionOrder = 0;
  }

  /**
   * Analyze execution flow starting from entry point
   * @param {Object} entryNode - The entry point node (index.html or main.js)
   * @param {Array} allNodes - All nodes in the hierarchy
   * @returns {Object} Execution graph with nodes and edges
   */
  async analyze(entryNode, allNodes) {
    this.visited.clear();
    this.executionGraph = { nodes: [], edges: [] };
    this.executionOrder = 0;
    this.allNodes = allNodes;

    console.log('Flow analysis starting from:', entryNode.title);

    // Analyze primary entry point at depth 0
    await this.analyzeNode(entryNode, 0, null);

    // Auto-detect and include important JS entry files (main.js, index.js)
    // These often exist at the root alongside index.html but may not be referenced
    await this.includeJsEntryPoints(entryNode);

    console.log('Flow analysis complete:', this.executionGraph.nodes.length, 'nodes');

    return this.executionGraph;
  }

  /**
   * Auto-detect and include main.js/index.js entry files
   * Prioritizes files at the same depth as index.html (project root)
   */
  async includeJsEntryPoints(htmlEntryNode) {
    const entryFileNames = ['main.js', 'index.js', 'app.js'];

    for (const fileName of entryFileNames) {
      // Find this file, prioritizing same depth as HTML entry (siblings)
      const jsEntry = this.findNodeByPathWithDepth(fileName, htmlEntryNode);

      if (jsEntry && !this.visited.has(jsEntry.id)) {
        console.log(`  -> Found additional entry point: ${fileName} (same level as ${htmlEntryNode.title})`);
        // Analyze it at depth 1 (as a child of the HTML entry)
        await this.analyzeNode(jsEntry, 1, htmlEntryNode.id);

        // Create a connection from HTML to this JS entry
        this.executionGraph.edges.push({
          from: htmlEntryNode.id,
          to: jsEntry.id,
          type: 'entry'
        });
      }
    }
  }

  /**
   * Find a node by filename, prioritizing siblings of reference node
   * This ensures we get root-level files, not nested ones
   */
  findNodeByPathWithDepth(fileName, referenceNode) {
    const allMatches = [];

    // Find all files with this name
    const search = (nodeList, depth = 0) => {
      for (const node of nodeList) {
        if (node.title && node.title.toLowerCase() === fileName.toLowerCase()) {
          allMatches.push({ node, depth });
        }

        // Search children
        if (node.children && node.children.length > 0) {
          search(node.children, depth + 1);
        }

        // Search childNodes
        if (node.childNodes && node.childNodes.length > 0) {
          search(node.childNodes, depth + 1);
        }
      }
    };

    search(this.allNodes);

    if (allMatches.length === 0) {
      return null;
    }

    // Sort by depth (prefer shallower = closer to root)
    allMatches.sort((a, b) => a.depth - b.depth);

    // Return the shallowest match
    const result = allMatches[0].node;
    console.log(`  -> Found ${fileName} at depth ${allMatches[0].depth} (${allMatches.length} total matches)`);

    return result;
  }

  /**
   * Analyze a single node and its dependencies
   * @param {Object} node - Node to analyze
   * @param {number} depth - Current depth in execution flow
   * @param {string} parentId - ID of parent node in flow
   */
  async analyzeNode(node, depth, parentId) {
    // Skip if already visited (prevent cycles)
    if (this.visited.has(node.id)) {
      return;
    }

    this.visited.add(node.id);

    // Parse file structure for JS files
    let structure = null;
    if (node.fileObject && node.title) {
      const fileName = node.title.toLowerCase();
      if (fileName.endsWith('.js') || fileName.endsWith('.jsx') ||
          fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        try {
          const content = await node.fileObject.text();
          structure = this.parseJavaScriptStructure(content);

          // Store structure in node's flow metadata
          if (!node.flowMetadata) {
            node.flowMetadata = {};
          }
          node.flowMetadata.classes = structure.classes;
          node.flowMetadata.functions = structure.functions;
          node.flowMetadata.variables = structure.variables;
          node.flowMetadata.instantiations = structure.instantiations;

          // Add global variables as node attributes (excluding instantiations)
          // Instantiations will be shown as connected nodes instead
          if (structure.variables && structure.variables.length > 0) {
            if (!node.attributes) {
              node.attributes = [];
            }

            // Only add non-instantiation variables as attributes
            const regularVars = structure.variables.filter(v => !v.isInstantiation);
            const instantiationCount = structure.variables.filter(v => v.isInstantiation).length;

            if (regularVars.length > 0) {
              console.log(`  -> Adding ${regularVars.length} variables to ${node.title}`);
              regularVars.forEach(variable => {
                node.attributes.push({
                  id: `${node.id}-var-${variable.name}`,
                  name: variable.name,
                  value: variable.value,
                  type: 'string'
                });
              });
            }

            if (instantiationCount > 0) {
              console.log(`  -> Found ${instantiationCount} class instantiations in ${node.title}`);
            }
          }

        } catch (error) {
          console.error('Error parsing structure:', error);
        }
      }
    }

    // Add to execution graph
    const graphNode = {
      id: node.id,
      originalNode: node,
      depth: depth,
      executionOrder: this.executionOrder++,
      structure: structure // Include parsed structure in graph node
    };

    this.executionGraph.nodes.push(graphNode);

    // Add edge from parent
    if (parentId) {
      this.executionGraph.edges.push({
        from: parentId,
        to: node.id,
        type: this.getEdgeType(node)
      });
    }

    // Create synthetic child nodes for parsed structure (classes, methods, functions)
    if (structure) {
      await this.createStructureNodes(node, structure, depth);
    }

    // Parse the node to find dependencies
    const dependencies = await this.extractDependencies(node);

    // Recursively analyze dependencies
    for (const dep of dependencies) {
      await this.analyzeNode(dep.node, depth + 1, node.id);
    }
  }

  /**
   * Create synthetic child nodes for parsed code structure
   * @param {Object} parentNode - The file node containing the code
   * @param {Object} structure - Parsed structure {classes, functions}
   * @param {number} parentDepth - Depth of the parent file node
   */
  async createStructureNodes(parentNode, structure, parentDepth) {
    const structureDepth = parentDepth + 1;

    // Create child nodes for functions only
    // Classes are shown as separate file nodes (Engine.js, Renderer.js, etc.)
    // Connections to class files are created when instantiations are detected

    // Ensure parent has children array
    if (!parentNode.children) {
      parentNode.children = [];
    }

    console.log(`  -> Creating ${structure.functions.length} function child nodes for ${parentNode.title}`);

    // Create nodes for standalone functions
    structure.functions.forEach((funcInfo, funcIndex) => {
      const funcNodeId = `${parentNode.id}-function-${funcIndex}`;
      const funcNode = {
        id: funcNodeId,
        title: `${funcInfo.isExported ? 'export ' : ''}${funcInfo.isAsync ? 'async ' : ''}function ${funcInfo.name}()`,
        type: 'function',
        syntheticNode: true,
        parentFileId: parentNode.id,
        x: parentNode.x || 0,
        y: parentNode.y || 0,
        flowX: parentNode.flowX || parentNode.x || 0,
        flowY: parentNode.flowY || parentNode.y || 0,
        children: [],
        connections: [],
        attributes: [],
        expanded: true
      };

      // Add function as child of parent file node
      parentNode.children.push(funcNode);

      // Add function node to execution graph
      this.executionGraph.nodes.push({
        id: funcNodeId,
        originalNode: funcNode,
        depth: structureDepth,
        executionOrder: this.executionOrder++
      });

      // Add edge from file to function
      this.executionGraph.edges.push({
        from: parentNode.id,
        to: funcNodeId,
        type: 'structure'
      });
    });

    // Detect and create class relationship connections
    await this.createClassRelationships(parentNode, structure);
  }

  /**
   * Detect and create connections between related classes
   * Handles: extends, imports, instantiations
   */
  async createClassRelationships(parentNode, structure) {
    if (!parentNode.fileObject) return;

    // 1. Handle class inheritance (extends)
    structure.classes.forEach((classInfo, classIndex) => {
      const classNodeId = `${parentNode.id}-class-${classIndex}`;

      if (classInfo.extends) {
        // Try to find the parent class in the execution graph
        const parentClass = this.findClassNodeByName(classInfo.extends);
        if (parentClass) {
          this.executionGraph.edges.push({
            from: classNodeId,
            to: parentClass.id,
            type: 'extends'
          });
        }
      }
    });

    // 2. Handle class instantiations (new ClassName())
    // Create sibling nodes for class files at the same depth level
    if (structure.instantiations && structure.instantiations.length > 0) {
      for (const inst of structure.instantiations) {
        try {
          // Skip built-in browser APIs and external libraries
          const builtInClasses = ['URLSearchParams', 'URL', 'FormData', 'Headers', 'Request', 'Response', 'WebSocket', 'Worker', 'AudioContext', 'XMLHttpRequest'];
          if (builtInClasses.includes(inst.className)) {
            console.log(`  -> Skipping built-in class: ${inst.className}`);
            continue;
          }

          // Find the file that contains this class
          const classFile = this.findFileContainingClass(inst.className);

          if (classFile) {
            // Get parent node's depth to place class file at next level
            const parentGraphNode = this.executionGraph.nodes.find(n => n.id === parentNode.id);
            const parentDepth = parentGraphNode ? parentGraphNode.depth : 0;
            const classFileDepth = parentDepth + 1; // One level deeper

            // Add class file at deeper level
            if (!this.visited.has(classFile.id)) {
              console.log(`  -> Adding class file ${classFile.title} at depth ${classFileDepth} (parent ${parentNode.title} at depth ${parentDepth})`);
              await this.analyzeNode(classFile, classFileDepth, parentNode.id);
            }

            // Create edge from parent file to class file
            this.executionGraph.edges.push({
              from: parentNode.id,
              to: classFile.id,
              type: 'instantiates',
              label: inst.variableName
            });

            console.log(`  -> ${parentNode.title}: ${inst.variableName} = new ${inst.className}() → ${classFile.title}`);
          } else {
            console.log(`  -> Class ${inst.className} not found in project (likely external)`);
          }
        } catch (error) {
          console.error(`  -> Error processing instantiation of ${inst.className}:`, error);
        }
      }
    }
  }

  /**
   * Find the file node that contains a specific class definition
   * Handles both simple names (Engine) and namespaced names (rad.platform, iso.mouse)
   */
  findFileContainingClass(className) {
    // For namespaced classes (rad.platform), extract parts
    const parts = className.split('.');
    const simpleName = parts[parts.length - 1]; // "platform" from "rad.platform"
    const namespace = parts.length > 1 ? parts.slice(0, -1).join('/') : null; // "rad" or "src/rad"

    // Search through all nodes to find a file containing this class
    const search = (nodeList) => {
      for (const node of nodeList) {
        // Check if this is a file node with the matching path
        // For "rad.platform", look for files like "rad/platform.js" or "platform.js"
        if (node.title && node.title.toLowerCase() === `${simpleName}.js`.toLowerCase()) {
          // Check if the path matches the namespace
          if (namespace) {
            // Check if node has metadata with path containing the namespace
            const nodePath = node.metadata?.path || node.fileObject?.webkitRelativePath || '';
            const expectedPath = `${namespace}/${simpleName}.js`;
            if (nodePath.toLowerCase().includes(namespace.toLowerCase())) {
              console.log(`  -> Matched namespaced class ${className} to ${nodePath}`);
              return node;
            }
          } else {
            // No namespace, just match the filename
            return node;
          }
        }

        // Also check if this is a file node with parsed structure
        if (node.flowMetadata && node.flowMetadata.classes) {
          // Check for exact class name match or simple name match
          const hasClass = node.flowMetadata.classes.some(cls =>
            cls.name === className || cls.name === simpleName
          );
          if (hasClass) {
            return node;
          }
        }

        // Search children
        if (node.children && node.children.length > 0) {
          const found = search(node.children);
          if (found) return found;
        }

        // Search childNodes
        if (node.childNodes && node.childNodes.length > 0) {
          const found = search(node.childNodes);
          if (found) return found;
        }
      }
      return null;
    };

    return search(this.allNodes);
  }

  /**
   * Find a class node by class name in the execution graph
   */
  findClassNodeByName(className) {
    for (const graphNode of this.executionGraph.nodes) {
      const node = graphNode.originalNode;
      if (node.type === 'class' && node.title.includes(`class ${className}`)) {
        return node;
      }
    }
    return null;
  }

  /**
   * Extract dependencies from a node based on its file type
   * @param {Object} node - Node to extract dependencies from
   * @returns {Array} Array of dependency objects {node, type}
   */
  async extractDependencies(node) {
    if (!node.fileObject) {
      console.log('No fileObject for:', node.title);
      return [];
    }

    const fileName = node.title.toLowerCase();

    try {
      const content = await node.fileObject.text();

      if (fileName.endsWith('.html')) {
        return await this.parseHtmlDependencies(content);
      } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
        return await this.parseJavaScriptDependencies(content);
      } else if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        return await this.parseTypeScriptDependencies(content);
      }

      return [];
    } catch (error) {
      console.log('Error extracting dependencies from', node.title, ':', error);
      return [];
    }
  }

  /**
   * Parse HTML file for script dependencies
   * Only tracks internal script files, ignores external URLs
   */
  async parseHtmlDependencies(htmlContent) {
    const dependencies = [];

    // Extract script tags with src attribute
    const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      const scriptPath = match[1];

      // Skip external URLs
      if (this.isExternalUrl(scriptPath)) {
        continue;
      }

      const cleanPath = this.cleanPath(scriptPath);
      const node = this.findNodeByPath(cleanPath);

      if (node) {
        dependencies.push({ node, type: 'script' });
      }
    }

    return dependencies;
  }

  /**
   * Check if a URL is external (not a local file)
   */
  isExternalUrl(path) {
    return path.startsWith('http://') ||
           path.startsWith('https://') ||
           path.startsWith('//') ||
           path.startsWith('cdn.');
  }

  /**
   * Parse JavaScript file for dependencies and structure
   * Extracts imports, classes, methods, and functions
   */
  async parseJavaScriptDependencies(jsContent) {
    const dependencies = [];

    // Extract ES6 imports: import ... from '...'
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(jsContent)) !== null) {
      const importPath = match[1];

      // Skip external imports (node_modules, URLs)
      if (this.isExternalImport(importPath)) {
        console.log('Skipping external import:', importPath);
        continue;
      }

      const cleanPath = this.cleanPath(importPath);
      const node = this.findNodeByPath(cleanPath);

      if (node) {
        dependencies.push({ node, type: 'import' });
      } else {
        console.log('Import not found:', importPath);
      }
    }

    // Extract dynamic imports: import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(jsContent)) !== null) {
      const importPath = match[1];

      if (!this.isExternalImport(importPath)) {
        const cleanPath = this.cleanPath(importPath);
        const node = this.findNodeByPath(cleanPath);

        if (node) {
          dependencies.push({ node, type: 'dynamic-import' });
        }
      }
    }

    return dependencies;
  }

  /**
   * Check if an import is external (node_modules, URLs, etc.)
   */
  isExternalImport(importPath) {
    // Relative imports start with ./ or ../
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return false;
    }

    // Absolute paths starting with / might be internal (project-specific)
    if (importPath.startsWith('/')) {
      return false;
    }

    // Everything else is external (node_modules, etc.)
    return true;
  }

  /**
   * Parse JavaScript file structure (classes, functions, methods, variables)
   * Extracts code structure for visualization
   */
  parseJavaScriptStructure(jsContent) {
    const classes = [];
    const functions = [];
    const variables = [];
    const instantiations = []; // Track class instantiations

    // Extract classes with properties
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
    let match;

    while ((match = classRegex.exec(jsContent)) !== null) {
      const className = match[1];
      const extendsClass = match[2] || null;
      const classStartIndex = match.index;

      // Extract methods and properties from class
      const { methods, properties } = this.extractClassMembers(jsContent, classStartIndex);

      classes.push({
        name: className,
        extends: extendsClass,
        methods: methods,
        properties: properties
      });
    }

    // Extract standalone functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    while ((match = functionRegex.exec(jsContent)) !== null) {
      functions.push({
        name: match[1],
        isAsync: match[0].includes('async'),
        isExported: match[0].includes('export')
      });
    }

    // Extract arrow functions
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(jsContent)) !== null) {
      functions.push({
        name: match[1],
        isAsync: match[0].includes('async'),
        isExported: match[0].includes('export')
      });
    }

    // Extract window.onload / window.addEventListener('load', ...)
    if (jsContent.includes('window.onload') || jsContent.includes('addEventListener')) {
      const onloadMatch = jsContent.match(/window\.onload\s*=\s*function/);
      const addEventMatch = jsContent.match(/addEventListener\s*\(\s*['"]load['"]/);

      if (onloadMatch || addEventMatch) {
        functions.push({
          name: 'window.onload',
          isAsync: false,
          isExported: false,
          isEntryPoint: true // Mark as special
        });
      }
    }

    // Extract global variables (top-level const/let/var that aren't functions)
    const varRegex = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*([^;=\n]+)/gm;
    while ((match = varRegex.exec(jsContent)) !== null) {
      const varName = match[1];
      const varValue = match[2].trim();

      // Check if it's a class instantiation (new ClassName() or new namespace.ClassName())
      // Matches: new Engine(), new rad.platform(), new iso.mouse(), etc.
      const newMatch = varValue.match(/^new\s+([\w.]+)\s*\(/);
      if (newMatch) {
        const className = newMatch[1]; // Could be "Engine" or "rad.platform"
        instantiations.push({
          variableName: varName,
          className: className,
          isExported: match[0].includes('export')
        });
        // Also add as a variable
        variables.push({
          name: varName,
          value: `new ${className}()`,
          isExported: match[0].includes('export'),
          isInstantiation: true
        });
      } else if (!varValue.match(/^\s*(?:async\s*)?\([^)]*\)\s*=>/)) {
        // Skip arrow functions, but include other variables
        variables.push({
          name: varName,
          value: varValue.substring(0, 50), // Limit length
          isExported: match[0].includes('export'),
          isInstantiation: false
        });
      }
    }

    return { classes, functions, variables, instantiations };
  }

  /**
   * Extract methods and properties from a class
   */
  extractClassMembers(code, classStartIndex) {
    const methods = [];
    const properties = [];
    const classCode = code.substring(classStartIndex);

    // Find the class body
    let braceCount = 0;
    let classBodyStart = -1;
    let classBodyEnd = -1;

    for (let i = 0; i < classCode.length; i++) {
      if (classCode[i] === '{') {
        if (braceCount === 0) {
          classBodyStart = i;
        }
        braceCount++;
      } else if (classCode[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          classBodyEnd = i;
          break;
        }
      }
    }

    if (classBodyStart === -1 || classBodyEnd === -1) {
      return { methods, properties };
    }

    const classBody = classCode.substring(classBodyStart + 1, classBodyEnd);

    // Extract class properties (field declarations)
    // Match: propertyName = value; or propertyName;
    const propertyRegex = /^\s*(?:static\s+)?(\w+)\s*(?:=\s*([^;]+))?;/gm;
    let match;

    while ((match = propertyRegex.exec(classBody)) !== null) {
      const propName = match[1];
      const propValue = match[2] ? match[2].trim().substring(0, 30) : 'undefined';

      // Skip if it looks like a method call
      if (!propName.match(/^(if|for|while|return|const|let|var)$/)) {
        properties.push({
          name: propName,
          value: propValue,
          isStatic: match[0].includes('static')
        });
      }
    }

    // Extract methods in class body
    const methodRegex = /(?:async\s+)?(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const methodName = match[1];

      // Skip constructor
      if (methodName === 'constructor') {
        continue;
      }

      methods.push({
        name: methodName,
        isAsync: match[0].includes('async'),
        isStatic: match[0].includes('static')
      });
    }

    return { methods, properties };
  }

  /**
   * Parse TypeScript file for dependencies
   */
  async parseTypeScriptDependencies(tsContent) {
    // For now, treat TypeScript like JavaScript
    // TODO: Handle TypeScript-specific syntax (type imports, etc.)
    return await this.parseJavaScriptDependencies(tsContent);
  }

  /**
   * Clean and normalize file paths
   */
  cleanPath(path) {
    // Remove leading ./ or /
    path = path.replace(/^\.?\//, '');

    // Add .js extension if missing (common in imports)
    if (!path.match(/\.(js|ts|jsx|tsx|html)$/)) {
      path += '.js';
    }

    return path;
  }

  /**
   * Find a node by file path in the hierarchy
   */
  findNodeByPath(path) {
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Search through all nodes recursively
    const search = (nodeList) => {
      for (const node of nodeList) {
        // Check if filename matches
        if (node.title && node.title.toLowerCase() === fileName.toLowerCase()) {
          return node;
        }

        // Search children
        if (node.children && node.children.length > 0) {
          const found = search(node.children);
          if (found) return found;
        }

        // Search childNodes
        if (node.childNodes && node.childNodes.length > 0) {
          const found = search(node.childNodes);
          if (found) return found;
        }
      }
      return null;
    };

    return search(this.allNodes);
  }

  /**
   * Determine edge type based on node
   */
  getEdgeType(node) {
    const fileName = node.title ? node.title.toLowerCase() : '';

    if (fileName.endsWith('.html')) {
      return 'script';
    } else if (fileName.endsWith('.js') || fileName.endsWith('.ts') ||
               fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) {
      return 'import';
    }

    return 'unknown';
  }
}
