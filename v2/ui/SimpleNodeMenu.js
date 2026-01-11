/**
 * Simple Node Creation Menu
 * Displays a dropdown menu with categories that expand on hover
 */

import { nodeTypeRegistry } from '../node-types/NodeTypeRegistry.js';
import { state, addNode, save } from '../state.js';
import { BaseNodeType } from '../node-types/BaseNodeType.js';

export class SimpleNodeMenu {
  constructor() {
    this.menu = null;
    this.createPosition = { x: 0, y: 0 };
    this.onNodeCreated = null;
  }

  init() {
    this.createMenu();
    console.log('SimpleNodeMenu initialized');
  }

  createMenu() {
    this.menu = document.createElement('div');
    this.menu.className = 'simple-node-menu';
    this.menu.style.cssText = `
      position: fixed;
      display: none;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      z-index: 10000;
      min-width: 180px;
      padding: 4px 0;
    `;
    document.body.appendChild(this.menu);

    // Close menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) {
        this.hide();
      }
    });
  }

  show(x, y, callback) {
    this.createPosition = { x, y };
    this.onNodeCreated = callback;

    // Clear menu
    this.menu.innerHTML = '';

    // Get categories
    const categories = nodeTypeRegistry.getCategories();

    categories.forEach(category => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'menu-category';
      categoryItem.style.cssText = `
        position: relative;
        padding: 8px 16px;
        cursor: pointer;
        user-select: none;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #e0e0e0;
      `;

      const categoryLabel = document.createElement('span');
      categoryLabel.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryItem.appendChild(categoryLabel);

      const arrow = document.createElement('span');
      arrow.textContent = '▶';
      arrow.style.cssText = 'font-size: 10px; color: #666;';
      categoryItem.appendChild(arrow);

      // Create submenu
      const submenu = document.createElement('div');
      submenu.className = 'menu-submenu';
      submenu.style.cssText = `
        position: absolute;
        left: 100%;
        top: 0;
        display: none;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.5);
        min-width: 160px;
        padding: 4px 0;
      `;

      // Add node types to submenu
      const types = nodeTypeRegistry.getByCategory(category);
      types.forEach(type => {
        const typeItem = document.createElement('div');
        typeItem.className = 'menu-item';
        typeItem.style.cssText = `
          padding: 8px 16px;
          cursor: pointer;
          user-select: none;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #e0e0e0;
        `;

        const icon = document.createElement('span');
        icon.textContent = type.icon || '📦';
        icon.style.cssText = 'font-size: 16px;';
        typeItem.appendChild(icon);

        const name = document.createElement('span');
        name.textContent = type.name;
        typeItem.appendChild(name);

        // Hover effect
        typeItem.addEventListener('mouseenter', () => {
          typeItem.style.backgroundColor = '#3a3a3a';
        });
        typeItem.addEventListener('mouseleave', () => {
          typeItem.style.backgroundColor = '';
        });

        // Click to create node
        typeItem.addEventListener('click', (e) => {
          e.stopPropagation();
          this.createNode(type);
        });

        submenu.appendChild(typeItem);
      });

      categoryItem.appendChild(submenu);

      // Show submenu on hover
      categoryItem.addEventListener('mouseenter', () => {
        categoryItem.style.backgroundColor = '#3a3a3a';
        submenu.style.display = 'block';
      });
      categoryItem.addEventListener('mouseleave', () => {
        categoryItem.style.backgroundColor = '';
        submenu.style.display = 'none';
      });

      this.menu.appendChild(categoryItem);
    });

    // Position menu at mouse coordinates
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.display = 'block';

    // Adjust if menu goes off screen
    requestAnimationFrame(() => {
      const rect = this.menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.menu.style.left = `${window.innerWidth - rect.width - 10}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.menu.style.top = `${window.innerHeight - rect.height - 10}px`;
      }
    });
  }

  hide() {
    if (this.menu) {
      this.menu.style.display = 'none';
    }
  }

  createNode(typeDef) {
    // Create node using BaseNodeType
    const baseType = new BaseNodeType(typeDef);
    const node = baseType.createInstance({
      position: this.createPosition,
      title: typeDef.name
    });

    // Add to state
    addNode(node);
    save();

    // Trigger callback
    if (this.onNodeCreated) {
      this.onNodeCreated(node);
    }

    this.hide();
  }
}

// Create singleton instance
export const simpleNodeMenu = new SimpleNodeMenu();
