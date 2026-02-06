/**
 * AgentNotes Electron App - Renderer Process Entry Point
 */

import { listNotes, addComment, clearCache } from './lib/noteStore.js';
import { NoteList } from './components/NoteList.js';
import { NoteView } from './components/NoteView.js';
import { CommentsPanel } from './components/CommentsPanel.js';

// Global state
let noteList = null;
let noteView = null;
let commentsPanel = null;
let currentNoteId = null;

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
      const notes = await listNotes();
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
 * Initialize the application
 */
async function init() {
  // Initialize title bar
  initTitleBar();

  // Get DOM elements
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

  // Load and display notes
  try {
    const notes = await listNotes();
    noteList.render(notes);

    // Auto-select first note if available
    if (notes.length > 0) {
      noteList.selectNote(notes[0].id);
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    noteListContainer.innerHTML = '<p class="empty-state">Error loading notes</p>';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
