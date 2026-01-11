/**
 * AST Parser - Deep code structure extraction using Acorn
 * Provides detailed parsing of JavaScript code including:
 * - Functions with parameters, local variables, and nested functions
 * - Classes with methods, properties, and constructors
 * - Control flow (if/for/while/switch)
 * - Variable declarations and assignments
 * - Function calls and scope tracking
 */

// Import Acorn parser from CDN
const acornModule = import('https://cdn.jsdelivr.net/npm/acorn@8.11.3/+esm');
const walkModule = import('https://cdn.jsdelivr.net/npm/acorn-walk@8.3.2/+esm');

export class ASTParser {
  constructor() {
    this.acorn = null;
    this.walk = null;
    this.initialized = false;
  }

  /**
   * Initialize Acorn modules
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.acorn = await acornModule;
      this.walk = await walkModule;
      this.initialized = true;
      console.log('AST Parser initialized with Acorn');
    } catch (error) {
      console.error('Failed to load Acorn:', error);
      throw new Error('AST Parser initialization failed');
    }
  }

  /**
   * Parse a JavaScript file and extract detailed structure
   * @param {string} code - Source code
   * @param {string} fileName - File name for error reporting
   * @returns {Object} Parsed structure
   */
  async parseFile(code, fileName) {
    await this.initialize();

    try {
      // Parse code to AST
      const ast = this.acorn.parse(code, {
        ecmaVersion: 2023,
        sourceType: 'module',
        locations: true
      });

      // Extract structure from AST
      const structure = this.extractStructure(ast, code);

      console.log(`AST parsed ${fileName}:`, {
        classes: structure.classes.length,
        functions: structure.functions.length,
        variables: structure.variables.length
      });

      return structure;

    } catch (error) {
      console.error(`AST parsing failed for ${fileName}:`, error.message);
      throw error; // Let caller handle fallback
    }
  }

  /**
   * Extract complete structure from AST
   * @param {Object} ast - Acorn AST
   * @param {string} code - Original source code
   * @returns {Object} Structure object
   */
  extractStructure(ast, code) {
    const structure = {
      classes: [],
      functions: [],
      variables: [],
      imports: [],
      exports: [],
      instantiations: []
    };

    // Create scope analyzer
    const scopeAnalyzer = new ScopeAnalyzer();
    const globalScope = scopeAnalyzer.buildScopeChain(ast);

    // Walk the AST and extract elements
    this.walk.simple(ast, {
      ClassDeclaration: (node) => {
        structure.classes.push(this.extractClass(node, code, globalScope));
      },

      FunctionDeclaration: (node) => {
        structure.functions.push(this.extractFunction(node, code, globalScope));
      },

      VariableDeclaration: (node) => {
        // Only extract top-level variables
        if (node.loc && node.loc.start.column === 0) {
          const vars = this.extractVariables(node, code, globalScope);
          structure.variables.push(...vars);

          // Check for instantiations
          vars.forEach(v => {
            if (v.isInstantiation) {
              structure.instantiations.push({
                variableName: v.name,
                className: v.className,
                isExported: v.isExported
              });
            }
          });
        }
      },

      ImportDeclaration: (node) => {
        structure.imports.push(this.extractImport(node, code));
      },

      ExportNamedDeclaration: (node) => {
        if (node.declaration) {
          structure.exports.push(this.extractExport(node, code));
        }
      },

      ExportDefaultDeclaration: (node) => {
        structure.exports.push(this.extractExport(node, code));
      }
    });

    return structure;
  }

