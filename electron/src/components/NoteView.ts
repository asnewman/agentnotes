import { Editor } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import { buildAnchorFromRange, getAllHighlightRanges } from '../lib/highlighter';
import { formatDate, formatDateTime } from '../lib/noteStore';
import type { CommentAnchor, Note } from '../types';
import { createTagChip } from './TagChip';

const CommentHighlight = Highlight.extend({
  inclusive: false,
});

interface CurrentSelection {
  anchor: CommentAnchor;
  text: string;
}

interface MetadataUpdate {
  title: string;
  tags: string[];
}

type CommentCreateHandler = (anchor: CommentAnchor, selectedText: string) => void;
type NoteSaveHandler = (noteId: string, content: string) => Promise<Note | null>;
type NoteMetadataSaveHandler = (noteId: string, title: string, tags: string[]) => Promise<Note | null>;
type NoteActionHandler = (note: Note) => void | Promise<void>;

interface SaveEditsOptions {
  keepEditing?: boolean;
}

export class NoteView {
  private headerContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private editor: Editor | null;
  private currentNote: Note | null;
  private tooltip: HTMLDivElement | null;
  private lastSavedOverlay: HTMLDivElement | null;
  private onCommentCreateCallback: CommentCreateHandler | null;
  private onNoteSaveCallback: NoteSaveHandler | null;
  private onNoteMetadataSaveCallback: NoteMetadataSaveHandler | null;
  private onNoteDeleteCallback: NoteActionHandler | null;
  private currentSelection: CurrentSelection | null;
  private isSaving: boolean;
  private isSavingMetadata: boolean;
  private autosaveTimer: number | null;
  private pendingAutosave: boolean;
  private pendingMetadataUpdate: MetadataUpdate | null;
  private lastSavedContent: string;
  private isApplyingContent: boolean;
  private actionsMenuDismissHandler: ((event: MouseEvent) => void) | null;
  private actionsMenuKeyHandler: ((event: KeyboardEvent) => void) | null;

  constructor(headerContainer: HTMLElement, contentContainer: HTMLElement) {
    this.headerContainer = headerContainer;
    this.contentContainer = contentContainer;
    this.editor = null;
    this.currentNote = null;
    this.tooltip = null;
    this.lastSavedOverlay = null;
    this.onCommentCreateCallback = null;
    this.onNoteSaveCallback = null;
    this.onNoteMetadataSaveCallback = null;
    this.onNoteDeleteCallback = null;
    this.currentSelection = null;
    this.isSaving = false;
    this.isSavingMetadata = false;
    this.autosaveTimer = null;
    this.pendingAutosave = false;
    this.pendingMetadataUpdate = null;
    this.lastSavedContent = '';
    this.isApplyingContent = false;
    this.actionsMenuDismissHandler = null;
    this.actionsMenuKeyHandler = null;
  }

  setOnCommentCreate(callback: CommentCreateHandler): void {
    this.onCommentCreateCallback = callback;
  }

  setOnNoteSave(callback: NoteSaveHandler): void {
    this.onNoteSaveCallback = callback;
  }

  setOnNoteMetadataSave(callback: NoteMetadataSaveHandler): void {
    this.onNoteMetadataSaveCallback = callback;
  }

