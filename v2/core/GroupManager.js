/**
 * Group Manager - Handles group node logic
 * Manages containment, movement, and bounds checking for group nodes
 */

import { state, findNode, save } from '../state.js';

export class GroupManager {
  constructor() {
    this.groups = new Map(); // Map of groupId -> group metadata
  }

  /**
   * Create a new group
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {string} title - Group title
   * @returns {Object} Group node
   */
  createGroup(x, y, width = 400, height = 300, title = 'New Group') {
    const group = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'group',
      title,
      position: { x, y },
      size: { width, height },
      ports: [],
      style: {
        color: 'rgba(100, 150, 200, 0.1)',
        borderColor: '#4a90e2',
        borderWidth: 2,
        borderRadius: 8
      },
      containedNodes: [],  // IDs of nodes inside this group
      containedIn: null    // Not inside another group
    };

    return group;
  }

  /**
   * Add a node to a group
   * @param {string} groupId - Group ID
   * @param {string} nodeId - Node ID to add
   * @returns {boolean} Success
   */
  addNodeToGroup(groupId, nodeId) {
    const group = findNode(groupId);
    const node = findNode(nodeId);

    if (!group || !node || group.type !== 'group') {
      console.warn('Cannot add to group: invalid group or node');
      return false;
    }

    // Can't add a group to itself
    if (groupId === nodeId) {
      return false;
    }

    // Check if node is within group bounds
    if (!this.isWithinBounds(node, group)) {
      console.warn('Node is not within group bounds');
      return false;
    }

    // Remove from previous group if any
    if (node.containedIn) {
      this.removeNodeFromGroup(node.containedIn, nodeId);
    }

    // Add to group
    if (!group.containedNodes) {
      group.containedNodes = [];
    }

    if (!group.containedNodes.includes(nodeId)) {
      group.containedNodes.push(nodeId);
      node.containedIn = groupId;
      console.log(`Added node ${nodeId} to group ${groupId}`);
      return true;
    }

    return false;
  }

  /**
   * Remove a node from a group
   * @param {string} groupId - Group ID
   * @param {string} nodeId - Node ID to remove
   * @returns {boolean} Success
   */
  removeNodeFromGroup(groupId, nodeId) {
    const group = findNode(groupId);
    const node = findNode(nodeId);

    if (!group || !node) {
      return false;
    }

    if (group.containedNodes) {
      const index = group.containedNodes.indexOf(nodeId);
      if (index !== -1) {
        group.containedNodes.splice(index, 1);
        node.containedIn = null;
        console.log(`Removed node ${nodeId} from group ${groupId}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Move a group and all its contained nodes
   * @param {string} groupId - Group ID
   * @param {number} deltaX - X delta
   * @param {number} deltaY - Y delta
   */
  moveGroup(groupId, deltaX, deltaY) {
    const group = findNode(groupId);

    if (!group || group.type !== 'group') {
      return;
    }

    // Move the group
    if (group.position) {
      group.position.x += deltaX;
      group.position.y += deltaY;
    } else {
      group.x = (group.x || 0) + deltaX;
      group.y = (group.y || 0) + deltaY;
    }

    // Move all contained nodes
    if (group.containedNodes && group.containedNodes.length > 0) {
      group.containedNodes.forEach(nodeId => {
        const node = findNode(nodeId);
        if (node) {
          if (node.position) {
            node.position.x += deltaX;
            node.position.y += deltaY;
          } else {
            node.x = (node.x || 0) + deltaX;
            node.y = (node.y || 0) + deltaY;
          }
        }
      });
    }
  }

  /**
   * Check if a node is within group bounds
   * @param {Object} node - Node to check
   * @param {Object} group - Group node
   * @returns {boolean}
   */
  isWithinBounds(node, group) {
    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;
    const nodeWidth = node.size?.width ?? node.width ?? 180;
    const nodeHeight = node.size?.height ?? node.height ?? 100;

    const groupX = group.position?.x ?? group.x ?? 0;
    const groupY = group.position?.y ?? group.y ?? 0;
    const groupWidth = group.size?.width ?? group.width ?? 400;
    const groupHeight = group.size?.height ?? group.height ?? 300;

    // Node must be fully inside group
    return nodeX >= groupX &&
           nodeY >= groupY &&
           (nodeX + nodeWidth) <= (groupX + groupWidth) &&
           (nodeY + nodeHeight) <= (groupY + groupHeight);
  }

  /**
   * Check if a point is within group bounds
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} group - Group node
   * @returns {boolean}
   */
  isPointInGroup(x, y, group) {
    const groupX = group.position?.x ?? group.x ?? 0;
    const groupY = group.position?.y ?? group.y ?? 0;
    const groupWidth = group.size?.width ?? group.width ?? 400;
    const groupHeight = group.size?.height ?? group.height ?? 300;

    return x >= groupX &&
           y >= groupY &&
           x <= (groupX + groupWidth) &&
           y <= (groupY + groupHeight);
  }

  /**
   * Find group at a point (topmost if multiple)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} Group node or null
   */
  findGroupAtPoint(x, y) {
    const groups = state.nodes.filter(n => n.type === 'group');

    // Find all groups containing the point
    const containingGroups = groups.filter(g => this.isPointInGroup(x, y, g));

    // Return the topmost (last in array, highest z-index)
    return containingGroups.length > 0 ? containingGroups[containingGroups.length - 1] : null;
  }

  /**
   * Auto-assign nodes to groups based on position
   * Checks all nodes and adds them to groups if they're within bounds
   */
  autoAssignNodesToGroups() {
    const groups = state.nodes.filter(n => n.type === 'group');
    const nonGroupNodes = state.nodes.filter(n => n.type !== 'group');

    groups.forEach(group => {
      nonGroupNodes.forEach(node => {
        // Skip if already in this group
        if (node.containedIn === group.id) {
          return;
        }

        // Check if within bounds
        if (this.isWithinBounds(node, group)) {
          this.addNodeToGroup(group.id, node.id);
        }
      });
    });
  }

  /**
   * Update group containment after node move
   * @param {string} nodeId - Node that was moved
   */
  updateGroupContainment(nodeId) {
    const node = findNode(nodeId);
    if (!node || node.type === 'group') {
      return;
    }

    const nodeX = node.position?.x ?? node.x ?? 0;
    const nodeY = node.position?.y ?? node.y ?? 0;

    // Find group at node's center
    const nodeWidth = node.size?.width ?? node.width ?? 180;
    const nodeHeight = node.size?.height ?? node.height ?? 100;
    const centerX = nodeX + nodeWidth / 2;
    const centerY = nodeY + nodeHeight / 2;

    const targetGroup = this.findGroupAtPoint(centerX, centerY);

    // If node is in a group but shouldn't be, remove it
    if (node.containedIn && (!targetGroup || targetGroup.id !== node.containedIn)) {
      this.removeNodeFromGroup(node.containedIn, nodeId);
    }

    // If node should be in a group but isn't, add it
    if (targetGroup && targetGroup.id !== node.containedIn) {
      this.addNodeToGroup(targetGroup.id, nodeId);
    }
  }

  /**
   * Get all nodes in a group
   * @param {string} groupId - Group ID
   * @returns {Array} Array of nodes
   */
  getGroupNodes(groupId) {
    const group = findNode(groupId);
    if (!group || !group.containedNodes) {
      return [];
    }

    return group.containedNodes.map(nodeId => findNode(nodeId)).filter(n => n !== null);
  }

  /**
   * Resize a group
   * @param {string} groupId - Group ID
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resizeGroup(groupId, width, height) {
    const group = findNode(groupId);
    if (!group || group.type !== 'group') {
      return;
    }

    if (group.size) {
      group.size.width = Math.max(200, width);
      group.size.height = Math.max(150, height);
    } else {
      group.width = Math.max(200, width);
      group.height = Math.max(150, height);
    }

    // Check if any contained nodes are now outside bounds
    if (group.containedNodes) {
      const nodesToRemove = [];
      group.containedNodes.forEach(nodeId => {
        const node = findNode(nodeId);
        if (node && !this.isWithinBounds(node, group)) {
          nodesToRemove.push(nodeId);
        }
      });

      // Remove nodes that are now outside
      nodesToRemove.forEach(nodeId => {
        this.removeNodeFromGroup(groupId, nodeId);
      });
    }
  }

  /**
   * Delete a group (optionally delete contained nodes)
   * @param {string} groupId - Group ID
   * @param {boolean} deleteContained - Whether to delete contained nodes
   */
  deleteGroup(groupId, deleteContained = false) {
    const group = findNode(groupId);
    if (!group || group.type !== 'group') {
      return;
    }

    if (deleteContained && group.containedNodes) {
      // Delete all contained nodes
      group.containedNodes.forEach(nodeId => {
        const index = state.nodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
          state.nodes.splice(index, 1);
        }
      });
    } else if (group.containedNodes) {
      // Just remove containment references
      group.containedNodes.forEach(nodeId => {
        const node = findNode(nodeId);
        if (node) {
          node.containedIn = null;
        }
      });
    }

    // Delete the group itself
    const groupIndex = state.nodes.findIndex(n => n.id === groupId);
    if (groupIndex !== -1) {
      state.nodes.splice(groupIndex, 1);
    }
  }
}

// Create singleton instance
export const groupManager = new GroupManager();
