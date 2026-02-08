/**
 * AgentNotes Electron App - Renderer Process Entry Point
 */

import { listNotes, addComment, deleteComment, clearCache, getDirectory, selectDirectory } from './lib/noteStore.js';
import { NoteList } from './components/NoteList.js';
import { NoteView } from './components/NoteView.js';
import { CommentsPanel } from './components/CommentsPanel.js';

// Global state
let noteList = null;
let noteView = null;
let commentsPanel = null;
let currentNoteId = null;

// DOM elements for directory selection
let directoryOverlay = null;
let appElement = null;
let titleBarDirectory = null;
let directoryPath = null;

/**
 * Normalize notes:list responses to a notes array.
 * Supports both legacy array payloads and object payloads ({ notes, noDirectory }).
 * @param {Array|Object} result
 * @returns {Array}
 */
function extractNotes(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.notes)) {
    return result.notes;
  }

  return [];
}

/**
 * Initialize the custom title bar
 */
function initTitleBar() {
  const titleBar = document.getElementById('titleBar');
  const btnClose = document.getElementById('btnClose');
  const btnMinimize = document.getElementById('btnMinimize');
  const btnMaximize = document.getElementById('btnMaximize');

  // Button click handlers
  btnClose.addEventListener('click', () => {
    window.api.windowClose();
  });

  btnMinimize.addEventListener('click', () => {
    window.api.windowMinimize();
  });

  btnMaximize.addEventListener('click', () => {
    window.api.windowMaximize();
  });

  // Double-click to maximize
  titleBar.addEventListener('dblclick', (e) => {
    if (e.target === titleBar || e.target.classList.contains('title-bar-title')) {
      window.api.windowMaximize();
    }
  });

  // Window focus/blur handlers
  window.addEventListener('focus', () => {
    titleBar.classList.remove('unfocused');
  });

  window.addEventListener('blur', () => {
    titleBar.classList.add('unfocused');
  });
}

/**
 * Handle note selection
 * @param {Object} note - The selected note
 */
function onSelectNote(note) {
  currentNoteId = note.id;
  noteView.render(note);
  commentsPanel.render(note.comments, note.content);
}

/**
 * Handle comment creation from text selection
 * @param {number} startChar - Start character position
 * @param {number} endChar - End character position
 * @param {string} selectedText - The selected text
 */
function onCommentCreate(startChar, endChar, selectedText) {
  commentsPanel.startNewComment(startChar, endChar, selectedText);
}

/**
 * Handle comment submission
 * @param {string} content - The comment content
 * @param {number} startChar - Start character position
 * @param {number} endChar - End character position
 */
async function onCommentSubmit(content, startChar, endChar) {
  if (!currentNoteId) {
    console.error('No note selected');
    return;
  }

  try {
    const result = await addComment(currentNoteId, content, '', startChar, endChar);

    if (result.success && result.note) {
      // Clear cache and re-render with updated note
      clearCache();
      noteView.render(result.note);
      commentsPanel.render(result.note.comments, result.note.content);

      // Update the note list to reflect changes
      const notesResult = await listNotes();
      const notes = extractNotes(notesResult);
      noteList.render(notes);
      noteList.selectNote(currentNoteId);
    } else {
      console.error('Failed to add comment:', result.error);
    }
  } catch (error) {
    console.error('Error adding comment:', error);
  }
}

/**
 * Handle comment deletion
 * @param {string} commentId - The comment ID
 */
async function onCommentDelete(commentId) {
  if (!currentNoteId) {
    console.error('No note selected');
    return;
  }

  try {
    const result = await deleteComment(currentNoteId, commentId);

    if (result.success && result.note) {
      // Clear cache and re-render with updated note
      clearCache();
      noteView.render(result.note);
      commentsPanel.render(result.note.comments, result.note.content);

      // Update the note list to reflect changes
      const notesResult = await listNotes();
      const notes = extractNotes(notesResult);
      noteList.render(notes);
      noteList.selectNote(currentNoteId);
    } else {
      console.error('Failed to delete comment:', result.error);
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
  }
}

/**
 * Update the directory indicator in the title bar
 * @param {string} path - The directory path
 */
function updateDirectoryIndicator(path) {
  if (!path) {
    titleBarDirectory.classList.add('hidden');
    return;
  }

  // Show just the folder name, not full path
  const folderName = path.split('/').pop() || path;
  directoryPath.textContent = folderName;
  directoryPath.title = path; // Show full path on hover
  titleBarDirectory.classList.remove('hidden');
}

/**
 * Handle directory selection
 */
async function handleSelectDirectory() {
  const path = await selectDirectory();

  if (path) {
    // Hide overlay, show app
    directoryOverlay.classList.add('hidden');
    appElement.classList.remove('hidden');

    // Update title bar indicator
    updateDirectoryIndicator(path);

    // Clear cache and reload notes
    clearCache();
    await loadNotes();
  }
}

/**
 * Load and display notes
 */
async function loadNotes() {
  const noteListContainer = document.getElementById('noteList');

  try {
    const result = await listNotes();
    const notes = extractNotes(result);

    noteList.render(notes);

    // Auto-select first note if available
    if (notes.length > 0) {
      noteList.selectNote(notes[0].id);
    } else {
      // Clear the note view when no notes
      noteView.clear();
      commentsPanel.clear();
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    noteListContainer.innerHTML = '<p class="empty-state">Error loading notes</p>';
  }
}

/**
 * Initialize the application
 */
async function init() {
  // Initialize title bar
  initTitleBar();

  // Get directory-related DOM elements
  directoryOverlay = document.getElementById('directoryOverlay');
  appElement = document.querySelector('.app');
  titleBarDirectory = document.getElementById('titleBarDirectory');
  directoryPath = document.getElementById('directoryPath');

  // Set up directory selection button handlers
  const selectDirectoryBtn = document.getElementById('selectDirectoryBtn');
  const changeDirectoryBtn = document.getElementById('changeDirectoryBtn');

  selectDirectoryBtn.addEventListener('click', handleSelectDirectory);
  changeDirectoryBtn.addEventListener('click', handleSelectDirectory);

  // Get DOM elements for note components
  const noteListContainer = document.getElementById('noteList');
  const noteHeaderContainer = document.getElementById('noteHeader');
  const noteContentContainer = document.getElementById('noteContent');
  const commentsListContainer = document.getElementById('commentsList');

  // Initialize components
  noteList = new NoteList(noteListContainer, onSelectNote);
  noteView = new NoteView(noteHeaderContainer, noteContentContainer);
  commentsPanel = new CommentsPanel(commentsListContainer);

  // Wire up comment creation callbacks
  noteView.setOnCommentCreate(onCommentCreate);
  commentsPanel.setOnCommentSubmit(onCommentSubmit);
  commentsPanel.setOnCommentDelete(onCommentDelete);

  // Check if directory is already configured
  try {
    const currentDirectory = await getDirectory();

    if (!currentDirectory) {
      // No directory configured - show overlay, hide app
      directoryOverlay.classList.remove('hidden');
      appElement.classList.add('hidden');
    } else {
      // Directory configured - hide overlay, show app
      directoryOverlay.classList.add('hidden');
      appElement.classList.remove('hidden');

      // Update title bar indicator
      updateDirectoryIndicator(currentDirectory);

      // Load notes
      await loadNotes();
    }
  } catch (error) {
    console.error('Error checking directory:', error);
    // Show directory picker on error
    directoryOverlay.classList.remove('hidden');
    appElement.classList.add('hidden');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