  setOnNoteDelete(callback: NoteActionHandler): void {
    this.onNoteDeleteCallback = callback;
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
      enableInputRules: false,
      extensions: [
        StarterKit,
        CommentHighlight.configure({
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
    this.renderLastSavedStatus('Saving...');

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
          this.renderMeta(this.currentNote);
          this.renderLastSavedStatus();

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
        this.renderLastSavedStatus();
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

  private ensureLastSavedOverlay(): void {
    if (this.lastSavedOverlay) {
      return;
    }

    const panel = this.contentContainer.parentElement;
    if (!panel) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'note-last-saved-overlay hidden';
    panel.appendChild(overlay);
    this.lastSavedOverlay = overlay;
  }

  private renderLastSavedStatus(overrideText?: string): void {
    this.ensureLastSavedOverlay();

    if (!this.lastSavedOverlay) {
      return;
    }

    if (!this.currentNote) {
      this.lastSavedOverlay.classList.add('hidden');
      return;
    }

    this.lastSavedOverlay.classList.remove('hidden');

    if (overrideText) {
      this.lastSavedOverlay.textContent = overrideText;
      return;
    }

    this.lastSavedOverlay.textContent = `Last saved ${formatDateTime(this.currentNote.updated)}`;
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
      this.isSavingMetadata = false;
      this.pendingAutosave = false;
      this.pendingMetadataUpdate = null;
      this.hideSelectionTooltip();
    }

    this.currentNote = note;
    this.lastSavedContent = note.content;
    this.renderHeader(note);
    this.renderContent(note);
    this.renderLastSavedStatus();
  }

  private renderHeader(note: Note): void {
    this.renderTitle(note);
    this.renderMeta(note);
    this.renderTags(note);
    this.renderActions();
  }

  private renderTitle(note: Note): void {
    const titleElement = this.headerContainer.querySelector<HTMLElement>('.note-title');
    if (!titleElement) {
      return;
    }

    let titleInput = titleElement.querySelector<HTMLInputElement>('.note-title-input');
    if (!titleInput) {
      titleElement.innerHTML = '';

      const newTitleInput = document.createElement('input');
      newTitleInput.className = 'note-title-input';
      newTitleInput.type = 'text';
      newTitleInput.setAttribute('aria-label', 'Note title');

      newTitleInput.addEventListener('blur', () => {
        void this.handleTitleSubmit(newTitleInput.value);
      });

      newTitleInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          newTitleInput.blur();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          if (this.currentNote) {
            newTitleInput.value = this.currentNote.title;
          }
          newTitleInput.blur();
        }
      });

      titleElement.appendChild(newTitleInput);
      titleInput = newTitleInput;
    }

    if (!titleInput) {
      return;
    }

    if (document.activeElement !== titleInput) {
      titleInput.value = note.title;
    }
  }

  private renderMeta(note: Note): void {
    const metaElement = this.headerContainer.querySelector<HTMLElement>('.note-meta');
    if (!metaElement) {
      return;
    }

    metaElement.innerHTML = '';

    const createdItem = document.createElement('span');
    createdItem.className = 'note-meta-item';
    createdItem.textContent = `Created: ${formatDate(note.created)}`;
    metaElement.appendChild(createdItem);

    const updatedItem = document.createElement('span');
    updatedItem.className = 'note-meta-item';
    updatedItem.textContent = `Updated: ${formatDate(note.updated)}`;
    metaElement.appendChild(updatedItem);
  }

