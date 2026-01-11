/**
 * Node Flow Tracer - Traces data flow from a specific node
 * Builds focused execution graphs showing only the traced dependency chain
 */

export class NodeFlowTracer {
  constructor() {
    this.visited = new Set();
    this.traceGraph = {
      nodes: [],
      edges: []
    };
    this.executionOrder = 0;
    this.allNodes = [];
  }

  /**
   * Trace data flow from a specific node
   * @param {string} nodeId - ID of node to trace from
   * @param {string} direction - 'forward', 'backward', or 'both'
   * @param {number} maxDepth - Maximum trace depth
   * @returns {Object} Execution graph with traced path only
   */
  async traceFromNode(nodeId, direction = 'forward', maxDepth = 10) {
    console.log(`Starting node trace from ${nodeId} (direction: ${direction}, maxDepth: ${maxDepth})`);

    // Reset state
    this.visited = new Set();
    this.traceGraph = {
      nodes: [],
      edges: []
    };
    this.executionOrder = 0;

    // Get all nodes from hierarchy (flatten tree)
    this.allNodes = this.flattenNodeTree(window.state ? window.state.nodes : []);

    // Find starting node
    const startNode = this.findNodeById(nodeId);
    if (!startNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    console.log(`Tracing from: ${startNode.title} (type: ${startNode.type})`);

    // Trace based on direction
    if (direction === 'forward' || direction === 'both') {
      await this.forwardTrace(startNode, 0, maxDepth);
    }

    if (direction === 'backward' || direction === 'both') {
      // Reset visited for backward trace
      const forwardVisited = new Set(this.visited);
      this.visited = new Set();
      await this.backwardTrace(startNode, 0, maxDepth);

      // Combine visited sets
      forwardVisited.forEach(id => this.visited.add(id));
    }

    console.log(`Trace complete: ${this.traceGraph.nodes.length} nodes, ${this.traceGraph.edges.length} edges`);

    return this.traceGraph;
  }

  /**
   * Forward trace: Follow dependencies from this node
   * Variable → Class instantiation → Class dependencies
   * Function → Functions it calls → Their dependencies
   */
  async forwardTrace(node, depth, maxDepth) {
    if (depth >= maxDepth) return;
    if (this.visited.has(node.id)) return;

    this.visited.add(node.id);

    // Add node to trace graph
    this.addNodeToGraph(node, depth);

    // Trace based on node type
    switch (node.type) {
      case 'local-variable':
        await this.traceVariable(node, depth, maxDepth);
        break;

      case 'function':
      case 'method':
        await this.traceFunction(node, depth, maxDepth);
        break;

      case 'class':
        await this.traceClass(node, depth, maxDepth);
        break;

      case 'call':
        await this.traceCall(node, depth, maxDepth);
        break;

      case 'parameter':
        await this.traceParameter(node, depth, maxDepth);
        break;
    }
  }

  /**
   * Backward trace: Find what depends on this node
   */
  async backwardTrace(node, depth, maxDepth) {
    if (depth >= maxDepth) return;
    if (this.visited.has(node.id)) return;

    this.visited.add(node.id);

    // Add node to trace graph if not already there
    if (!this.traceGraph.nodes.find(gn => gn.id === node.id)) {
      this.addNodeToGraph(node, depth);
    }

    // Find nodes that reference this node
    const referencingNodes = this.findReferencingNodes(node);

    for (const refNode of referencingNodes) {
      this.addEdgeToGraph(refNode.id, node.id, 'references');
      await this.backwardTrace(refNode, depth + 1, maxDepth);
    }
  }

  /**
   * Trace a variable node
   */
  async traceVariable(node, depth, maxDepth) {
    const metadata = node.metadata || node.attributes || {};

    // If variable is a class instantiation, trace to the class
    if (metadata.isInstantiation && metadata.className) {
      const className = metadata.className;
      const classNode = this.findClassByName(className);

      if (classNode) {
        this.addEdgeToGraph(node.id, classNode.id, 'instantiates', node.metadata?.name);
        await this.forwardTrace(classNode, depth + 1, maxDepth);
      } else {
        console.log(`  Class ${className} not found (external)`);
      }
    }

    // Trace to where the variable is used (function calls)
    const usages = this.findVariableUsages(node);
    for (const usage of usages) {
      this.addEdgeToGraph(node.id, usage.id, 'used-in');
      await this.forwardTrace(usage, depth + 1, maxDepth);
    }
  }

  /**
   * Trace a function node
   */
  async traceFunction(node, depth, maxDepth) {
    // Find function calls within this function
    const calls = this.getChildrenByType(node, 'call');

    for (const callNode of calls) {
      this.addEdgeToGraph(node.id, callNode.id, 'contains');
      await this.traceCall(callNode, depth + 1, maxDepth);
    }

    // Find variables within this function (especially instantiations)
    const variables = this.getChildrenByType(node, 'local-variable');

    for (const varNode of variables) {
      this.addEdgeToGraph(node.id, varNode.id, 'declares');
      await this.traceVariable(varNode, depth + 1, maxDepth);
    }

    // Find parameters
    const parameters = this.getChildrenByType(node, 'parameter');

    for (const paramNode of parameters) {
      this.addEdgeToGraph(node.id, paramNode.id, 'has-parameter');
      await this.forwardTrace(paramNode, depth + 1, maxDepth);
    }
  }

  /**
   * Trace a class node
   */
  async traceClass(node, depth, maxDepth) {
    const metadata = node.metadata || node.attributes || {};

    // Trace parent class if it extends another
    if (metadata.extends) {
      const parentClass = this.findClassByName(metadata.extends);
      if (parentClass) {
        this.addEdgeToGraph(node.id, parentClass.id, 'extends');
        await this.forwardTrace(parentClass, depth + 1, maxDepth);
      }
    }

    // Trace methods
    const methods = this.getChildrenByType(node, 'method');
    for (const method of methods) {
      this.addEdgeToGraph(node.id, method.id, 'has-method');
      await this.traceFunction(method, depth + 1, maxDepth);
    }

    // Trace constructor
    const constructor = this.getChildrenByType(node, 'constructor')[0];
    if (constructor) {
      this.addEdgeToGraph(node.id, constructor.id, 'has-constructor');
      await this.traceFunction(constructor, depth + 1, maxDepth);
    }
  }

  /**
   * Trace a function call
   */
  async traceCall(node, depth, maxDepth) {
    const metadata = node.metadata || node.attributes || {};
    const callee = metadata.callee;

    if (!callee) return;

    // Find the function or method being called
    const targetFunction = this.findFunctionByName(callee);

    if (targetFunction) {
      this.addEdgeToGraph(node.id, targetFunction.id, 'calls');
      await this.forwardTrace(targetFunction, depth + 1, maxDepth);
    } else {
      console.log(`  Function ${callee} not found (external or built-in)`);
    }
  }

  /**
   * Trace a parameter node
   */
  async traceParameter(node, depth, maxDepth) {
    // Find where this parameter is passed (callers of parent function)
    const parentFunction = this.findNodeById(node.parentId || (node.parent ? node.parent.id : null));

    if (parentFunction) {
      // Find calls to this function
      const callers = this.findCallersOf(parentFunction);

      for (const caller of callers) {
        this.addEdgeToGraph(caller.id, node.id, 'passes-to');
        await this.forwardTrace(caller, depth + 1, maxDepth);
      }
    }
  }

  /**
   * Add node to trace graph
   */
  addNodeToGraph(node, depth) {
    if (this.traceGraph.nodes.find(gn => gn.id === node.id)) {
      return; // Already added
    }

    this.traceGraph.nodes.push({
      id: node.id,
      originalNode: node,
      depth: depth,
      executionOrder: this.executionOrder++,
      structure: null
    });
  }

  /**
   * Add edge to trace graph
   */
  addEdgeToGraph(fromId, toId, type, label = null) {
    // Check if edge already exists
    const exists = this.traceGraph.edges.find(e =>
      e.from === fromId && e.to === toId && e.type === type
    );

    if (!exists) {
      this.traceGraph.edges.push({
        from: fromId,
        to: toId,
        type: type,
        label: label
      });
    }
  }

  /**
   * Find class node by name
   */
  findClassByName(className) {
    // Handle namespaced names (e.g., "rad.platform" → "platform.js")
    const parts = className.split('.');
    const simpleName = parts[parts.length - 1];

    for (const node of this.allNodes) {
      if (node.type === 'class' && node.title === className) {
        return node;
      }

      // Also check files with this class name
      if (node.type === 'file' && node.title.toLowerCase() === `${simpleName.toLowerCase()}.js`) {
        // Find class node within this file
        const classNode = this.getChildrenByType(node, 'class').find(c => c.title === className || c.title === simpleName);
        if (classNode) return classNode;
      }
    }

    return null;
  }

  /**
   * Find function by name (handles method.name format)
   */
  findFunctionByName(functionName) {
    // Handle method calls (e.g., "this.init" → "init", "engine.start" → "start")
    const parts = functionName.split('.');
    const simpleName = parts[parts.length - 1];

    for (const node of this.allNodes) {
      if ((node.type === 'function' || node.type === 'method') &&
          (node.title.includes(simpleName) || node.metadata?.name === simpleName || node.attributes?.name === simpleName)) {
        return node;
      }
    }

    return null;
  }

  /**
   * Find variable usages (call nodes that reference this variable)
   */
  findVariableUsages(varNode) {
    const usages = [];
    const varName = varNode.metadata?.name || varNode.attributes?.name || varNode.title;

    // Find parent function/method
    const parentFunction = this.findNodeById(varNode.parentId || (varNode.parent ? varNode.parent.id : null));

    if (parentFunction) {
      // Find all call nodes in parent that use this variable
      const calls = this.getChildrenByType(parentFunction, 'call');

      for (const call of calls) {
        const callee = call.metadata?.callee || call.attributes?.callee;
        if (callee && callee.includes(varName)) {
          usages.push(call);
        }
      }
    }

    return usages;
  }

  /**
   * Find nodes that reference this node
   */
  findReferencingNodes(node) {
    const refs = [];

    // Different strategies based on node type
    switch (node.type) {
      case 'function':
      case 'method':
        // Find calls to this function
        refs.push(...this.findCallersOf(node));
        break;

      case 'class':
        // Find instantiations of this class
        refs.push(...this.findInstantiationsOf(node));
        break;

      case 'variable':
      case 'local-variable':
        // Find usages of this variable
        refs.push(...this.findVariableUsages(node));
        break;
    }

    return refs;
  }

  /**
   * Find function calls that call this function
   */
  findCallersOf(functionNode) {
    const callers = [];
    const functionName = functionNode.metadata?.name || functionNode.attributes?.name || functionNode.title;

    for (const node of this.allNodes) {
      if (node.type === 'call') {
        const callee = node.metadata?.callee || node.attributes?.callee;
        if (callee && (callee === functionName || callee.endsWith(`.${functionName}`))) {
          callers.push(node);
        }
      }
    }

    return callers;
  }

  /**
   * Find variable nodes that instantiate this class
   */
  findInstantiationsOf(classNode) {
    const instantiations = [];
    const className = classNode.title || classNode.metadata?.name || classNode.attributes?.name;

    for (const node of this.allNodes) {
      if (node.type === 'local-variable' || node.type === 'variable') {
        const metadata = node.metadata || node.attributes || {};
        if (metadata.isInstantiation && metadata.className === className) {
          instantiations.push(node);
        }
      }
    }

    return instantiations;
  }

  /**
   * Get children of a node by type
   */
  getChildrenByType(node, type) {
    const results = [];

    if (!node) return results;

    // Check direct children
    if (node.children) {
      for (const child of node.children) {
        if (child.type === type) {
          results.push(child);
        }
        // Recursively search
        results.push(...this.getChildrenByType(child, type));
      }
    }

    return results;
  }

  /**
   * Find node by ID in hierarchy
   */
  findNodeById(nodeId) {
    if (!nodeId) return null;

    for (const node of this.allNodes) {
      if (node.id === nodeId) {
        return node;
      }
    }

    return null;
  }

  /**
   * Flatten node tree into array
   */
  flattenNodeTree(nodes) {
    const flat = [];

    const traverse = (nodeList) => {
      for (const node of nodeList) {
        flat.push(node);

        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }

        if (node.childNodes && node.childNodes.length > 0) {
          traverse(node.childNodes);
        }
      }
    };

    traverse(nodes);

    return flat;
  }
}
