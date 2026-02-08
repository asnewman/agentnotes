/**
 * Note store - handles loading notes via IPC
 */

// Cache for notes list
let notesCache = null;

/**
 * Get the configured notes directory
 * @returns {Promise<string|null>} The directory path or null
 */
export async function getDirectory() {
  return window.api.getDirectory();
}

/**
 * Open directory picker and save selection
 * @returns {Promise<string|null>} The selected directory path or null
 */
export async function selectDirectory() {
  const path = await window.api.selectDirectory();

  // Clear cache when directory changes
  if (path) {
    clearCache();
  }

  return path;
}

/**
 * Get all notes sorted by date (newest first)
 * @returns {Promise<Object>} Object with notes array and noDirectory flag
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
 * Add a comment to a note
 * @param {string} noteId - The note ID (ULID)
 * @param {string} content - The comment content
 * @param {string} author - The comment author (optional)
 * @param {number} startChar - Start character position
 * @param {number} endChar - End character position
 * @returns {Promise<Object>} Result with success status and updated note
 */
export async function addComment(noteId, content, author, startChar, endChar) {
  const result = await window.api.addComment(noteId, content, author, startChar, endChar);

  // Clear cache if comment was added successfully
  if (result.success) {
    clearCache();
  }

  return result;
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