  /**
   * Extract class information
   */
  extractClass(node, code, scope) {
    const classInfo = {
      name: node.id ? node.id.name : 'AnonymousClass',
      extends: node.superClass ? node.superClass.name : null,
      implements: [], // JavaScript doesn't have implements, but TypeScript does
      constructor: null,
      methods: [],
      properties: [],
      isExported: false
    };

    // Extract class body
    if (node.body && node.body.body) {
      node.body.body.forEach(member => {
        if (member.type === 'MethodDefinition') {
          if (member.kind === 'constructor') {
            classInfo.constructor = this.extractMethod(member, code, scope, true);
          } else {
            classInfo.methods.push(this.extractMethod(member, code, scope, false));
          }
        } else if (member.type === 'PropertyDefinition') {
          classInfo.properties.push(this.extractProperty(member, code));
        }
      });
    }

    return classInfo;
  }

  /**
   * Extract method information
   */
  extractMethod(node, code, scope, isConstructor = false) {
    const methodInfo = {
      name: isConstructor ? 'constructor' : (node.key ? node.key.name : 'anonymous'),
      isAsync: node.value && node.value.async === true,
      isStatic: node.static === true,
      isConstructor: isConstructor,
      visibility: 'public', // JavaScript doesn't have visibility, default to public
      parameters: [],
      body: {
        variables: [],
        controlFlow: [],
        calls: [],
        nestedFunctions: [],
        returns: []
      }
    };

    // Extract parameters
    if (node.value && node.value.params) {
      methodInfo.parameters = node.value.params.map(param => this.extractParameter(param));
    }

    // Extract body
    if (node.value && node.value.body) {
      this.extractFunctionBody(node.value.body, methodInfo.body, code, scope);
    }

    return methodInfo;
  }

  /**
   * Extract function information
   */
  extractFunction(node, code, scope) {
    const functionInfo = {
      name: node.id ? node.id.name : 'anonymous',
      isAsync: node.async === true,
      isExported: false, // Will be set by parent export node
      isGenerator: node.generator === true,
      parameters: [],
      body: {
        variables: [],
        controlFlow: [],
        calls: [],
        nestedFunctions: [],
        returns: []
      }
    };

    // Extract parameters
    if (node.params) {
      functionInfo.parameters = node.params.map(param => this.extractParameter(param));
    }

    // Extract body
    if (node.body) {
      this.extractFunctionBody(node.body, functionInfo.body, code, scope);
    }

    return functionInfo;
  }

  /**
   * Extract parameter information
   */
  extractParameter(node) {
    if (node.type === 'Identifier') {
      return {
        name: node.name,
        type: 'Identifier',
        defaultValue: null,
        isRest: false
      };
    } else if (node.type === 'AssignmentPattern') {
      return {
        name: node.left.name,
        type: 'Identifier',
        defaultValue: this.extractValue(node.right),
        isRest: false
      };
    } else if (node.type === 'RestElement') {
      return {
        name: node.argument.name,
        type: 'Identifier',
        defaultValue: null,
        isRest: true
      };
    }

    return {
      name: 'unknown',
      type: node.type,
      defaultValue: null,
      isRest: false
    };
  }

  /**
   * Extract function body contents
   */
  extractFunctionBody(bodyNode, bodyInfo, code, scope) {
    if (!bodyNode || !bodyNode.body) return;

    const statements = bodyNode.body;

    statements.forEach(statement => {
      switch (statement.type) {
        case 'VariableDeclaration':
          const vars = this.extractVariables(statement, code, scope);
          bodyInfo.variables.push(...vars);
          break;

        case 'IfStatement':
        case 'ForStatement':
        case 'WhileStatement':
        case 'SwitchStatement':
          bodyInfo.controlFlow.push(this.extractControlFlow(statement, code, scope));
          break;

        case 'ExpressionStatement':
          if (statement.expression && statement.expression.type === 'CallExpression') {
            bodyInfo.calls.push(this.extractCall(statement.expression, code));
          }
          break;

        case 'ReturnStatement':
          bodyInfo.returns.push(this.extractReturn(statement, code));
          break;

        case 'FunctionDeclaration':
          bodyInfo.nestedFunctions.push(this.extractFunction(statement, code, scope));
          break;
      }
    });
  }

