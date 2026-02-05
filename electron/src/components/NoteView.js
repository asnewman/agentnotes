/**
 * NoteView component - displays note content with TipTap editor
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { formatDate } from '../lib/noteStore.js';
import { createTagChip, createPriorityBadge } from './TagChip.js';
import { getAllHighlightRanges } from '../lib/highlighter.js';

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
      editable: false // Read-only mode
    });
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

    // Convert markdown to HTML-like content for TipTap
    // TipTap StarterKit handles basic markdown parsing
    const content = this.markdownToTipTap(note.content);
    this.editor.commands.setContent(content);

    // Apply highlights for commented lines
    this.applyHighlights(note);
  }

  /**
   * Convert markdown content to TipTap-compatible format
   * @param {string} markdown - The markdown content
   * @returns {string} HTML content for TipTap
   */
  markdownToTipTap(markdown) {
    if (!markdown) return '<p></p>';

    // Basic markdown to HTML conversion
    let html = markdown
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Code blocks (must be before inline code)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      .replace(/^\*\*\*$/gm, '<hr>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      // Line breaks to paragraphs
      .split('\n\n')
      .map(para => {
        // Don't wrap if already has block element
        if (para.match(/^<(h[1-6]|pre|blockquote|ul|ol|li|hr)/)) {
          return para;
        }
        // Wrap list items in ul
        if (para.includes('<li>')) {
          return '<ul>' + para + '</ul>';
        }
        return para.trim() ? '<p>' + para.replace(/\n/g, '<br>') + '</p>' : '';
      })
      .join('');

    return html || '<p></p>';
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
    for (const range of ranges) {
      // TipTap positions are 1-indexed and need to account for document structure
      // This is a simplified approach - for complex documents we'd need to map positions
      try {
        this.editor.chain()
          .setTextSelection({ from: range.from + 1, to: range.to + 1 })
          .setHighlight()
          .run();
      } catch (e) {
        // Position might be out of bounds after markdown conversion
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
  }
}
