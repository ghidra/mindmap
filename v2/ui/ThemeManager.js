/**
 * Theme Manager
 *
 * Handles theme switching between light and dark modes.
 * Persists preference to localStorage.
 *
 * @see ARCHITECTURE_PLAN.md Module 6.4 for full documentation
 */

/**
 * Available themes.
 * @enum {string}
 */
export const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

/**
 * LocalStorage key for theme preference.
 * @type {string}
 */
const STORAGE_KEY = 'mindmap-theme';

/**
 * Theme Manager class.
 */
export class ThemeManager {
  /**
   * Create a new ThemeManager instance.
   */
  constructor() {
    /**
     * Current theme.
     * @type {string}
     * @private
     */
    this._theme = Theme.LIGHT;

    /**
     * System dark mode preference.
     * @type {boolean}
     * @private
     */
    this._systemPrefersDark = false;

    /**
     * Theme change callbacks.
     * @type {Set<Function>}
     * @private
     */
    this._listeners = new Set();

    /**
     * Media query for system dark mode.
     * @type {MediaQueryList|null}
     * @private
     */
    this._mediaQuery = null;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the theme manager.
   * Loads saved preference and sets up system preference detection.
   */
  init() {
    // Set up system preference detection
    if (window.matchMedia) {
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this._systemPrefersDark = this._mediaQuery.matches;

      // Listen for system preference changes
      this._mediaQuery.addEventListener('change', (e) => {
        this._systemPrefersDark = e.matches;
        if (this._theme === Theme.SYSTEM) {
          this._applyTheme();
        }
      });
    }

    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(Theme).includes(saved)) {
      this._theme = saved;
    } else {
      // Default to system preference
      this._theme = Theme.SYSTEM;
    }

    // Apply initial theme
    this._applyTheme();
  }

  // =========================================================================
  // Theme Access
  // =========================================================================

  /**
   * Get the current theme setting.
   *
   * @returns {string} Current theme (light, dark, or system)
   */
  getTheme() {
    return this._theme;
  }

  /**
   * Get the effective theme (resolved from system if needed).
   *
   * @returns {string} Effective theme (light or dark)
   */
  getEffectiveTheme() {
    if (this._theme === Theme.SYSTEM) {
      return this._systemPrefersDark ? Theme.DARK : Theme.LIGHT;
    }
    return this._theme;
  }

  /**
   * Check if dark mode is active.
   *
   * @returns {boolean}
   */
  isDark() {
    return this.getEffectiveTheme() === Theme.DARK;
  }

  // =========================================================================
  // Theme Setting
  // =========================================================================

  /**
   * Set the theme.
   *
   * @param {string} theme - Theme to set (light, dark, or system)
   */
  setTheme(theme) {
    if (!Object.values(Theme).includes(theme)) {
      console.warn('ThemeManager: Invalid theme:', theme);
      return;
    }

    if (this._theme === theme) return;

    this._theme = theme;
    this._save();
    this._applyTheme();
    this._notifyListeners();
  }

  /**
   * Toggle between light and dark modes.
   * If currently set to system, will toggle based on effective theme.
   */
  toggle() {
    const effective = this.getEffectiveTheme();
    this.setTheme(effective === Theme.DARK ? Theme.LIGHT : Theme.DARK);
  }

  /**
   * Cycle through themes: light -> dark -> system -> light.
   */
  cycle() {
    const order = [Theme.LIGHT, Theme.DARK, Theme.SYSTEM];
    const currentIndex = order.indexOf(this._theme);
    const nextIndex = (currentIndex + 1) % order.length;
    this.setTheme(order[nextIndex]);
  }

  // =========================================================================
  // Listeners
  // =========================================================================

  /**
   * Add a theme change listener.
   *
   * @param {Function} callback - Called with (theme, effectiveTheme)
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Notify all listeners of theme change.
   * @private
   */
  _notifyListeners() {
    const effective = this.getEffectiveTheme();
    this._listeners.forEach(callback => {
      try {
        callback(this._theme, effective);
      } catch (error) {
        console.error('ThemeManager: Listener error:', error);
      }
    });
  }

  // =========================================================================
  // Persistence
  // =========================================================================

  /**
   * Save theme preference to localStorage.
   * @private
   */
  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, this._theme);
    } catch (error) {
      console.warn('ThemeManager: Could not save preference:', error);
    }
  }

  // =========================================================================
  // Application
  // =========================================================================

  /**
   * Apply the current theme to the document.
   * @private
   */
  _applyTheme() {
    const effective = this.getEffectiveTheme();

    if (effective === Theme.DARK) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }

    // Update meta theme-color for mobile browsers
    this._updateMetaThemeColor(effective);
  }

  /**
   * Update the meta theme-color tag for mobile browsers.
   *
   * @param {string} theme - Effective theme
   * @private
   */
  _updateMetaThemeColor(theme) {
    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }

    meta.content = theme === Theme.DARK ? '#1a1a1a' : '#f0f0f0';
  }

  // =========================================================================
  // UI Helpers
  // =========================================================================

  /**
   * Get display label for current theme.
   *
   * @returns {string}
   */
  getLabel() {
    switch (this._theme) {
      case Theme.LIGHT: return 'Light';
      case Theme.DARK: return 'Dark';
      case Theme.SYSTEM: return `System (${this._systemPrefersDark ? 'Dark' : 'Light'})`;
      default: return 'Unknown';
    }
  }

  /**
   * Get icon for current theme.
   *
   * @returns {string}
   */
  getIcon() {
    const effective = this.getEffectiveTheme();
    return effective === Theme.DARK ? '🌙' : '☀️';
  }

  /**
   * Create a theme toggle button element.
   *
   * @param {Object} [options]
   * @param {boolean} [options.showLabel=false] - Show text label
   * @param {boolean} [options.cycle=false] - Cycle through all themes (including system)
   * @returns {HTMLButtonElement}
   */
  createToggleButton(options = {}) {
    const { showLabel = false, cycle = false } = options;

    const button = document.createElement('button');
    button.className = 'theme-toggle-btn';
    button.type = 'button';
    button.title = 'Toggle theme';

    const updateButton = () => {
      const icon = this.getIcon();
      const label = this.getLabel();
      button.innerHTML = showLabel ? `${icon} ${label}` : icon;
      button.title = `Theme: ${label}. Click to ${cycle ? 'cycle' : 'toggle'}.`;
    };

    updateButton();

    button.addEventListener('click', () => {
      if (cycle) {
        this.cycle();
      } else {
        this.toggle();
      }
    });

    // Update button when theme changes
    this.onChange(() => updateButton());

    return button;
  }
}

/**
 * Singleton theme manager instance.
 * @type {ThemeManager}
 */
export const themeManager = new ThemeManager();