  /**
   * Extract variable declarations
   */
  extractVariables(node, code, scope) {
    const variables = [];

    if (node.declarations) {
      node.declarations.forEach(declarator => {
        const varInfo = {
          name: declarator.id ? declarator.id.name : 'unknown',
          kind: node.kind, // const, let, var
          value: null,
          isExported: false,
          isInstantiation: false,
          className: null
        };

        // Extract initialization value
        if (declarator.init) {
          varInfo.value = this.extractValue(declarator.init);

          // Check for class instantiation
          if (declarator.init.type === 'NewExpression' && declarator.init.callee) {
            varInfo.isInstantiation = true;
            varInfo.className = this.extractCalleeNam(declarator.init.callee);
          }
        }

        variables.push(varInfo);
      });
    }

    return variables;
  }

  /**
   * Extract control flow statement
   */
  extractControlFlow(node, code, scope) {
    const controlFlow = {
      type: null,
      condition: null,
      branches: []
    };

    switch (node.type) {
      case 'IfStatement':
        controlFlow.type = 'if';
        controlFlow.condition = this.extractValue(node.test);

        // Then branch
        if (node.consequent) {
          const thenBody = {
            name: 'then',
            variables: [],
            controlFlow: [],
            calls: []
          };
          this.extractBlockBody(node.consequent, thenBody, code, scope);
          controlFlow.branches.push(thenBody);
        }

        // Else branch
        if (node.alternate) {
          const elseBody = {
            name: 'else',
            variables: [],
            controlFlow: [],
            calls: []
          };
          this.extractBlockBody(node.alternate, elseBody, code, scope);
          controlFlow.branches.push(elseBody);
        }
        break;

      case 'ForStatement':
        controlFlow.type = 'for';
        controlFlow.condition = this.extractValue(node.test);

        const forBody = {
          name: 'body',
          variables: [],
          controlFlow: [],
          calls: []
        };
        this.extractBlockBody(node.body, forBody, code, scope);
        controlFlow.branches.push(forBody);
        break;

      case 'WhileStatement':
        controlFlow.type = 'while';
        controlFlow.condition = this.extractValue(node.test);

        const whileBody = {
          name: 'body',
          variables: [],
          controlFlow: [],
          calls: []
        };
        this.extractBlockBody(node.body, whileBody, code, scope);
        controlFlow.branches.push(whileBody);
        break;

      case 'SwitchStatement':
        controlFlow.type = 'switch';
        controlFlow.condition = this.extractValue(node.discriminant);

        if (node.cases) {
          node.cases.forEach(caseNode => {
            const caseBody = {
              name: caseNode.test ? `case ${this.extractValue(caseNode.test)}` : 'default',
              variables: [],
              controlFlow: [],
              calls: []
            };

            caseNode.consequent.forEach(statement => {
              if (statement.type === 'VariableDeclaration') {
                caseBody.variables.push(...this.extractVariables(statement, code, scope));
              } else if (statement.type === 'ExpressionStatement' &&
                         statement.expression.type === 'CallExpression') {
                caseBody.calls.push(this.extractCall(statement.expression, code));
              }
            });

            controlFlow.branches.push(caseBody);
          });
        }
        break;
    }

    return controlFlow;
  }

  /**
   * Extract block body (for control flow)
   */
  extractBlockBody(node, bodyInfo, code, scope) {
    if (!node) return;

    const statements = node.type === 'BlockStatement' ? node.body : [node];

    statements.forEach(statement => {
      switch (statement.type) {
        case 'VariableDeclaration':
          bodyInfo.variables.push(...this.extractVariables(statement, code, scope));
          break;

        case 'IfStatement':
        case 'ForStatement':
        case 'WhileStatement':
          bodyInfo.controlFlow.push(this.extractControlFlow(statement, code, scope));
          break;

        case 'ExpressionStatement':
          if (statement.expression && statement.expression.type === 'CallExpression') {
            bodyInfo.calls.push(this.extractCall(statement.expression, code));
          }
          break;
      }
    });
  }

