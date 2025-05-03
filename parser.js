function parseFiles(filesContent) {
  const result = [];

  for (const [filePath, content] of Object.entries(filesContent)) {
    try {
      const ast = acorn.parse(content, { ecmaVersion: 2020, sourceType: 'module' });

      const fileData = {
        file: filePath,
        classes: [], // { name, methods }
        functions: [],
        variables: []
      };

      const potentialConstructors = {};
      const prototypeMethods = {};

      walkAST(ast, node => {
        switch (node.type) {
          case 'FunctionDeclaration':
            if (node.id && /^[A-Z]/.test(node.id.name)) {
              // Heuristic: Starts with uppercase and uses `this`
              const usesThis = findNode(node.body, n =>
                n.type === 'ThisExpression'
              );
              if (usesThis) {
                potentialConstructors[node.id.name] = {
                  name: node.id.name,
                  methods: []
                };
              }
            }
            fileData.functions.push(node.id.name);
            break;

          case 'VariableDeclaration':
            for (const decl of node.declarations) {
              if (decl.id && decl.id.name) {
                fileData.variables.push(decl.id.name);
              }
            }
            break;

          case 'ExpressionStatement': {
            const expr = node.expression;

            // Detect namespaced constructor functions: e.g., ns.MyClass = function () {...}
            if (
              expr.type === 'AssignmentExpression' &&
              expr.right.type === 'FunctionExpression' &&
              expr.left.type === 'MemberExpression'
            ) {
              const fullName = flattenMemberExpression(expr.left);
              // Save class constructor
              if (fullName) {
                potentialConstructors[fullName] = {
                  name: fullName,
                  methods: []
                };
              }
            }

            // Detect prototype assignment: e.g., ns.MyClass.prototype = new Parent();
            if (
              expr.type === 'AssignmentExpression' &&
              expr.left.type === 'MemberExpression' &&
              expr.left.object.type === 'MemberExpression' &&
              expr.left.object.property.name === 'prototype' &&
              expr.right.type === 'NewExpression'
            ) {
              const fullName = flattenMemberExpression(expr.left.object.object);
              if (fullName && potentialConstructors[fullName]) {
                potentialConstructors[fullName].parent = expr.right.callee.name;
              }
            }

            // Detect prototype method: ns.MyClass.prototype.method = function() {}
            if (
              expr.type === 'AssignmentExpression' &&
              expr.left.type === 'MemberExpression' &&
              expr.left.object.type === 'MemberExpression' &&
              expr.left.object.property.name === 'prototype' &&
              expr.right.type === 'FunctionExpression'
            ) {
              const fullName = flattenMemberExpression(expr.left.object.object);
              const methodName = expr.left.property.name;
              if (fullName && methodName) {
                if (!prototypeMethods[fullName]) prototypeMethods[fullName] = [];
                prototypeMethods[fullName].push(methodName);
              }
            }
            break;
          }


          case 'ClassDeclaration':
            if (node.id) {
              const classInfo = {
                name: node.id.name,
                methods: []
              };
              node.body.body.forEach(classElem => {
                if (classElem.type === 'MethodDefinition' && classElem.key && classElem.key.name) {
                  classInfo.methods.push(classElem.key.name);
                }
              });
              fileData.classes.push(classInfo);
            }
            break;
        }
      });

      // Merge ES5-style classes
      for (const [name, classInfo] of Object.entries(potentialConstructors)) {
        if (prototypeMethods[name]) {
          classInfo.methods.push(...prototypeMethods[name]);
        }
        fileData.classes.push(classInfo);
      }

      result.push(fileData);
    } catch (err) {
      console.error(`Error parsing ${filePath}:`, err);
    }
  }

  return result;
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
  if (node.type !== 'MemberExpression') return node.name || null;

  const parts = [];
  while (node.type === 'MemberExpression') {
    if (node.property.type === 'Identifier') parts.unshift(node.property.name);
    node = node.object;
  }
  if (node.name) parts.unshift(node.name);
  return parts.join('.');
}
