/**
 * CommentsPanel component - displays comments for a note
 */

import { formatDateTime } from '../lib/noteStore.js';

/**
 * Extract and truncate text preview from content
 * @param {string} content - The full note content
 * @param {number} startChar - Start character position
 * @param {number} endChar - End character position
 * @param {number} maxLength - Maximum preview length (default 50)
 * @returns {string} The truncated preview text
 */
function getTextPreview(content, startChar, endChar, maxLength = 50) {
  if (!content || startChar === undefined || endChar === undefined) {
    return null;
  }

  const text = content.substring(startChar, endChar);
  if (!text) return null;

  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...';
  }
  return text;
}

/**
 * CommentsPanel class - manages the comments panel
 */
export class CommentsPanel {
  /**
   * @param {HTMLElement} container - The container element for comments
   */
  constructor(container) {
    this.container = container;
    this.comments = [];
    this.noteContent = '';
    this.pendingComment = null;
    this.onCommentSubmitCallback = null;
    this.onCommentDeleteCallback = null;
    this.deletingCommentIds = new Set();
  }

  /**
   * Set callback for when a comment is submitted
   * @param {Function} callback - Callback(content, startChar, endChar)
   */
  setOnCommentSubmit(callback) {
    this.onCommentSubmitCallback = callback;
  }

  /**
   * Set callback for when a comment is deleted
   * @param {Function} callback - Callback(commentId)
   */
  setOnCommentDelete(callback) {
    this.onCommentDeleteCallback = callback;
  }

  /**
   * Start creating a new comment
   * @param {number} startChar - Start character position
   * @param {number} endChar - End character position
   * @param {string} selectedText - The selected text
   */
  startNewComment(startChar, endChar, selectedText) {
    this.pendingComment = {
      startChar,
      endChar,
      selectedText: selectedText.length > 50
        ? selectedText.substring(0, 47) + '...'
        : selectedText
    };
    this.renderWithPending();
  }

  /**
   * Cancel the pending comment
   */
  cancelPendingComment() {
    this.pendingComment = null;
    this.render(this.comments);
  }

  /**
   * Submit the pending comment
   * @param {string} content - The comment content
   */
  submitPendingComment(content) {
    if (!this.pendingComment || !content.trim()) {
      return;
    }

    if (this.onCommentSubmitCallback) {
      this.onCommentSubmitCallback(
        content.trim(),
        this.pendingComment.startChar,
        this.pendingComment.endChar
      );
    }

    this.pendingComment = null;
  }

  /**
   * Handle deleting a comment
   * @param {string} commentId - The comment ID
   */
  async handleDeleteComment(commentId) {
    if (!commentId || !this.onCommentDeleteCallback || this.deletingCommentIds.has(commentId)) {
      return;
    }

    const shouldDelete = window.confirm('Delete this comment?');
    if (!shouldDelete) {
      return;
    }

    this.deletingCommentIds.add(commentId);
    if (this.pendingComment) {
      this.renderWithPending();
    } else {
      this.render(this.comments, this.noteContent);
    }

    try {
      await this.onCommentDeleteCallback(commentId);
    } finally {
      this.deletingCommentIds.delete(commentId);
      if (this.pendingComment) {
        this.renderWithPending();
      } else {
        this.render(this.comments, this.noteContent);
      }
    }
  }

  /**
   * Create a comment card element
   * @param {Object} comment - The comment object
   * @returns {HTMLElement} The comment card element
   */
  createCommentCard(comment) {
    const card = document.createElement('div');
    card.className = 'comment-card';

    // Header with author and actions
    const header = document.createElement('div');
    header.className = 'comment-header';

    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = comment.author || 'Anonymous';

    const actions = document.createElement('div');
    actions.className = 'comment-actions';

    const date = document.createElement('span');
    date.className = 'comment-date';
    date.textContent = formatDateTime(comment.created);
    actions.appendChild(date);

    if (comment.id) {
      const isDeleting = this.deletingCommentIds.has(comment.id);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'comment-delete-btn';
      deleteBtn.textContent = isDeleting ? 'Deleting...' : 'Delete';
      deleteBtn.disabled = isDeleting;
      deleteBtn.addEventListener('click', () => this.handleDeleteComment(comment.id));
      actions.appendChild(deleteBtn);
    }

    header.appendChild(author);
    header.appendChild(actions);
    card.appendChild(header);

    // Line or character range reference badge if present
    if (comment.line && comment.line > 0) {
      const lineBadge = document.createElement('div');
      lineBadge.className = 'comment-line';
      lineBadge.textContent = `Line ${comment.line}`;
      card.appendChild(lineBadge);
    } else if (comment.startChar !== undefined && comment.endChar !== undefined && comment.endChar > comment.startChar) {
      const rangeBadge = document.createElement('div');
      rangeBadge.className = 'comment-line';
      rangeBadge.textContent = `Chars ${comment.startChar}-${comment.endChar}`;
      card.appendChild(rangeBadge);

      // Add text preview for character-based comments
      const previewText = getTextPreview(this.noteContent, comment.startChar, comment.endChar);
      if (previewText) {
        const preview = document.createElement('div');
        preview.className = 'comment-preview';
        preview.textContent = `"${previewText}"`;
        card.appendChild(preview);
      }
    }

    // Content
    const content = document.createElement('div');
    content.className = 'comment-content';
    content.textContent = comment.content;
    card.appendChild(content);

    return card;
  }

