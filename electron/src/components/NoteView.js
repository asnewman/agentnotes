/**
 * NoteView component - displays note content with TipTap editor
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { formatDate } from '../lib/noteStore.js';
import { createTagChip, createPriorityBadge } from './TagChip.js';
import { getAllHighlightRanges } from '../lib/highlighter.js';
import { findTextInContent, getTextFromEditor } from '../lib/positionMapper.js';

/**
 * NoteView class - manages the note content panel
 */
export class NoteView {
  /**
   * @param {HTMLElement} headerContainer - Container for note header
   * @param {HTMLElement} contentContainer - Container for note content
   */
  constructor(headerContainer, contentContainer) {
    this.headerContainer = headerContainer;
    this.contentContainer = contentContainer;
    this.editor = null;
    this.currentNote = null;
    this.tooltip = null;
    this.onCommentCreateCallback = null;
    this.currentSelection = null;
  }

  /**
   * Set callback for when user wants to create a comment
   * @param {Function} callback - Callback(startChar, endChar, selectedText)
   */
  setOnCommentCreate(callback) {
    this.onCommentCreateCallback = callback;
  }

  /**
   * Initialize the TipTap editor
   */
  initEditor() {
    // Clear any existing editor
    if (this.editor) {
      this.editor.destroy();
    }

    this.contentContainer.innerHTML = '';

    const editorElement = document.createElement('div');
    editorElement.className = 'tiptap-editor';
    this.contentContainer.appendChild(editorElement);

    this.editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Highlight.configure({
          multicolor: false,
          HTMLAttributes: {
            class: 'highlighted-comment'
          }
        })
      ],
      content: '',
      editable: false, // Read-only mode
      onSelectionUpdate: ({ editor }) => {
        this.handleSelectionUpdate(editor);
      }
    });

    // Hide tooltip when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.tooltip && !this.tooltip.contains(e.target)) {
        this.hideSelectionTooltip();
      }
    });
  }

  /**
   * Handle selection update from TipTap editor
   * @param {Object} editor - TipTap editor instance
   */
  handleSelectionUpdate(editor) {
    const { from, to } = editor.state.selection;

    if (from === to || !this.currentNote) {
      this.hideSelectionTooltip();
      return;
    }

    const selectedText = getTextFromEditor(editor, from, to);
    if (!selectedText || selectedText.trim().length === 0) {
      this.hideSelectionTooltip();
      return;
    }

    // Find the position in raw content
    const positions = findTextInContent(this.currentNote.content, selectedText, from);
    if (!positions) {
      this.hideSelectionTooltip();
      return;
    }

    this.currentSelection = {
      startChar: positions.startChar,
      endChar: positions.endChar,
      text: selectedText
    };

    this.showSelectionTooltip();
  }

  /**
   * Show the selection tooltip near the selected text
   */
  showSelectionTooltip() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!this.tooltip) {
      this.createTooltip();
    }

    // Position tooltip above the selection
    const tooltipHeight = 32;
    const arrowHeight = 6;
    const top = rect.top - tooltipHeight - arrowHeight - 4;
    const left = rect.left + (rect.width / 2);

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.classList.add('visible');
  }

  /**
   * Hide the selection tooltip
   */
  hideSelectionTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }
    this.currentSelection = null;
  }

  /**
   * Create the selection tooltip element
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'selection-tooltip';

    const button = document.createElement('button');
    button.className = 'selection-tooltip-button';
    button.innerHTML = `<span class="tooltip-icon">&#128172;</span> Comment`;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleCommentClick();
    });

    this.tooltip.appendChild(button);
    document.body.appendChild(this.tooltip);
  }

  /**
   * Handle click on the comment button in tooltip
   */
  handleCommentClick() {
    if (this.currentSelection && this.onCommentCreateCallback) {
      this.onCommentCreateCallback(
        this.currentSelection.startChar,
        this.currentSelection.endChar,
        this.currentSelection.text
      );
    }
    this.hideSelectionTooltip();

    // Clear the selection
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Render a note
   * @param {Object} note - The note object to display
   */
  render(note) {
    if (!note) {
      this.renderEmpty();
      return;
    }

    this.currentNote = note;
    this.renderHeader(note);
    this.renderContent(note);
  }

  /**
   * Render the note header
   * @param {Object} note - The note object
   */
  renderHeader(note) {
    // Title
    const titleEl = this.headerContainer.querySelector('.note-title');
    if (titleEl) {
      titleEl.textContent = note.title;
    }

    // Meta information
    const metaEl = this.headerContainer.querySelector('.note-meta');
    if (metaEl) {
      metaEl.innerHTML = '';

      const createdItem = document.createElement('span');
      createdItem.className = 'note-meta-item';
      createdItem.textContent = `Created: ${formatDate(note.created)}`;
      metaEl.appendChild(createdItem);

      const updatedItem = document.createElement('span');
      updatedItem.className = 'note-meta-item';
      updatedItem.textContent = `Updated: ${formatDate(note.updated)}`;
      metaEl.appendChild(updatedItem);

      if (note.source) {
        const sourceItem = document.createElement('span');
        sourceItem.className = 'note-meta-item';
        sourceItem.textContent = `Source: ${note.source}`;
        metaEl.appendChild(sourceItem);
      }
    }

    // Tags
    const tagsEl = this.headerContainer.querySelector('.note-tags');
    if (tagsEl) {
      tagsEl.innerHTML = '';

      // Priority badge first
      if (note.priority && note.priority > 0) {
        const badge = createPriorityBadge(note.priority);
        if (badge) {
          tagsEl.appendChild(badge);
        }
      }

      // Tags
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
          tagsEl.appendChild(createTagChip(tag));
        });
      }
    }
  }

  /**
   * Render the note content with TipTap
   * @param {Object} note - The note object
   */
  renderContent(note) {
    if (!this.editor) {
      this.initEditor();
    }

    // Display content as plain text to preserve exact character positions
    const content = this.markdownToTipTap(note.content);
    this.editor.commands.setContent(content);

    // Apply highlights for commented lines
    this.applyHighlights(note);
  }

  /**
   * Convert markdown content to TipTap-compatible format
   * Display as plain text in a paragraph to preserve exact character positions for comment highlighting
   * Uses <p> instead of <pre> because TipTap CodeBlock nodes don't support marks like Highlight
   * @param {string} markdown - The markdown content
   * @returns {string} HTML content for TipTap
   */
  markdownToTipTap(markdown) {
    if (!markdown) return '<p></p>';
    // Display as plain text in a paragraph (supports marks, unlike pre/code)
    // Convert newlines to <br> to preserve line structure
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return '<p>' + escaped + '</p>';
  }

  /**
   * Apply yellow highlights to commented text
   * @param {Object} note - The note object
   */
  applyHighlights(note) {
    if (!this.editor || !note.comments || note.comments.length === 0) {
      return;
    }

    // Get all highlight ranges from comments (both character-based and line-based)
    const ranges = getAllHighlightRanges(note.content, note.comments);
    if (ranges.length === 0) {
      return;
    }

    // Apply highlights to each range
    // Since we display raw markdown as plain text, positions match directly
    // TipTap position = raw position + 1 (document starts at 0, first char at 1)
    for (const range of ranges) {
      try {
        this.editor.chain()
          .setTextSelection({ from: range.from + 1, to: range.to + 1 })
          .setHighlight()
          .run();
      } catch (e) {
        console.debug('Could not apply highlight to range:', range);
      }
    }

    // Reset cursor position
    this.editor.commands.setTextSelection(1);
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.currentNote = null;

    const titleEl = this.headerContainer.querySelector('.note-title');
    if (titleEl) {
      titleEl.textContent = 'Select a note';
    }

    const metaEl = this.headerContainer.querySelector('.note-meta');
    if (metaEl) {
      metaEl.innerHTML = '';
    }

    const tagsEl = this.headerContainer.querySelector('.note-tags');
    if (tagsEl) {
      tagsEl.innerHTML = '';
    }

    this.contentContainer.innerHTML = '<p class="empty-state">Select a note from the list to view its content.</p>';

    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  /**
   * Destroy the editor
   */
  destroy() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}
