function renderMindMap(data) {
  const container = document.getElementById('mindmap');
  if (!container) return;

  // Clear previous content
  container.innerHTML = '';
  container.className = 'mindmap-container';

  // Create header
  const header = document.createElement('h2');
  header.textContent = 'Code Structure Map';
  container.appendChild(header);

  // Create the root element
  const root = document.createElement('div');
  root.className = 'mindmap-root';
  container.appendChild(root);

  // Process each file
  data.forEach(fileData => {
    const fileNode = document.createElement('div');
    fileNode.className = 'file-node';
    
    // File header
    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header';
    fileHeader.textContent = fileData.file.split('/').pop();
    fileNode.appendChild(fileHeader);

    // File content container
    const fileContent = document.createElement('div');
    fileContent.className = 'file-content';

    // Add namespaces
    if (fileData.namespaces.length > 0) {
      const namespaceSection = document.createElement('div');
      namespaceSection.className = 'namespace-section';
      
      fileData.namespaces.forEach(namespace => {
        const namespaceNode = createNamespaceNode(namespace);
        namespaceSection.appendChild(namespaceNode);
      });
      
      fileContent.appendChild(namespaceSection);
    }

    // Add file-level functions and variables if they exist
    if (fileData.functions.length > 0 || fileData.variables.length > 0) {
      const fileLevelSection = document.createElement('div');
      fileLevelSection.className = 'file-level-section';
      
      if (fileData.functions.length > 0) {
        const functionsList = document.createElement('div');
        functionsList.className = 'function-list';
        functionsList.innerHTML = '<div class="section-header">Functions</div>';
        fileData.functions.forEach(func => {
          const funcNode = document.createElement('div');
          funcNode.className = 'function';
          funcNode.textContent = func;
          functionsList.appendChild(funcNode);
        });
        fileLevelSection.appendChild(functionsList);
      }

      if (fileData.variables.length > 0) {
        const variablesList = document.createElement('div');
        variablesList.className = 'variable-list';
        variablesList.innerHTML = '<div class="section-header">Variables</div>';
        fileData.variables.forEach(variable => {
          const varNode = document.createElement('div');
          varNode.className = 'variable';
          varNode.textContent = variable;
          variablesList.appendChild(varNode);
        });
        fileLevelSection.appendChild(variablesList);
      }

      fileContent.appendChild(fileLevelSection);
    }

    fileNode.appendChild(fileContent);
    root.appendChild(fileNode);
  });
}

function createNamespaceNode(namespace) {
  const namespaceNode = document.createElement('div');
  namespaceNode.className = 'namespace-node';
  
  // Namespace header
  const namespaceHeader = document.createElement('div');
  namespaceHeader.className = 'namespace-header';
  namespaceHeader.textContent = namespace.name;
  namespaceNode.appendChild(namespaceHeader);

  // Namespace content
  const namespaceContent = document.createElement('div');
  namespaceContent.className = 'namespace-content';

  // Add classes
  if (namespace.classes.length > 0) {
    const classesSection = document.createElement('div');
    classesSection.className = 'classes-section';
    classesSection.innerHTML = '<div class="section-header">Classes</div>';
    
    namespace.classes.forEach(cls => {
      const classNode = document.createElement('div');
      classNode.className = 'class-node';
      
      // Class header with inheritance info
      const classHeader = document.createElement('div');
      classHeader.className = 'class-header';
      classHeader.textContent = cls.name;
      if (cls.parent) {
        const parentInfo = document.createElement('span');
        parentInfo.className = 'parent-info';
        parentInfo.textContent = ` extends ${cls.parent}`;
        classHeader.appendChild(parentInfo);
      }
      classNode.appendChild(classHeader);

      // Class methods
      if (cls.methods.length > 0) {
        const methodsList = document.createElement('div');
        methodsList.className = 'method-list';
        methodsList.innerHTML = '<div class="section-header">Methods</div>';
        cls.methods.forEach(method => {
          const methodNode = document.createElement('div');
          methodNode.className = 'method';
          methodNode.textContent = method;
          methodsList.appendChild(methodNode);
        });
        classNode.appendChild(methodsList);
      }

      // Class variables
      if (cls.variables.length > 0) {
        const variablesList = document.createElement('div');
        variablesList.className = 'variable-list';
        variablesList.innerHTML = '<div class="section-header">Variables</div>';
        cls.variables.forEach(variable => {
          const varNode = document.createElement('div');
          varNode.className = 'variable';
          varNode.textContent = variable;
          variablesList.appendChild(varNode);
        });
        classNode.appendChild(variablesList);
      }

      classesSection.appendChild(classNode);
    });
    
    namespaceContent.appendChild(classesSection);
  }

  // Add namespace-level functions
  if (namespace.functions.length > 0) {
    const functionsList = document.createElement('div');
    functionsList.className = 'function-list';
    functionsList.innerHTML = '<div class="section-header">Functions</div>';
    namespace.functions.forEach(func => {
      const funcNode = document.createElement('div');
      funcNode.className = 'function';
      funcNode.textContent = func;
      functionsList.appendChild(funcNode);
    });
    namespaceContent.appendChild(functionsList);
  }

  // Add namespace-level variables
  if (namespace.variables.length > 0) {
    const variablesList = document.createElement('div');
    variablesList.className = 'variable-list';
    variablesList.innerHTML = '<div class="section-header">Variables</div>';
    namespace.variables.forEach(variable => {
      const varNode = document.createElement('div');
      varNode.className = 'variable';
      varNode.textContent = variable;
      variablesList.appendChild(varNode);
    });
    namespaceContent.appendChild(variablesList);
  }

  namespaceNode.appendChild(namespaceContent);
  return namespaceNode;
}
