/**
 * Directory Structure Builder
 * Converts flat file lists from directory picker into hierarchical tree structure
 */

export class DirectoryStructureBuilder {
  /**
   * Build directory tree from flat file list
   * @param {File[]} files - Array of File objects from directory picker
   * @returns {Object} - Tree structure with directories and files
   */
  buildDirectoryTree(files) {
    const tree = {
      name: 'root',
      type: 'directory',
      children: [],
      files: []
    };

    files.forEach(file => {
      const pathParts = this.getRelativePath(file).split('/');
      this.insertIntoTree(tree, pathParts, file);
    });

    return tree;
  }

  /**
   * Get relative path from file object
   * @param {File} file - File object
   * @returns {string} - Relative path
   */
  getRelativePath(file) {
    return file.webkitRelativePath || file.name;
  }

  /**
   * Insert file into tree at correct location
   * @param {Object} node - Current tree node
   * @param {string[]} pathParts - Path segments
   * @param {File} file - File object
   */
  insertIntoTree(node, pathParts, file) {
    if (pathParts.length === 1) {
      // This is a file
      node.files.push({
        name: pathParts[0],
        file: file,
        type: 'file'
      });
      return;
    }

    // This is a directory
    const dirName = pathParts[0];
    let dirNode = node.children.find(child => child.name === dirName);

    if (!dirNode) {
      dirNode = {
        name: dirName,
        type: 'directory',
        children: [],
        files: []
      };
      node.children.push(dirNode);
    }

    this.insertIntoTree(dirNode, pathParts.slice(1), file);
  }

  /**
   * Filter out unwanted directories/files
   * @param {string} path - File path
   * @returns {boolean} - Whether to include this file
   */
  shouldInclude(path) {
    const skipDirs = ['node_modules', 'dist', 'build', '.git', '.idea', 'coverage'];
    const skipExtensions = ['.min.js', '.bundle.js', '.chunk.js'];

    // Check if path contains skip directories
    const pathSegments = path.split('/');
    if (pathSegments.some(seg => skipDirs.includes(seg))) {
      return false;
    }

    // Check for skip extensions
    if (skipExtensions.some(ext => path.endsWith(ext))) {
      return false;
    }

    // Only include supported file types
    const supportedExtensions = ['.js', '.ts', '.jsx', '.tsx'];
    return supportedExtensions.some(ext => path.endsWith(ext));
  }
}
