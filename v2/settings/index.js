/**
 * Settings Module
 *
 * Exports all settings-related components.
 *
 * @module settings
 */

// Core managers
export { SettingsManager, settingsManager } from './SettingsManager.js';
export { ShortcutManager, shortcutManager, parseKeyCombo, formatKeyCombo } from './ShortcutManager.js';

// Defaults
export {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  SHORTCUT_INFO,
  SETTING_CATEGORIES,
  SETTING_INFO
} from './defaults.js';

/**
 * Initialize the settings system.
 * Call this once during application startup.
 *
 * @param {Object} [options]
 * @param {Object} [options.handlers] - Shortcut handlers to register
 */
export function initSettings(options = {}) {
  // Initialize managers
  settingsManager.init();
  shortcutManager.init();

  // Register handlers if provided
  if (options.handlers) {
    for (const [action, handler] of Object.entries(options.handlers)) {
      shortcutManager.register(action, handler);
    }
  }
}
