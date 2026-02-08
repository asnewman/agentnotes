import { Editor } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import { getAllHighlightRanges } from '../lib/highlighter';
import { formatDate } from '../lib/noteStore';
import { findTextInContent, getTextFromEditor } from '../lib/positionMapper';
import type { CommentAnchor, Note } from '../types';
import { createPriorityBadge, createTagChip } from './TagChip';

interface CurrentSelection {
  anchor: CommentAnchor;
  text: string;
}

type CommentCreateHandler = (anchor: CommentAnchor, selectedText: string) => void;
type NoteSaveHandler = (noteId: string, content: string) => Promise<Note | null>;

const anchorContextChars = 64;

export class NoteView {
  private headerContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private editor: Editor | null;
  private currentNote: Note | null;
  private tooltip: HTMLDivElement | null;
  private onCommentCreateCallback: CommentCreateHandler | null;
  private onNoteSaveCallback: NoteSaveHandler | null;
  private currentSelection: CurrentSelection | null;
  private isEditing: boolean;
  private isSaving: boolean;

  constructor(headerContainer: HTMLElement, contentContainer: HTMLElement) {
    this.headerContainer = headerContainer;
    this.contentContainer = contentContainer;
    this.editor = null;
    this.currentNote = null;
    this.tooltip = null;
    this.onCommentCreateCallback = null;
    this.onNoteSaveCallback = null;
    this.currentSelection = null;
    this.isEditing = false;
    this.isSaving = false;
  }

  setOnCommentCreate(callback: CommentCreateHandler): void {
    this.onCommentCreateCallback = callback;
  }

  setOnNoteSave(callback: NoteSaveHandler): void {
    this.onNoteSaveCallback = callback;
  }

