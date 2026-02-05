/**
 * Note store - handles loading notes via IPC
 */

// Cache for notes list
let notesCache = null;

/**
 * Get all notes sorted by date (newest first)
 * @returns {Promise<Array>} Array of note objects
 */
export async function listNotes() {
  if (notesCache) {
    return notesCache;
  }
  notesCache = await window.api.listNotes();
  return notesCache;
}

/**
 * Get a single note by ID
 * @param {string} noteId - The note ID (ULID)
 * @returns {Promise<Object|null>} The note object or null
 */
export async function getNote(noteId) {
  return window.api.getNote(noteId);
}

/**
 * Clear the notes cache (call when notes might have changed)
 */
export function clearCache() {
  notesCache = null;
}

/**
 * Format a date for display
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date with time for display
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date/time string
 */
export function formatDateTime(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