  private renderTags(note: Note): void {
    const tagsElement = this.headerContainer.querySelector<HTMLElement>('.note-tags');
    if (!tagsElement) {
      return;
    }

    tagsElement.innerHTML = '';

    for (const tag of note.tags) {
      tagsElement.appendChild(createTagChip(tag, (tagToRemove) => this.handleTagRemove(tagToRemove)));
    }

    const addTagControl = document.createElement('div');
    addTagControl.className = 'tag-add-control';

    const addTagButton = document.createElement('button');
    addTagButton.type = 'button';
    addTagButton.className = 'tag-add-btn';
    addTagButton.textContent = '+';
    addTagButton.setAttribute('aria-label', 'Add tag');
    addTagButton.setAttribute('aria-expanded', 'false');

    const addTagPopover = document.createElement('div');
    addTagPopover.className = 'tag-add-popover hidden';

    const addTagInput = document.createElement('input');
    addTagInput.className = 'tag-add-input';
    addTagInput.type = 'text';
    addTagInput.setAttribute('aria-label', 'New tag');

    const closePopover = (): void => {
      addTagPopover.classList.add('hidden');
      addTagButton.setAttribute('aria-expanded', 'false');
      addTagInput.value = '';
    };

    const openPopover = (): void => {
      addTagPopover.classList.remove('hidden');
      addTagButton.setAttribute('aria-expanded', 'true');
      window.setTimeout(() => addTagInput.focus(), 0);
    };

    const submitTag = (): void => {
      this.handleTagAdd(addTagInput);
      closePopover();
    };

    addTagButton.addEventListener('click', () => {
      if (addTagPopover.classList.contains('hidden')) {
        openPopover();
      } else {
        closePopover();
      }
    });

    addTagInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        submitTag();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closePopover();
      }
    });

    addTagControl.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!addTagControl.contains(document.activeElement)) {
          closePopover();
        }
      }, 0);
    });

    addTagPopover.append(addTagInput);
    addTagControl.append(addTagButton, addTagPopover);
    tagsElement.appendChild(addTagControl);
  }

  private renderActions(): void {
    const actionsElement = this.headerContainer.querySelector<HTMLElement>('.note-actions');
    if (!actionsElement) {
      return;
    }

    this.teardownActionsMenuListeners();
    actionsElement.innerHTML = '';
    if (!this.currentNote) {
      return;
    }

    const overflowButton = document.createElement('button');
    overflowButton.type = 'button';
    overflowButton.className = 'note-actions-overflow-btn';
    overflowButton.textContent = '...';
    overflowButton.setAttribute('aria-label', 'More note actions');
    overflowButton.setAttribute('aria-haspopup', 'menu');
    overflowButton.setAttribute('aria-expanded', 'false');

    const dropdown = document.createElement('div');
    dropdown.className = 'note-actions-dropdown';
    dropdown.setAttribute('role', 'menu');

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'note-actions-dropdown-item note-actions-dropdown-item-danger';
    deleteButton.textContent = 'Delete note';
    deleteButton.setAttribute('role', 'menuitem');

    const closeDropdown = (): void => {
      dropdown.classList.remove('open');
      overflowButton.setAttribute('aria-expanded', 'false');
      this.teardownActionsMenuListeners();
    };

    const openDropdown = (): void => {
      dropdown.classList.add('open');
      overflowButton.setAttribute('aria-expanded', 'true');

      this.actionsMenuDismissHandler = (event: MouseEvent) => {
        const target = event.target;
        if (target instanceof Node && actionsElement.contains(target)) {
          return;
        }

        closeDropdown();
      };

      this.actionsMenuKeyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          closeDropdown();
        }
      };

      document.addEventListener('mousedown', this.actionsMenuDismissHandler);
      document.addEventListener('keydown', this.actionsMenuKeyHandler);
    };

    overflowButton.addEventListener('click', (event) => {
      event.stopPropagation();

      if (dropdown.classList.contains('open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    dropdown.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    deleteButton.addEventListener('click', () => {
      closeDropdown();

      if (this.currentNote && this.onNoteDeleteCallback) {
        void this.onNoteDeleteCallback(this.currentNote);
      }
    });

    dropdown.append(deleteButton);
    actionsElement.append(overflowButton, dropdown);
  }

  private teardownActionsMenuListeners(): void {
    if (this.actionsMenuDismissHandler) {
      document.removeEventListener('mousedown', this.actionsMenuDismissHandler);
      this.actionsMenuDismissHandler = null;
    }

    if (this.actionsMenuKeyHandler) {
      document.removeEventListener('keydown', this.actionsMenuKeyHandler);
      this.actionsMenuKeyHandler = null;
    }
  }

  private normalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const rawTag of tags) {
      const tag = rawTag.trim();
      if (!tag) {
        continue;
      }

      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(tag);
    }

    return normalized;
  }

  private haveSameTags(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((tag, index) => tag === right[index]);
  }

  private async handleTitleSubmit(rawTitle: string): Promise<void> {
    if (!this.currentNote) {
      return;
    }

    const nextTitle = rawTitle.trim();
    if (!nextTitle) {
      this.renderTitle(this.currentNote);
      return;
    }

    if (nextTitle === this.currentNote.title) {
      return;
    }

    await this.saveMetadata({
      title: nextTitle,
      tags: this.currentNote.tags,
    });
  }

  private getDraftTitle(): string {
    const titleInput = this.headerContainer.querySelector<HTMLInputElement>('.note-title-input');
    const draftTitle = titleInput?.value.trim();
    if (draftTitle) {
      return draftTitle;
    }

    return this.currentNote?.title ?? '';
  }

  private handleTagAdd(input: HTMLInputElement): void {
    if (!this.currentNote) {
      return;
    }

    const nextTag = input.value.trim();
    if (!nextTag) {
      return;
    }

    input.value = '';

    const hasTag = this.currentNote.tags.some(
      (existingTag) => existingTag.toLocaleLowerCase() === nextTag.toLocaleLowerCase(),
    );
    if (hasTag) {
      return;
    }

    void this.saveMetadata({
      title: this.getDraftTitle(),
      tags: [...this.currentNote.tags, nextTag],
    });
  }

  private handleTagRemove(tagToRemove: string): void {
    if (!this.currentNote) {
      return;
    }

    const nextTags = this.currentNote.tags.filter(
      (tag) => tag.toLocaleLowerCase() !== tagToRemove.toLocaleLowerCase(),
    );

    if (nextTags.length === this.currentNote.tags.length) {
      return;
    }

    void this.saveMetadata({
      title: this.getDraftTitle(),
      tags: nextTags,
    });
  }

  private async saveMetadata(update: MetadataUpdate): Promise<void> {
    if (!this.currentNote || !this.onNoteMetadataSaveCallback) {
      return;
    }

    const normalizedTitle = update.title.trim();
    if (!normalizedTitle) {
      this.renderHeader(this.currentNote);
      return;
    }

    const normalizedTags = this.normalizeTags(update.tags);

    if (
      normalizedTitle === this.currentNote.title &&
      this.haveSameTags(normalizedTags, this.currentNote.tags)
    ) {
      return;
    }

    if (this.isSavingMetadata) {
      this.pendingMetadataUpdate = {
        title: normalizedTitle,
        tags: normalizedTags,
      };
      return;
    }

    this.isSavingMetadata = true;
    this.renderLastSavedStatus('Saving...');

    try {
      const noteId = this.currentNote.id;
      const updatedNote = await this.onNoteMetadataSaveCallback(
        noteId,
        normalizedTitle,
        normalizedTags,
      );

      if (!updatedNote || this.currentNote?.id !== noteId) {
        return;
      }

      const editorContent = this.getEditorText();
      const hasUnsavedEditorChanges = editorContent !== this.lastSavedContent;

      this.currentNote = {
        ...updatedNote,
        content: editorContent,
      };

      this.renderHeader(this.currentNote);
      this.renderLastSavedStatus();

      if (hasUnsavedEditorChanges) {
        this.scheduleAutosave();
      }
    } catch (error) {
      console.error('Error saving note metadata:', error);
    } finally {
      this.isSavingMetadata = false;

      if (this.pendingMetadataUpdate) {
        const nextUpdate = this.pendingMetadataUpdate;
        this.pendingMetadataUpdate = null;
        void this.saveMetadata(nextUpdate);
        return;
      }

      this.renderLastSavedStatus();
    }
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
    this.teardownActionsMenuListeners();
    this.currentNote = null;
    this.isSaving = false;
    this.isSavingMetadata = false;
    this.pendingAutosave = false;
    this.pendingMetadataUpdate = null;
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

    this.renderLastSavedStatus();

    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  destroy(): void {
    this.clearAutosaveTimer();
    this.teardownActionsMenuListeners();

    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }

    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    if (this.lastSavedOverlay) {
      this.lastSavedOverlay.remove();
      this.lastSavedOverlay = null;
    }
  }
}