  private initEditor(): void {
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
            class: 'highlighted-comment',
          },
        }),
      ],
      content: '',
      editable: false,
      onSelectionUpdate: ({ editor }: { editor: Editor }) => {
        this.handleSelectionUpdate(editor);
      },
    });

    editorElement.addEventListener('keydown', (event) => {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && this.isEditing;

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      void this.saveEdits();
    });

    document.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (this.tooltip && target instanceof Node && !this.tooltip.contains(target)) {
        this.hideSelectionTooltip();
      }
    });
  }

  private handleSelectionUpdate(editor: Editor): void {
    if (this.isEditing) {
      this.hideSelectionTooltip();
      return;
    }

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

    const positions = findTextInContent(this.currentNote.content, selectedText, from);
    if (!positions) {
      this.hideSelectionTooltip();
      return;
    }

    this.currentSelection = {
      anchor: this.buildAnchor(this.currentNote.content, positions.startChar, positions.endChar),
      text: selectedText.trim(),
    };

    this.showSelectionTooltip();
  }

  private showSelectionTooltip(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!this.tooltip) {
      this.createTooltip();
    }

    if (!this.tooltip) {
      return;
    }

    const tooltipHeight = 32;
    const arrowHeight = 6;
    const top = rect.top - tooltipHeight - arrowHeight - 4;
    const left = rect.left + rect.width / 2;

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.classList.add('visible');
  }

  private hideSelectionTooltip(): void {
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }

    this.currentSelection = null;
  }

  private createTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'selection-tooltip';

    const button = document.createElement('button');
    button.className = 'selection-tooltip-button';
    button.innerHTML = '<span class="tooltip-icon">&#128172;</span> Comment';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.handleCommentClick();
    });

    this.tooltip.appendChild(button);
    document.body.appendChild(this.tooltip);
  }

  private handleCommentClick(): void {
    if (this.currentSelection && this.onCommentCreateCallback) {
      this.onCommentCreateCallback(this.currentSelection.anchor, this.currentSelection.text);
    }

    this.hideSelectionTooltip();
    window.getSelection()?.removeAllRanges();
  }

  private startEditMode(): void {
    if (!this.currentNote || !this.editor || this.isSaving) {
      return;
    }

    this.isEditing = true;
    this.hideSelectionTooltip();
    window.getSelection()?.removeAllRanges();
    this.updateEditorMode();
    this.renderActions(this.currentNote);
    this.editor.commands.focus('end');
  }

  private cancelEdits(): void {
    if (!this.currentNote || this.isSaving) {
      return;
    }

    this.isEditing = false;
    this.render(this.currentNote);
  }

  private async saveEdits(): Promise<void> {
    if (!this.currentNote || !this.editor || !this.onNoteSaveCallback || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.renderActions(this.currentNote);

    try {
      const content = this.getEditorText();
      const updatedNote = await this.onNoteSaveCallback(this.currentNote.id, content);

      if (updatedNote) {
        this.isEditing = false;
        this.render(updatedNote);
        return;
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      this.isSaving = false;
      if (this.currentNote) {
        this.renderActions(this.currentNote);
      }
    }
  }

  private getEditorText(): string {
    if (!this.editor) {
      return '';
    }

    return this.editor.state.doc.textBetween(0, this.editor.state.doc.content.size, '\n', '\n');
  }

  private updateEditorMode(): void {
    if (!this.editor) {
      return;
    }

    this.editor.setEditable(this.isEditing);
  }

  render(note: Note | null): void {
    if (!note) {
      this.renderEmpty();
      return;
    }

    const isDifferentNote = this.currentNote?.id !== note.id;
    if (isDifferentNote) {
      this.isEditing = false;
      this.isSaving = false;
      this.hideSelectionTooltip();
    }

    this.currentNote = note;
    this.renderHeader(note);
    this.renderContent(note);
  }

  private renderHeader(note: Note): void {
    const titleElement = this.headerContainer.querySelector<HTMLElement>('.note-title');
    if (titleElement) {
      titleElement.textContent = note.title;
    }

    const metaElement = this.headerContainer.querySelector<HTMLElement>('.note-meta');
    if (metaElement) {
      metaElement.innerHTML = '';

      const createdItem = document.createElement('span');
      createdItem.className = 'note-meta-item';
      createdItem.textContent = `Created: ${formatDate(note.created)}`;
      metaElement.appendChild(createdItem);

      const updatedItem = document.createElement('span');
      updatedItem.className = 'note-meta-item';
      updatedItem.textContent = `Updated: ${formatDate(note.updated)}`;
      metaElement.appendChild(updatedItem);

      if (note.source) {
        const sourceItem = document.createElement('span');
        sourceItem.className = 'note-meta-item';
        sourceItem.textContent = `Source: ${note.source}`;
        metaElement.appendChild(sourceItem);
      }
    }

    const tagsElement = this.headerContainer.querySelector<HTMLElement>('.note-tags');
    if (tagsElement) {
      tagsElement.innerHTML = '';

      if (note.priority > 0) {
        const badge = createPriorityBadge(note.priority);
        if (badge) {
          tagsElement.appendChild(badge);
        }
      }

      for (const tag of note.tags) {
        tagsElement.appendChild(createTagChip(tag));
      }
    }

    this.renderActions(note);
  }

  private renderActions(note: Note): void {
    const actionsElement = this.headerContainer.querySelector<HTMLElement>('.note-actions');
    if (!actionsElement) {
      return;
    }

    actionsElement.innerHTML = '';

    if (this.isEditing) {
      const cancelButton = document.createElement('button');
      cancelButton.className = 'note-action-btn note-action-cancel';
      cancelButton.textContent = 'Cancel';
      cancelButton.disabled = this.isSaving;
      cancelButton.addEventListener('click', () => {
        this.cancelEdits();
      });

      const saveButton = document.createElement('button');
      saveButton.className = 'note-action-btn note-action-save';
      saveButton.textContent = this.isSaving ? 'Saving...' : 'Save';
      saveButton.disabled = this.isSaving;
      saveButton.addEventListener('click', () => {
        void this.saveEdits();
      });

      actionsElement.appendChild(cancelButton);
      actionsElement.appendChild(saveButton);
      return;
    }

    const editButton = document.createElement('button');
    editButton.className = 'note-action-btn note-action-edit';
    editButton.textContent = 'Edit';
    editButton.disabled = this.isSaving;
    editButton.addEventListener('click', () => {
      this.startEditMode();
    });

    editButton.title = `Edit ${note.title}`;
    actionsElement.appendChild(editButton);
  }

  private renderContent(note: Note): void {
    if (!this.editor) {
      this.initEditor();
    }

    if (!this.editor) {
      return;
    }

    const content = this.markdownToTipTap(note.content);
    this.editor.commands.setContent(content);
    this.updateEditorMode();
    this.applyHighlights(note);
  }

  private markdownToTipTap(markdown: string): string {
    if (!markdown) {
      return '<p></p>';
    }

    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    return `<p>${escaped}</p>`;
  }

  private buildAnchor(content: string, startChar: number, endChar: number): CommentAnchor {
    const prefixStart = Math.max(0, startChar - anchorContextChars);
    const suffixEnd = Math.min(content.length, endChar + anchorContextChars);

    return {
      exact: content.slice(startChar, endChar),
      prefix: content.slice(prefixStart, startChar),
      suffix: content.slice(endChar, suffixEnd),
    };
  }

  private applyHighlights(note: Note): void {
    if (!this.editor || note.comments.length === 0 || this.isEditing) {
      return;
    }

    const ranges = getAllHighlightRanges(note.content, note.comments);
    if (ranges.length === 0) {
      return;
    }

    for (const range of ranges) {
      try {
        this.editor
          .chain()
          .setTextSelection({ from: range.from + 1, to: range.to + 1 })
          .setHighlight()
          .run();
      } catch {
        console.debug('Could not apply highlight to range:', range);
      }
    }

    this.editor.commands.setTextSelection(1);
  }

  clear(): void {
    this.renderEmpty();
  }

  private renderEmpty(): void {
    this.currentNote = null;
    this.isEditing = false;
    this.isSaving = false;
    this.hideSelectionTooltip();

    const titleElement = this.headerContainer.querySelector<HTMLElement>('.note-title');
    if (titleElement) {
      titleElement.textContent = 'Select a note';
    }

    const metaElement = this.headerContainer.querySelector<HTMLElement>('.note-meta');
    if (metaElement) {
      metaElement.innerHTML = '';
    }

    const tagsElement = this.headerContainer.querySelector<HTMLElement>('.note-tags');
    if (tagsElement) {
      tagsElement.innerHTML = '';
    }

    const actionsElement = this.headerContainer.querySelector<HTMLElement>('.note-actions');
    if (actionsElement) {
      actionsElement.innerHTML = '';
    }

    this.contentContainer.innerHTML =
      '<p class="empty-state">Select a note from the list to view its content.</p>';

    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  destroy(): void {
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