  /**
   * Extract function call
   */
  extractCall(node, code) {
    return {
      callee: this.extractCalleeName(node.callee),
      arguments: node.arguments ? node.arguments.map(arg => this.extractValue(arg)) : []
    };
  }

  /**
   * Extract callee name from call expression
   */
  extractCalleeName(node) {
    if (!node) return 'unknown';

    if (node.type === 'Identifier') {
      return node.name;
    } else if (node.type === 'MemberExpression') {
      const object = this.extractCalleeName(node.object);
      const property = node.property ? node.property.name : 'unknown';
      return `${object}.${property}`;
    } else if (node.type === 'CallExpression') {
      return this.extractCalleeName(node.callee);
    }

    return 'unknown';
  }

  /**
   * Extract return statement
   */
  extractReturn(node, code) {
    return {
      value: node.argument ? this.extractValue(node.argument) : null
    };
  }

  /**
   * Extract property information
   */
  extractProperty(node, code) {
    return {
      name: node.key ? node.key.name : 'unknown',
      value: node.value ? this.extractValue(node.value) : null,
      isStatic: node.static === true
    };
  }

  /**
   * Extract import information
   */
  extractImport(node, code) {
    const importInfo = {
      module: node.source ? node.source.value : 'unknown',
      items: []
    };

    if (node.specifiers) {
      node.specifiers.forEach(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          importInfo.items.push(spec.local.name);
        } else if (spec.type === 'ImportSpecifier') {
          importInfo.items.push(spec.imported.name);
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          importInfo.items.push(spec.local.name);
        }
      });
    }

    return importInfo;
  }

  /**
   * Extract export information
   */
  extractExport(node, code) {
    const exportInfo = {
      type: node.type === 'ExportDefaultDeclaration' ? 'default' : 'named',
      items: []
    };

    if (node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration') {
        exportInfo.items.push(node.declaration.id ? node.declaration.id.name : 'default');
      } else if (node.declaration.type === 'ClassDeclaration') {
        exportInfo.items.push(node.declaration.id ? node.declaration.id.name : 'default');
      } else if (node.declaration.type === 'VariableDeclaration') {
        node.declaration.declarations.forEach(decl => {
          if (decl.id) {
            exportInfo.items.push(decl.id.name);
          }
        });
      }
    }

    return exportInfo;
  }

  /**
   * Extract value as string (for display)
   */
  extractValue(node) {
    if (!node) return 'null';

    switch (node.type) {
      case 'Literal':
        return String(node.value);

      case 'Identifier':
        return node.name;

      case 'BinaryExpression':
        return `${this.extractValue(node.left)} ${node.operator} ${this.extractValue(node.right)}`;

      case 'MemberExpression':
        const obj = this.extractValue(node.object);
        const prop = node.property ? node.property.name : 'unknown';
        return `${obj}.${prop}`;

      case 'CallExpression':
        const callee = this.extractCalleeName(node.callee);
        return `${callee}()`;

      case 'NewExpression':
        const className = this.extractCalleeName(node.callee);
        return `new ${className}()`;

      case 'ObjectExpression':
        return '{ ... }';

      case 'ArrayExpression':
        return '[ ... ]';

      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        return '() => { ... }';

      default:
        return `<${node.type}>`;
    }
  }
}

/**
 * Scope Analyzer - Build scope chain and track variable bindings
 */
export class ScopeAnalyzer {
  constructor() {
    this.scopes = [];
  }

  /**
   * Build scope chain from AST
   */
  buildScopeChain(ast) {
    const globalScope = {
      type: 'global',
      parent: null,
      bindings: new Map(),
      children: []
    };

    this.scopes = [globalScope];

    // Walk AST and build scope tree
    // (Simplified - full implementation would track all scopes)

    return globalScope;
  }

  /**
   * Resolve variable references to their declarations
   */
  resolveReferences(node, scope) {
    // TODO: Implement reference resolution
    // This would track where variables are declared vs. where they're used
    return null;
  }
}
