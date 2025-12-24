
/**
 * Adapter to convert Parser AST output to v2 node structure
 * Bridges the gap between parser's hierarchical code structure and v2's node graph
 */

export class ParserAdapter {
  constructor() {
    this.nodeIdCounter = 0;
  }

  /**
   * Convert parser output to v2 node graph
   * @param {Object} parseResult - Output from parser containing AST
   * @returns {Object} - { nodes: [], connections: [] }
   */
  convertToNodeGraph(parseResult) {
    const nodes = [];
    const connections = [];
    
    // Create root node for the file/project
    const rootNode = this.createNode({
      label: parseResult.fileName || 'Code Structure',
      type: 'file',
      level: 0,
      x: 400,
      y: 50,
      attributes: {
        type: 'root',
        fileName: parseResult.fileName,
        language: this.detectLanguage(parseResult.fileName)
      }
    });
    nodes.push(rootNode);

    // Process top-level declarations
    if (parseResult.classes && parseResult.classes.length > 0) {
      const result = this.processClasses(parseResult.classes, rootNode, 1);
      nodes.push(...result.nodes);
      connections.push(...result.connections);
    }

    if (parseResult.functions && parseResult.functions.length > 0) {
      const result = this.processFunctions(parseResult.functions, rootNode, 1);
      nodes.push(...result.nodes);
      connections.push(...result.connections);
    }

    if (parseResult.imports && parseResult.imports.length > 0) {
      const result = this.processImports(parseResult.imports, rootNode, 1);
      nodes.push(...result.nodes);
      connections.push(...result.connections);
    }

    return { nodes, connections };
  }

  /**
   * Process class declarations
   */
  processClasses(classes, parentNode, level) {
    const nodes = [];
    const connections = [];
    const startX = parentNode.x - (classes.length * 75);
    
    classes.forEach((cls, index) => {
      const classNode = this.createNode({
        label: cls.name,
        type: 'class',
        level: level,
        parent: parentNode.id,
        x: startX + (index * 150),
        y: parentNode.y + 120,
        attributes: {
          type: 'class',
          extends: cls.extends,
          implements: cls.implements,
          visibility: cls.visibility || 'public',
          isAbstract: cls.isAbstract || false
        }
      });

      nodes.push(classNode);
      connections.push({
        from: parentNode.id,
        to: classNode.id
      });

      // Process methods
      if (cls.methods && cls.methods.length > 0) {
        const methodsResult = this.processMethods(cls.methods, classNode, level + 1);
        nodes.push(...methodsResult.nodes);
        connections.push(...methodsResult.connections);
      }

      // Process properties
      if (cls.properties && cls.properties.length > 0) {
        const propsResult = this.processProperties(cls.properties, classNode, level + 1);
        nodes.push(...propsResult.nodes);
        connections.push(...propsResult.connections);
      }

      // Process nested classes
      if (cls.nestedClasses && cls.nestedClasses.length > 0) {
        const nestedResult = this.processClasses(cls.nestedClasses, classNode, level + 1);
        nodes.push(...nestedResult.nodes);
        connections.push(...nestedResult.connections);
      }
    });

    return { nodes, connections };
  }

  /**
   * Process method declarations
   */
  processMethods(methods, parentNode, level) {
    const nodes = [];
    const connections = [];
    const startX = parentNode.x - (methods.length * 50);

    methods.forEach((method, index) => {
      const methodNode = this.createNode({
        label: this.formatMethodLabel(method),
        type: 'method',
        level: level,
        parent: parentNode.id,
        x: startX + (index * 100),
        y: parentNode.y + 100,
        attributes: {
          type: 'method',
          name: method.name,
          visibility: method.visibility || 'public',
          isStatic: method.isStatic || false,
          isAsync: method.isAsync || false,
          parameters: method.parameters || [],
          returnType: method.returnType,
          body: method.body
        }
      });

      nodes.push(methodNode);
      connections.push({
        from: parentNode.id,
        to: methodNode.id
      });
    });

    return { nodes, connections };
  }

  /**
   * Process property/field declarations
   */
  processProperties(properties, parentNode, level) {
    const nodes = [];
    const connections = [];
    const startX = parentNode.x - (properties.length * 40);

    properties.forEach((prop, index) => {
      const propNode = this.createNode({
        label: `${prop.name}: ${prop.type || 'any'}`,
        type: 'property',
        level: level,
        parent: parentNode.id,
        x: startX + (index * 80),
        y: parentNode.y + 100,
        attributes: {
          type: 'property',
          name: prop.name,
          dataType: prop.type,
          visibility: prop.visibility || 'public',
          isStatic: prop.isStatic || false,
          defaultValue: prop.defaultValue
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
   * Process function declarations (top-level)
   */
  processFunctions(functions, parentNode, level) {
    const nodes = [];
    const connections = [];
    const startX = parentNode.x - (functions.length * 50);

    functions.forEach((fn, index) => {
      const fnNode = this.createNode({
        label: this.formatFunctionLabel(fn),
        type: 'function',
        level: level,
        parent: parentNode.id,
        x: startX + (index * 100),
        y: parentNode.y + 120,
        attributes: {
          type: 'function',
          name: fn.name,
          isAsync: fn.isAsync || false,
          isExported: fn.isExported || false,
          parameters: fn.parameters || [],
          returnType: fn.returnType
        }
      });

      nodes.push(fnNode);
      connections.push({
        from: parentNode.id,
        to: fnNode.id
      });
    });

    return { nodes, connections };
  }

  /**
   * Process import statements
   */
  processImports(imports, parentNode, level) {
    const nodes = [];
    const connections = [];

    if (imports.length === 0) return { nodes, connections };

    // Create a single "Imports" grouping node
    const importsNode = this.createNode({
      label: `Imports (${imports.length})`,
      type: 'imports',
      level: level,
      parent: parentNode.id,
      x: parentNode.x + 200,
      y: parentNode.y + 120,
      attributes: {
        type: 'imports',
        count: imports.length,
        imports: imports.map(imp => ({
          module: imp.module || imp,
          items: imp.items || []
        }))
      }
    });

    nodes.push(importsNode);
    connections.push({
      from: parentNode.id,
      to: importsNode.id
    });

    return { nodes, connections };
  }

  /**
   * Format method label with signature
   */
  formatMethodLabel(method) {
    const params = method.parameters 
      ? method.parameters.map(p => p.name || p).join(', ')
      : '';
    return `${method.name}(${params})`;
  }

  /**
   * Format function label with signature
   */
  formatFunctionLabel(fn) {
    const params = fn.parameters 
      ? fn.parameters.map(p => p.name || p).join(', ')
      : '';
    const asyncPrefix = fn.isAsync ? 'async ' : '';
    return `${asyncPrefix}${fn.name}(${params})`;
  }

  /**
   * Detect language from filename
   */
  detectLanguage(filename) {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'react',
      'tsx': 'react-typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'c++',
      'c': 'c',
      'cs': 'c#',
      'go': 'go',
      'rs': 'rust'
    };
    return langMap[ext] || ext;
  }

  /**
   * Create a node with unique ID
   */
  createNode({ label, type, level, parent, x, y, attributes = {} }) {
    return {
      id: `node-${this.nodeIdCounter++}`,
      label,
      type,
      level,
      parent: parent || null,
      x,
      y,
      attributes,
      collapsed: false
    };
  }

  /**
   * Reset counter for new parse
   */
  reset() {
    this.nodeIdCounter = 0;
  }
}
