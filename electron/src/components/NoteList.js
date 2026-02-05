/**
 * NoteList component - displays a list of notes in the left panel
 */

import { formatDate } from '../lib/noteStore.js';

/**
 * Create a note list item element
 * @param {Object} note - The note object
 * @param {boolean} isSelected - Whether this note is selected
 * @returns {HTMLElement} The note list item element
 */
function createNoteItem(note, isSelected) {
  const item = document.createElement('div');
  item.className = 'note-item' + (isSelected ? ' selected' : '');
  item.dataset.noteId = note.id;

  const title = document.createElement('div');
  title.className = 'note-item-title';
  title.textContent = note.title;

  const date = document.createElement('div');
  date.className = 'note-item-date';
  date.textContent = formatDate(note.created);

  const stats = document.createElement('div');
  stats.className = 'note-item-stats';

  if (note.tags && note.tags.length > 0) {
    const tagsSpan = document.createElement('span');
    tagsSpan.textContent = `${note.tags.length} tag${note.tags.length !== 1 ? 's' : ''}`;
    stats.appendChild(tagsSpan);
  }

  if (note.comments && note.comments.length > 0) {
    const commentsSpan = document.createElement('span');
    commentsSpan.textContent = `${note.comments.length} comment${note.comments.length !== 1 ? 's' : ''}`;
    stats.appendChild(commentsSpan);
  }

  item.appendChild(title);
  item.appendChild(date);
  if (stats.children.length > 0) {
    item.appendChild(stats);
  }

  return item;
}

/**
 * NoteList class - manages the note list panel
 */
export class NoteList {
  /**
   * @param {HTMLElement} container - The container element for the note list
   * @param {Function} onSelectNote - Callback when a note is selected
   */
  constructor(container, onSelectNote) {
    this.container = container;
    this.onSelectNote = onSelectNote;
    this.notes = [];
    this.selectedNoteId = null;
  }

  /**
   * Render the note list
   * @param {Array} notes - Array of note objects
   */
  render(notes) {
    this.notes = notes;
    this.container.innerHTML = '';

    if (notes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No notes found';
      this.container.appendChild(empty);
      return;
    }

    notes.forEach(note => {
      const item = createNoteItem(note, note.id === this.selectedNoteId);
      item.addEventListener('click', () => this.selectNote(note.id));
      this.container.appendChild(item);
    });
  }

  /**
   * Select a note by ID
   * @param {string} noteId - The note ID to select
   */
  selectNote(noteId) {
    this.selectedNoteId = noteId;

    // Update selection visual
    this.container.querySelectorAll('.note-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.noteId === noteId);
    });

    // Find the note and call the callback
    const note = this.notes.find(n => n.id === noteId);
    if (note && this.onSelectNote) {
      this.onSelectNote(note);
    }
  }

  /**
   * Get the currently selected note
   * @returns {Object|null} The selected note or null
   */
  getSelectedNote() {
    return this.notes.find(n => n.id === this.selectedNoteId) || null;
  }
}
