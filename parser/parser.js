// Remove acorn import and add a simple JavaScript parser
function parseJavaScript(content) {
  try {
    // First try to parse as a script to validate syntax
    new Function(content);
    
    const ast = {
      type: 'Program',
      body: []
    };

    // Find class declarations
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{([^}]*)}/g;
    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
      const [_, className, parentClass, classBody] = classMatch;
      ast.body.push({
        type: 'ClassDeclaration',
        id: { name: className },
        superClass: parentClass ? { name: parentClass } : null,
        body: {
          type: 'ClassBody',
          body: parseClassBody(classBody)
        }
      });
    }

    // Find function declarations
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{/g;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(content)) !== null) {
      const [_, functionName] = functionMatch;
      ast.body.push({
        type: 'FunctionDeclaration',
        id: { name: functionName }
      });
    }

    // Find variable declarations
    const varRegex = /(?:var|let|const)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
    let varMatch;
    while ((varMatch = varRegex.exec(content)) !== null) {
      const [_, varName] = varMatch;
      ast.body.push({
        type: 'VariableDeclaration',
        declarations: [{
          type: 'VariableDeclarator',
          id: { name: varName }
        }]
      });
    }

    // Find all assignments (both function and non-function)
    // This pattern looks for: identifier.identifier = something
    const assignRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+)\s*=/g;
    let assignMatch;
    const processedAssignments = new Set();

    while ((assignMatch = assignRegex.exec(content)) !== null) {
      const fullPath = assignMatch[1];
      if (!fullPath || processedAssignments.has(fullPath)) continue;

      processedAssignments.add(fullPath);
      const parts = fullPath.split('.');
      if (parts.length < 2) continue;

      // Look ahead to see if this is a function assignment
      const restOfLine = content.slice(assignMatch.index + assignMatch[0].length);
      const isFunction = restOfLine.trim().startsWith('function');

      // Build nested member expression
      let currentObject = { type: 'Identifier', name: parts[0] };
      for (let i = 1; i < parts.length; i++) {
        currentObject = {
          type: 'MemberExpression',
          object: currentObject,
          property: { type: 'Identifier', name: parts[i] }
        };
      }

      ast.body.push({
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          left: currentObject,
          right: {
            type: isFunction ? 'FunctionExpression' : 'Identifier'
          }
        }
      });
    }

    return ast;
  } catch (err) {
    return null;
  }
}

function parseClassBody(classBody) {
  const methods = [];
  const methodRegex = /(\w+)\s*\([^)]*\)\s*{/g;
  let methodMatch;
  
  while ((methodMatch = methodRegex.exec(classBody)) !== null) {
    const [_, methodName] = methodMatch;
    methods.push({
      type: 'MethodDefinition',
      key: { name: methodName },
      kind: 'method'
    });
  }
  
  return methods;
}

function filterFiles(filesContent) {
  console.log('Filtering files...');
  
  // Filter out node_modules, dist, build directories and minified files
  const filteredFiles = Object.entries(filesContent).filter(([filePath]) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const pathSegments = normalizedPath.split('/');
    
    // Check if any segment is node_modules, dist, or build
    const shouldSkip = pathSegments.some(segment => 
      segment === 'node_modules' || segment === 'dist' || segment === 'build'
    );

    // Also skip minified/bundled files
    const isMinified = normalizedPath.match(/\.(min|bundle|chunk)\.js$/);

    if (shouldSkip || isMinified) {
      console.log(`Skipping file: ${filePath}`);
      return false;
    }
    return true;
  });

  console.log(`Found ${filteredFiles.length} files to process after filtering`);
  return Object.fromEntries(filteredFiles);
}

