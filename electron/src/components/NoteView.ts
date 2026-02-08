import { Editor } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import { buildAnchorFromRange, getAllHighlightRanges } from '../lib/highlighter';
import { formatDate } from '../lib/noteStore';
import type { CommentAnchor, Note } from '../types';
import { createPriorityBadge, createTagChip } from './TagChip';

interface CurrentSelection {
  anchor: CommentAnchor;
  text: string;
}

type CommentCreateHandler = (anchor: CommentAnchor, selectedText: string) => void;
type NoteSaveHandler = (noteId: string, content: string) => Promise<Note | null>;
interface SaveEditsOptions {
  keepEditing?: boolean;
}

export class NoteView {
  private headerContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private editor: Editor | null;
  private currentNote: Note | null;
  private tooltip: HTMLDivElement | null;
  private onCommentCreateCallback: CommentCreateHandler | null;
  private onNoteSaveCallback: NoteSaveHandler | null;
  private currentSelection: CurrentSelection | null;
  private isSaving: boolean;
  private autosaveTimer: number | null;
  private pendingAutosave: boolean;
  private lastSavedContent: string;
  private isApplyingContent: boolean;

  constructor(headerContainer: HTMLElement, contentContainer: HTMLElement) {
    this.headerContainer = headerContainer;
    this.contentContainer = contentContainer;
    this.editor = null;
    this.currentNote = null;
    this.tooltip = null;
    this.onCommentCreateCallback = null;
    this.onNoteSaveCallback = null;
    this.currentSelection = null;
    this.isSaving = false;
    this.autosaveTimer = null;
    this.pendingAutosave = false;
    this.lastSavedContent = '';
    this.isApplyingContent = false;
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
      editable: true,
      onSelectionUpdate: ({ editor }: { editor: Editor }) => {
        this.handleSelectionUpdate(editor);
      },
      onUpdate: ({ editor }: { editor: Editor }) => {
        this.handleEditorUpdate(editor);
      },
    });

    editorElement.addEventListener('keydown', (event) => {
      const isSaveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      void this.saveEdits({ keepEditing: true });
    });

    document.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (this.tooltip && target instanceof Node && !this.tooltip.contains(target)) {
        this.hideSelectionTooltip();
      }
    });
  }

  private handleSelectionUpdate(editor: Editor): void {
    const { from, to } = editor.state.selection;

    if (from === to || !this.currentNote) {
      this.hideSelectionTooltip();
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n');
    if (!selectedText || selectedText.trim().length === 0) {
      this.hideSelectionTooltip();
      return;
    }

    const content = this.getEditorText();
    const prefixText = editor.state.doc.textBetween(0, from, '\n', '\n');
    const startChar = prefixText.length;
    const endChar = startChar + selectedText.length;

    if (endChar > content.length) {
      this.hideSelectionTooltip();
      return;
    }

    try {
      this.currentSelection = {
        anchor: this.buildAnchor(content, startChar, endChar),
        text: selectedText.trim(),
      };
    } catch {
      this.hideSelectionTooltip();
      return;
    }

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

  private async saveEdits(options: SaveEditsOptions = {}): Promise<void> {
    if (!this.currentNote || !this.editor || !this.onNoteSaveCallback) {
      return;
    }

    const keepEditing = options.keepEditing ?? false;
    const contentToSave = this.getEditorText();
    if (contentToSave === this.lastSavedContent) {
      return;
    }

    if (this.isSaving) {
      this.pendingAutosave = true;
      return;
    }

    this.isSaving = true;
    this.renderActions();

    try {
      const noteId = this.currentNote.id;
      const updatedNote = await this.onNoteSaveCallback(noteId, contentToSave);

      if (updatedNote) {
        if (this.currentNote?.id !== noteId) {
          return;
        }

        if (keepEditing) {
          const latestContent = this.getEditorText();
          this.lastSavedContent = contentToSave;
          this.currentNote = { ...updatedNote, content: latestContent };
          this.renderHeader(this.currentNote);

          if (latestContent !== contentToSave) {
            this.pendingAutosave = true;
          }
          return;
        }

        this.lastSavedContent = updatedNote.content;
        this.render(updatedNote);
        return;
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      this.isSaving = false;
      if (this.currentNote) {
        this.renderActions();
      }

      if (this.pendingAutosave) {
        this.pendingAutosave = false;
        this.scheduleAutosave();
      }
    }
  }

  private getEditorText(): string {
    if (!this.editor) {
      return '';
    }

    return this.editor.state.doc.textBetween(0, this.editor.state.doc.content.size, '\n', '\n');
  }

  private handleEditorUpdate(editor: Editor): void {
    if (!this.currentNote || this.isApplyingContent) {
      return;
    }

    const content = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n');
    if (content === this.lastSavedContent) {
      return;
    }

    this.scheduleAutosave();
  }

  private scheduleAutosave(delayMs = 200): void {
    if (!this.currentNote || !this.editor) {
      return;
    }

    this.clearAutosaveTimer();
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;

      if (!this.currentNote || !this.editor) {
        return;
      }

      if (this.isSaving) {
        this.pendingAutosave = true;
        return;
      }

      void this.saveEdits({ keepEditing: true });
    }, delayMs);
  }

  private clearAutosaveTimer(): void {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  render(note: Note | null): void {
    if (!note) {
      this.renderEmpty();
      return;
    }

    const isDifferentNote = this.currentNote?.id !== note.id;
    if (isDifferentNote) {
      this.clearAutosaveTimer();
      this.isSaving = false;
      this.pendingAutosave = false;
      this.hideSelectionTooltip();
    }

    this.currentNote = note;
    this.lastSavedContent = note.content;
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

    this.renderActions();
  }

  private renderActions(): void {
    const actionsElement = this.headerContainer.querySelector<HTMLElement>('.note-actions');
    if (!actionsElement) {
      return;
    }

    actionsElement.innerHTML = '';

    const saveStatus = document.createElement('span');
    saveStatus.className = 'note-save-status';
    saveStatus.textContent = this.isSaving ? 'Saving...' : 'Autosave on';
    actionsElement.appendChild(saveStatus);
  }

  private renderContent(note: Note): void {
    if (!this.editor) {
      this.initEditor();
    }

    if (!this.editor) {
      return;
    }

    const content = this.markdownToTipTap(note.content);
    this.isApplyingContent = true;
    try {
      this.editor.commands.setContent(content);
    } finally {
      this.isApplyingContent = false;
    }
    this.editor.setEditable(true);
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
    const rev = this.currentNote?.commentRev ?? 0;
    return buildAnchorFromRange(content, startChar, endChar, rev);
  }

  private applyHighlights(note: Note): void {
    if (!this.editor || note.comments.length === 0) {
      return;
    }

    const selection = this.editor.state.selection;
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

    try {
      this.editor.commands.setTextSelection({ from: selection.from, to: selection.to });
    } catch {
      console.debug('Could not restore selection after applying highlights');
    }
  }

  clear(): void {
    this.renderEmpty();
  }

  private renderEmpty(): void {
    this.clearAutosaveTimer();
    this.currentNote = null;
    this.isSaving = false;
    this.pendingAutosave = false;
    this.lastSavedContent = '';
    this.isApplyingContent = false;
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
    this.clearAutosaveTimer();

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