  /**
   * Create the pending comment card element
   * @returns {HTMLElement} The pending comment card
   */
  createPendingCommentCard() {
    const card = document.createElement('div');
    card.className = 'comment-card comment-card-pending';

    // Header
    const header = document.createElement('div');
    header.className = 'comment-header';

    const title = document.createElement('span');
    title.className = 'comment-author';
    title.textContent = 'New Comment';

    const rangeBadge = document.createElement('span');
    rangeBadge.className = 'comment-line-badge';
    rangeBadge.textContent = `Chars ${this.pendingComment.startChar}-${this.pendingComment.endChar}`;

    header.appendChild(title);
    header.appendChild(rangeBadge);
    card.appendChild(header);

    // Selected text preview
    const preview = document.createElement('div');
    preview.className = 'comment-preview';
    preview.textContent = `"${this.pendingComment.selectedText}"`;
    card.appendChild(preview);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'comment-textarea';
    textarea.placeholder = 'Write your comment...';
    textarea.rows = 3;

    // Handle keyboard events
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitPendingComment(textarea.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelPendingComment();
      }
    });

    card.appendChild(textarea);

    // Buttons
    const buttonRow = document.createElement('div');
    buttonRow.className = 'comment-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'comment-btn comment-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.cancelPendingComment());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'comment-btn comment-btn-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.submitPendingComment(textarea.value));

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    card.appendChild(buttonRow);

    // Focus textarea after adding to DOM
    setTimeout(() => textarea.focus(), 0);

    return card;
  }

  /**
   * Render comments with pending comment card at top
   */
  renderWithPending() {
    this.container.innerHTML = '';

    // Add pending comment card first
    if (this.pendingComment) {
      this.container.appendChild(this.createPendingCommentCard());
    }

    // Add existing comments
    if (this.comments.length === 0 && !this.pendingComment) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments';
      this.container.appendChild(empty);
      return;
    }

    // Sort and render existing comments
    const sortedComments = [...this.comments].sort((a, b) => {
      if (a.line && b.line) return a.line - b.line;
      if (a.line && !b.line) return -1;
      if (!a.line && b.line) return 1;
      return new Date(a.created) - new Date(b.created);
    });

    sortedComments.forEach(comment => {
      this.container.appendChild(this.createCommentCard(comment));
    });
  }

  /**
   * Render comments for a note
   * @param {Array} comments - Array of comment objects
   * @param {string} noteContent - The note's raw content (for text preview)
   */
  render(comments, noteContent = '') {
    this.comments = comments || [];
    this.noteContent = noteContent;
    this.container.innerHTML = '';

    if (this.comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments';
      this.container.appendChild(empty);
      return;
    }

    // Sort comments: inline comments (with line) first, then by date
    const sortedComments = [...this.comments].sort((a, b) => {
      // Both have lines - sort by line number
      if (a.line && b.line) {
        return a.line - b.line;
      }
      // Only a has line - a comes first
      if (a.line && !b.line) {
        return -1;
      }
      // Only b has line - b comes first
      if (!a.line && b.line) {
        return 1;
      }
      // Neither has line - sort by date
      return new Date(a.created) - new Date(b.created);
    });

    sortedComments.forEach(comment => {
      this.container.appendChild(this.createCommentCard(comment));
    });
  }

  /**
   * Clear the comments panel
   */
  clear() {
    this.comments = [];
    this.deletingCommentIds.clear();
    this.container.innerHTML = '<p class="empty-state">No comments</p>';
  }
}
