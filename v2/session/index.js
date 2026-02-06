/**
 * Session Module
 *
 * Exports all session-related components.
 *
 * @module session
 */

// Core classes
export { SessionManager, sessionManager } from './SessionManager.js';

// Format utilities
export {
  SESSION_VERSION,
  SESSION_FILE_EXTENSION,
  SESSION_MIME_TYPE,
  createEmptySession,
  validateSession,
  migrateSession,
  getSessionFilename,
  generateSessionName,
  compareVersions
} from './SessionFormat.js';
