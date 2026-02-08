import { formatDateTime } from '../lib/noteStore';
import type { CommentAnchor, NoteComment } from '../types';

interface PendingComment {
  anchor: CommentAnchor;
  selectedText: string;
}

type CommentSubmitHandler = (content: string, anchor: CommentAnchor) => void | Promise<void>;
type CommentDeleteHandler = (commentId: string) => void | Promise<void>;

function parseDate(value: string): number {
  return new Date(value).getTime();
}

export class CommentsPanel {
  private container: HTMLElement;
  private comments: NoteComment[];
  private pendingComment: PendingComment | null;
  private onCommentSubmitCallback: CommentSubmitHandler | null;
  private onCommentDeleteCallback: CommentDeleteHandler | null;
  private deletingCommentIds: Set<string>;

  constructor(container: HTMLElement) {
    this.container = container;
    this.comments = [];
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

  startNewComment(anchor: CommentAnchor, selectedText: string): void {
    this.pendingComment = {
      anchor,
      selectedText:
        selectedText.length > 50 ? `${selectedText.substring(0, 47)}...` : selectedText,
    };

    this.renderWithPending();
  }

  private cancelPendingComment(): void {
    this.pendingComment = null;
    this.render(this.comments);
  }

  private submitPendingComment(content: string): void {
    if (!this.pendingComment || !content.trim()) {
      return;
    }

    if (this.onCommentSubmitCallback) {
      this.onCommentSubmitCallback(content.trim(), this.pendingComment.anchor);
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
      this.render(this.comments);
    }

    try {
      await this.onCommentDeleteCallback(commentId);
    } finally {
      this.deletingCommentIds.delete(commentId);
      if (this.pendingComment) {
        this.renderWithPending();
      } else {
        this.render(this.comments);
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

    const statusBadge = document.createElement('span');
    statusBadge.className = 'comment-line-badge';
    statusBadge.textContent = comment.status;
    actions.appendChild(statusBadge);

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

    const previewText = comment.anchor.quote || '';
    if (previewText) {
      const preview = document.createElement('div');
      preview.className = 'comment-preview';
      preview.textContent = `"${previewText.length > 80 ? `${previewText.substring(0, 77)}...` : previewText}"`;
      card.appendChild(preview);
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

    const anchorBadge = document.createElement('span');
    anchorBadge.className = 'comment-line-badge';
    anchorBadge.textContent = 'Anchored text';

    header.append(title, anchorBadge);
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
      return parseDate(a.created) - parseDate(b.created);
    });

    for (const comment of sortedComments) {
      this.container.appendChild(this.createCommentCard(comment));
    }
  }

  render(comments: NoteComment[] = []): void {
    this.comments = comments;
    this.container.innerHTML = '';

    if (this.comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments';
      this.container.appendChild(empty);
      return;
    }

    const sortedComments = [...this.comments].sort((a, b) => {
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