function parseFiles(filesContent) {
  const result = [];
  const filteredFiles = filterFiles(filesContent);

  for (const [filePath, content] of Object.entries(filteredFiles)) {
    try {
      // Skip non-JS files
      if (!filePath.endsWith('.js')) continue;

      const ast = parseJavaScript(content);
      if (!ast) {
        console.error(`Failed to parse ${filePath}`);
        continue;
      }

      const fileData = {
        file: filePath,
        namespaces: new Map(),
        functions: [],
        variables: []
      };

      function createNamespace(name) {
        if (!fileData.namespaces.has(name)) {
          fileData.namespaces.set(name, {
            name: name,
            classes: new Map(),    // Map of classes in this namespace
            functions: [],         // Namespace-level functions
            variables: [],         // Namespace-level variables
            parent: null          // Parent namespace if nested
          });
        }
        return fileData.namespaces.get(name);
      }

      function createClass(namespace, className, parent = null) {
        const namespaceObj = namespace ? fileData.namespaces.get(namespace) : null;
        const classMap = namespaceObj ? namespaceObj.classes : fileData.classes;
        
        if (!classMap.has(className)) {
          classMap.set(className, {
            name: className,
            methods: [],
            variables: [],
            parent: parent,
            namespace: namespace
          });
        }
        return classMap.get(className);
      }

      function addToNamespace(namespace, item, type) {
        if (!namespace) return;
        
        const namespaceObj = fileData.namespaces.get(namespace);
        if (namespaceObj && !namespaceObj[type].includes(item)) {
          namespaceObj[type].push(item);
        }
      }

      function addToFile(item, type) {
        if (!fileData[type].includes(item)) {
          fileData[type].push(item);
        }
      }

      function getNamespaceFromPath(path) {
        const parts = path.split('.');
        return parts.length > 1 ? parts[0] : null;
      }

      function processClass(classNode, fullName, parent = null) {
        if (!classNode) return null;

        const namespace = getNamespaceFromPath(fullName);
        const className = fullName.split('.').pop();
        
        const classInfo = createClass(namespace, className, parent);
        
        // Process class methods and variables
        if (classNode.body && classNode.body.body) {
          classNode.body.body.forEach(node => {
            if (node.type === 'MethodDefinition') {
              if (!classInfo.methods.includes(node.key.name)) {
                classInfo.methods.push(node.key.name);
              }
            } else if (node.type === 'ClassProperty') {
              if (!classInfo.variables.includes(node.key.name)) {
                classInfo.variables.push(node.key.name);
              }
            }
          });
        }

        return classInfo;
      }

      function processObjectAssignment(fullPath, isFunction = false) {
        const parts = fullPath.split('.');
        if (parts.length < 2) return;

        const namespace = parts[0];
        const itemName = parts[parts.length - 1];
        
        // Create namespace if it doesn't exist
        createNamespace(namespace);

        // If it's a direct namespace property (e.g., rad.add)
        if (parts.length === 2) {
          if (isFunction) {
            addToNamespace(namespace, itemName, 'functions');
          } else {
            addToNamespace(namespace, itemName, 'variables');
          }
          return;
        }

        // If it's a class method (e.g., rad.panels.prototype.draw)
        if (parts.includes('prototype')) {
          const className = parts[1];
          const methodName = parts[parts.length - 1];
          const classInfo = createClass(namespace, className);
          if (!classInfo.methods.includes(methodName)) {
            classInfo.methods.push(methodName);
          }
          return;
        }

        // If it's a class property (e.g., rad.panels.someVar)
        const className = parts[1];
        const classInfo = createClass(namespace, className);
        if (!isFunction) {
          if (!classInfo.variables.includes(itemName)) {
            classInfo.variables.push(itemName);
          }
        }
      }

      walkAST(ast, node => {
        switch (node.type) {
          case 'ClassDeclaration': {
            if (node.id && node.id.name) {
              processClass(node, node.id.name);
            }
            break;
          }

          case 'ExpressionStatement': {
            const expr = node.expression;
            if (!expr) break;

            // Handle object property assignments (e.g., rad.add = function() {})
            if (expr.type === 'AssignmentExpression' &&
                expr.left && expr.left.type === 'MemberExpression') {
              const fullPath = flattenMemberExpression(expr.left);
              const isFunction = expr.right && expr.right.type === 'FunctionExpression';
              processObjectAssignment(fullPath, isFunction);
            }

            // Handle variable assignments (e.g., _world = something)
            if (expr.type === 'AssignmentExpression' &&
                expr.left && expr.left.type === 'Identifier') {
              const varName = expr.left.name;
              if (varName.startsWith('_') || /^[A-Z]/.test(varName)) {
                addToFile(varName, 'variables');
              }
            }
            break;
          }

          case 'FunctionDeclaration': {
            if (node.id && node.id.name) {
              addToFile(node.id.name, 'functions');
            }
            break;
          }

          case 'VariableDeclaration': {
            node.declarations.forEach(decl => {
              if (decl.id && decl.id.name) {
                if (decl.id.name.startsWith('_') || /^[A-Z]/.test(decl.id.name)) {
                  addToFile(decl.id.name, 'variables');
                }
                if (decl.init && decl.init.type === 'FunctionExpression') {
                  addToFile(decl.id.name, 'functions');
                }
              }
            });
            break;
          }
        }
      });

      // Convert Maps to arrays for the final output
      const processedData = {
        file: filePath,
        namespaces: Array.from(fileData.namespaces.values()).map(ns => ({
          name: ns.name,
          classes: Array.from(ns.classes.values()),
          functions: ns.functions,
          variables: ns.variables,
          parent: ns.parent
        })),
        functions: fileData.functions,
        variables: fileData.variables
      };

      // Only add files that have content
      if (processedData.namespaces.length > 0 || 
          processedData.functions.length > 0 || 
          processedData.variables.length > 0) {
        result.push(processedData);
      }
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }
  }

  console.log(`Parsing complete. Found ${result.length} files with content`);
  return result;
}

// Basic PHP class parser
function parsePHPClasses(content, filePath) {
  const classes = [];
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{([^}]*)}/g;
  const methodRegex = /(?:public|private|protected)?\s*function\s+(\w+)\s*\(/g;
  
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const [_, className, parentClass, classBody] = match;
    const methods = [];
    let methodMatch;
    
    // Reset regex lastIndex for method search
    methodRegex.lastIndex = 0;
    
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      methods.push(methodMatch[1]);
    }
    
    classes.push({
      name: className,
      methods: methods,
      parent: parentClass || null
    });
    
    console.log(`Found PHP class: ${className} with ${methods.length} methods`);
  }
  
  return classes;
}

function walkAST(node, callback) {
  callback(node);
  for (const key in node) {
    if (node.hasOwnProperty(key)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => c && typeof c.type === 'string' && walkAST(c, callback));
      } else if (child && typeof child.type === 'string') {
        walkAST(child, callback);
      }
    }
  }
}

// Helper: Search inside subtree
function findNode(node, test) {
  let found = null;
  walkAST(node, n => {
    if (!found && test(n)) {
      found = n;
    }
  });
  return found;
}

function flattenMemberExpression(node) {
  if (!node) return null;
  
  if (node.type === 'Identifier') {
    return node.name;
  }
  
  if (node.type === 'MemberExpression') {
    // Handle our simplified AST structure where object is a direct Identifier
    const obj = node.object.type === 'Identifier' ? node.object.name : flattenMemberExpression(node.object);
    const prop = node.property.type === 'Identifier' ? node.property.name : 
                 node.property.type === 'Literal' ? node.property.value : null;
    
    if (obj && prop) {
      return `${obj}.${prop}`;
    }
  }
  
  return null;
}
