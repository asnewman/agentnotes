/**
 * CommentsPanel component - displays comments for a note
 */

import { formatDateTime } from '../lib/noteStore.js';

/**
 * Create a comment card element
 * @param {Object} comment - The comment object
 * @returns {HTMLElement} The comment card element
 */
function createCommentCard(comment) {
  const card = document.createElement('div');
  card.className = 'comment-card';

  // Header with author and date
  const header = document.createElement('div');
  header.className = 'comment-header';

  const author = document.createElement('span');
  author.className = 'comment-author';
  author.textContent = comment.author || 'Anonymous';

  const date = document.createElement('span');
  date.className = 'comment-date';
  date.textContent = formatDateTime(comment.created);

  header.appendChild(author);
  header.appendChild(date);
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
  }

  // Content
  const content = document.createElement('div');
  content.className = 'comment-content';
  content.textContent = comment.content;
  card.appendChild(content);

  return card;
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
  }

  /**
   * Render comments for a note
   * @param {Array} comments - Array of comment objects
   */
  render(comments) {
    this.comments = comments || [];
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
      this.container.appendChild(createCommentCard(comment));
    });
  }

  /**
   * Clear the comments panel
   */
  clear() {
    this.comments = [];
    this.container.innerHTML = '<p class="empty-state">No comments</p>';
  }
}
