import { formatDateTime } from '../lib/noteStore';
import type { NoteComment } from '../types';

interface PendingComment {
  startChar: number;
  endChar: number;
  selectedText: string;
}

type CommentSubmitHandler = (
  content: string,
  startChar: number,
  endChar: number,
) => void | Promise<void>;
type CommentDeleteHandler = (commentId: string) => void | Promise<void>;

function getTextPreview(
  content: string,
  startChar: number,
  endChar: number,
  maxLength = 50,
): string | null {
  if (!content || endChar <= startChar) {
    return null;
  }

  const text = content.substring(startChar, endChar);
  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    return `${text.substring(0, maxLength - 3)}...`;
  }

  return text;
}

function parseDate(value: string): number {
  return new Date(value).getTime();
}

export class CommentsPanel {
  private container: HTMLElement;
  private comments: NoteComment[];
  private noteContent: string;
  private pendingComment: PendingComment | null;
  private onCommentSubmitCallback: CommentSubmitHandler | null;
  private onCommentDeleteCallback: CommentDeleteHandler | null;
  private deletingCommentIds: Set<string>;

  constructor(container: HTMLElement) {
    this.container = container;
    this.comments = [];
    this.noteContent = '';
    this.pendingComment = null;
    this.onCommentSubmitCallback = null;
    this.onCommentDeleteCallback = null;
    this.deletingCommentIds = new Set<string>();
  }

  setOnCommentSubmit(callback: CommentSubmitHandler): void {
    this.onCommentSubmitCallback = callback;
  }

  setOnCommentDelete(callback: CommentDeleteHandler): void {
    this.onCommentDeleteCallback = callback;
  }

  startNewComment(startChar: number, endChar: number, selectedText: string): void {
    this.pendingComment = {
      startChar,
      endChar,
      selectedText:
        selectedText.length > 50 ? `${selectedText.substring(0, 47)}...` : selectedText,
    };

    this.renderWithPending();
  }

  private cancelPendingComment(): void {
    this.pendingComment = null;
    this.render(this.comments, this.noteContent);
  }

  private submitPendingComment(content: string): void {
    if (!this.pendingComment || !content.trim()) {
      return;
    }

    if (this.onCommentSubmitCallback) {
      this.onCommentSubmitCallback(
        content.trim(),
        this.pendingComment.startChar,
        this.pendingComment.endChar,
      );
    }

    this.pendingComment = null;
  }

  private async handleDeleteComment(commentId: string): Promise<void> {
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

  private createCommentCard(comment: NoteComment): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'comment-card';

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
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'comment-delete-btn';
      deleteButton.textContent = isDeleting ? 'Deleting...' : 'Delete';
      deleteButton.disabled = isDeleting;
      deleteButton.addEventListener('click', () => {
        void this.handleDeleteComment(comment.id);
      });
      actions.appendChild(deleteButton);
    }

    header.append(author, actions);
    card.appendChild(header);

    if (comment.line > 0) {
      const lineBadge = document.createElement('div');
      lineBadge.className = 'comment-line';
      lineBadge.textContent = `Line ${comment.line}`;
      card.appendChild(lineBadge);
    } else if (comment.endChar > comment.startChar) {
      const rangeBadge = document.createElement('div');
      rangeBadge.className = 'comment-line';
      rangeBadge.textContent = `Chars ${comment.startChar}-${comment.endChar}`;
      card.appendChild(rangeBadge);

      const previewText = getTextPreview(this.noteContent, comment.startChar, comment.endChar);
      if (previewText) {
        const preview = document.createElement('div');
        preview.className = 'comment-preview';
        preview.textContent = `"${previewText}"`;
        card.appendChild(preview);
      }
    }

    const content = document.createElement('div');
    content.className = 'comment-content';
    content.textContent = comment.content;
    card.appendChild(content);

    return card;
  }

  private createPendingCommentCard(): HTMLDivElement {
    const pendingComment = this.pendingComment;
    if (!pendingComment) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'comment-card';
      return emptyCard;
    }

    const card = document.createElement('div');
    card.className = 'comment-card comment-card-pending';

    const header = document.createElement('div');
    header.className = 'comment-header';

    const title = document.createElement('span');
    title.className = 'comment-author';
    title.textContent = 'New Comment';

    const rangeBadge = document.createElement('span');
    rangeBadge.className = 'comment-line-badge';
    rangeBadge.textContent = `Chars ${pendingComment.startChar}-${pendingComment.endChar}`;

    header.append(title, rangeBadge);
    card.appendChild(header);

    const preview = document.createElement('div');
    preview.className = 'comment-preview';
    preview.textContent = `"${pendingComment.selectedText}"`;
    card.appendChild(preview);

    const textarea = document.createElement('textarea');
    textarea.className = 'comment-textarea';
    textarea.placeholder = 'Write your comment...';
    textarea.rows = 3;

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submitPendingComment(textarea.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelPendingComment();
      }
    });

    card.appendChild(textarea);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'comment-buttons';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'comment-btn comment-btn-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => this.cancelPendingComment());

    const saveButton = document.createElement('button');
    saveButton.className = 'comment-btn comment-btn-save';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => this.submitPendingComment(textarea.value));

    buttonRow.append(cancelButton, saveButton);
    card.appendChild(buttonRow);

    setTimeout(() => textarea.focus(), 0);

    return card;
  }

  private renderWithPending(): void {
    this.container.innerHTML = '';

    if (this.pendingComment) {
      this.container.appendChild(this.createPendingCommentCard());
    }

    if (this.comments.length === 0 && !this.pendingComment) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments';
      this.container.appendChild(empty);
      return;
    }

    const sortedComments = [...this.comments].sort((a, b) => {
      if (a.line > 0 && b.line > 0) {
        return a.line - b.line;
      }

      if (a.line > 0 && b.line <= 0) {
        return -1;
      }

      if (a.line <= 0 && b.line > 0) {
        return 1;
      }

      return parseDate(a.created) - parseDate(b.created);
    });

    for (const comment of sortedComments) {
      this.container.appendChild(this.createCommentCard(comment));
    }
  }

  render(comments: NoteComment[] = [], noteContent = ''): void {
    this.comments = comments;
    this.noteContent = noteContent;
    this.container.innerHTML = '';

    if (this.comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments';
      this.container.appendChild(empty);
      return;
    }

    const sortedComments = [...this.comments].sort((a, b) => {
      if (a.line > 0 && b.line > 0) {
        return a.line - b.line;
      }

      if (a.line > 0 && b.line <= 0) {
        return -1;
      }

      if (a.line <= 0 && b.line > 0) {
        return 1;
      }

      return parseDate(a.created) - parseDate(b.created);
    });

    for (const comment of sortedComments) {
      this.container.appendChild(this.createCommentCard(comment));
    }
  }

  clear(): void {
    this.comments = [];
    this.deletingCommentIds.clear();
    this.container.innerHTML = '<p class="empty-state">No comments</p>';
  }
}
