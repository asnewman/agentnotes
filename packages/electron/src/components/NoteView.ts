import { Editor } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import { buildAnchorFromRange, getAllHighlightRanges, toTitleCase } from '../lib/browser-utils';
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
  tags: string[];
}

type CommentCreateHandler = (anchor: CommentAnchor, selectedText: string) => void;
type NoteSaveHandler = (noteId: string, content: string) => Promise<Note | null>;
type NoteMetadataSaveHandler = (noteId: string, tags: string[]) => Promise<Note | null>;
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
  private markdownStylingTimer: number | null;
  private contentBackgroundMouseHandler: ((event: MouseEvent) => void) | null;
  private actionsMenuDismissHandler: ((event: MouseEvent) => void) | null;
  private actionsMenuKeyHandler: ((event: KeyboardEvent) => void) | null;
  private headingActionButton: HTMLButtonElement | null;
  private headingActionMenu: HTMLDivElement | null;
  private headingActionTarget: HTMLElement | null;
  private headingMouseMoveHandler: ((event: MouseEvent) => void) | null;
  private headingMouseLeaveHandler: (() => void) | null;
  private headingScrollHandler: (() => void) | null;
  private headingResizeHandler: (() => void) | null;
  private headingMenuDismissHandler: ((event: MouseEvent) => void) | null;
  private headingMenuKeyHandler: ((event: KeyboardEvent) => void) | null;
  private isHeadingMenuOpen: boolean;
  private headingActionHideTimer: number | null;

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
    this.markdownStylingTimer = null;
    this.contentBackgroundMouseHandler = (event: MouseEvent) => {
      if (event.button !== 0 || !this.editor || event.target !== this.contentContainer) {
        return;
      }

      event.preventDefault();
      this.editor.chain().focus('end').run();
    };
    this.contentContainer.addEventListener('mousedown', this.contentBackgroundMouseHandler);
    this.actionsMenuDismissHandler = null;
    this.actionsMenuKeyHandler = null;
    this.headingActionButton = null;
    this.headingActionMenu = null;
    this.headingActionTarget = null;
    this.headingMouseMoveHandler = null;
    this.headingMouseLeaveHandler = null;
    this.headingScrollHandler = null;
    this.headingResizeHandler = null;
    this.headingMenuDismissHandler = null;
    this.headingMenuKeyHandler = null;
    this.isHeadingMenuOpen = false;
    this.headingActionHideTimer = null;
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

    this.teardownHeadingActionControls();
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

    this.ensureHeadingActionControls();

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

  private ensureHeadingActionControls(): void {
    if (this.headingActionButton && this.headingActionMenu) {
      return;
    }

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'heading-action-btn hidden';
    actionButton.innerHTML =
      '<svg class="heading-action-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4m-4.3-6.4c-.53-1.02-1.36-1.9-2.03-2.9A6.5 6.5 0 0 1 17.6 4.2a6.5 6.5 0 0 1 .73 7.5c-.66 1-1.5 1.88-2.03 2.9-.2.38-.3.8-.3 1.2H10c0-.4-.1-.82-.3-1.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    actionButton.setAttribute('aria-label', 'Heading actions');
    actionButton.setAttribute('aria-haspopup', 'menu');
    actionButton.setAttribute('aria-expanded', 'false');
    actionButton.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    actionButton.addEventListener('mouseenter', () => {
      this.cancelHeadingActionHide();
    });
    actionButton.addEventListener('mouseleave', () => {
      if (!this.isHeadingMenuOpen) {
        this.scheduleHeadingActionHide();
      }
    });
    actionButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (this.isHeadingMenuOpen) {
        this.closeHeadingActionMenu();
      } else {
        this.openHeadingActionMenu();
      }
    });

    const actionMenu = document.createElement('div');
    actionMenu.className = 'heading-action-menu';
    actionMenu.setAttribute('role', 'menu');

    const titleCaseButton = document.createElement('button');
    titleCaseButton.type = 'button';
    titleCaseButton.className = 'heading-action-menu-item';
    titleCaseButton.textContent = 'Title Case Heading';
    titleCaseButton.setAttribute('role', 'menuitem');
    titleCaseButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.formatHeadingToTitleCase();
    });

    actionMenu.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    actionMenu.addEventListener('mouseenter', () => {
      this.cancelHeadingActionHide();
    });
    actionMenu.addEventListener('mouseleave', () => {
      if (!this.isHeadingMenuOpen) {
        this.scheduleHeadingActionHide();
      }
    });
    actionMenu.append(titleCaseButton);

    this.contentContainer.append(actionButton, actionMenu);
    this.headingActionButton = actionButton;
    this.headingActionMenu = actionMenu;

    this.headingMouseMoveHandler = (event: MouseEvent) => {
      this.handleHeadingMouseMove(event);
    };
    this.headingMouseLeaveHandler = () => {
      this.handleHeadingMouseLeave();
    };
    this.headingScrollHandler = () => {
      this.positionHeadingActionButton();
    };
    this.headingResizeHandler = () => {
      this.positionHeadingActionButton();
    };

    this.contentContainer.addEventListener('mousemove', this.headingMouseMoveHandler);
    this.contentContainer.addEventListener('mouseleave', this.headingMouseLeaveHandler);
    this.contentContainer.addEventListener('scroll', this.headingScrollHandler);
    window.addEventListener('resize', this.headingResizeHandler);
  }

  private teardownHeadingActionControls(): void {
    this.cancelHeadingActionHide();
    this.closeHeadingActionMenu();

    if (this.headingMouseMoveHandler) {
      this.contentContainer.removeEventListener('mousemove', this.headingMouseMoveHandler);
      this.headingMouseMoveHandler = null;
    }

    if (this.headingMouseLeaveHandler) {
      this.contentContainer.removeEventListener('mouseleave', this.headingMouseLeaveHandler);
      this.headingMouseLeaveHandler = null;
    }

    if (this.headingScrollHandler) {
      this.contentContainer.removeEventListener('scroll', this.headingScrollHandler);
      this.headingScrollHandler = null;
    }

    if (this.headingResizeHandler) {
      window.removeEventListener('resize', this.headingResizeHandler);
      this.headingResizeHandler = null;
    }

    if (this.headingActionButton) {
      this.headingActionButton.remove();
      this.headingActionButton = null;
    }

    if (this.headingActionMenu) {
      this.headingActionMenu.remove();
      this.headingActionMenu = null;
    }

    this.headingActionTarget = null;
  }

  private teardownHeadingMenuListeners(): void {
    if (this.headingMenuDismissHandler) {
      document.removeEventListener('mousedown', this.headingMenuDismissHandler);
      this.headingMenuDismissHandler = null;
    }

    if (this.headingMenuKeyHandler) {
      document.removeEventListener('keydown', this.headingMenuKeyHandler);
      this.headingMenuKeyHandler = null;
    }
  }

  private handleHeadingMouseMove(event: MouseEvent): void {
    if (this.isHeadingMenuOpen) {
      this.positionHeadingActionButton();
      return;
    }

    const targetNode = event.target;
    if (targetNode instanceof Node) {
      if (this.headingActionButton && this.headingActionButton.contains(targetNode)) {
        this.cancelHeadingActionHide();
        return;
      }

      if (this.headingActionMenu && this.headingActionMenu.contains(targetNode)) {
        this.cancelHeadingActionHide();
        return;
      }
    }

    const heading = this.getHeadingElementFromTarget(targetNode);
    if (!heading) {
      this.scheduleHeadingActionHide();
      return;
    }

    this.cancelHeadingActionHide();
    this.headingActionTarget = heading;
    this.showHeadingActionButton();
  }

  private handleHeadingMouseLeave(): void {
    if (this.isHeadingMenuOpen) {
      return;
    }

    this.scheduleHeadingActionHide();
  }

  private getHeadingElementFromTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const headingElement = target.closest('h1, h2, h3, h4, h5, h6');
    if (!(headingElement instanceof HTMLElement)) {
      return null;
    }

    if (!this.contentContainer.contains(headingElement)) {
      return null;
    }

    return headingElement;
  }

  private showHeadingActionButton(): void {
    if (!this.headingActionButton || !this.headingActionTarget) {
      return;
    }

    this.cancelHeadingActionHide();
    this.headingActionButton.classList.remove('hidden');
    this.positionHeadingActionButton();
  }

  private hideHeadingActionButton(): void {
    if (this.isHeadingMenuOpen) {
      return;
    }

    if (this.headingActionButton) {
      this.headingActionButton.classList.add('hidden');
      this.headingActionButton.classList.remove('active');
    }

    this.headingActionTarget = null;
  }

  private scheduleHeadingActionHide(delayMs = 180): void {
    if (this.isHeadingMenuOpen || !this.headingActionButton) {
      return;
    }

    this.cancelHeadingActionHide();
    this.headingActionHideTimer = window.setTimeout(() => {
      this.headingActionHideTimer = null;
      if (this.isHeadingMenuOpen) {
        return;
      }

      this.hideHeadingActionButton();
    }, delayMs);
  }

  private cancelHeadingActionHide(): void {
    if (this.headingActionHideTimer !== null) {
      window.clearTimeout(this.headingActionHideTimer);
      this.headingActionHideTimer = null;
    }
  }

  private positionHeadingActionButton(): void {
    if (!this.headingActionButton || !this.headingActionTarget) {
      return;
    }

    const headingRect = this.headingActionTarget.getBoundingClientRect();
    const containerRect = this.contentContainer.getBoundingClientRect();
    const isOutOfView =
      headingRect.bottom < containerRect.top || headingRect.top > containerRect.bottom;
    if (isOutOfView && !this.isHeadingMenuOpen) {
      this.hideHeadingActionButton();
      return;
    }

    const buttonHeight = this.headingActionButton.offsetHeight;
    const buttonWidth = this.headingActionButton.offsetWidth;
    const top =
      headingRect.top -
      containerRect.top +
      this.contentContainer.scrollTop +
      (headingRect.height - buttonHeight) / 2;
    const left =
      headingRect.left -
      containerRect.left +
      this.contentContainer.scrollLeft -
      buttonWidth -
      8;

    this.headingActionButton.style.top = `${Math.max(2, top)}px`;
    this.headingActionButton.style.left = `${Math.max(4, left)}px`;

    if (this.isHeadingMenuOpen) {
      this.positionHeadingActionMenu();
    }
  }

  private positionHeadingActionMenu(): void {
    if (!this.headingActionButton || !this.headingActionMenu || !this.isHeadingMenuOpen) {
      return;
    }

    let left = this.headingActionButton.offsetLeft;
    const top = this.headingActionButton.offsetTop + this.headingActionButton.offsetHeight + 4;

    this.headingActionMenu.style.top = `${top}px`;
    this.headingActionMenu.style.left = `${left}px`;

    const menuRect = this.headingActionMenu.getBoundingClientRect();
    const containerRect = this.contentContainer.getBoundingClientRect();
    if (menuRect.right > containerRect.right - 8) {
      left = Math.max(4, left - (menuRect.right - (containerRect.right - 8)));
      this.headingActionMenu.style.left = `${left}px`;
    }
  }

  private openHeadingActionMenu(): void {
    if (!this.headingActionButton || !this.headingActionMenu || !this.headingActionTarget) {
      return;
    }

    this.cancelHeadingActionHide();
    this.isHeadingMenuOpen = true;
    this.headingActionButton.classList.add('active');
    this.headingActionButton.setAttribute('aria-expanded', 'true');
    this.headingActionMenu.classList.add('open');
    this.positionHeadingActionButton();

    this.headingMenuDismissHandler = (event: MouseEvent) => {
      const targetNode = event.target;
      if (
        targetNode instanceof Node &&
        (this.headingActionButton?.contains(targetNode) || this.headingActionMenu?.contains(targetNode))
      ) {
        return;
      }

      this.closeHeadingActionMenu();
    };
    this.headingMenuKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeHeadingActionMenu();
      }
    };

    document.addEventListener('mousedown', this.headingMenuDismissHandler);
    document.addEventListener('keydown', this.headingMenuKeyHandler);
  }

  private closeHeadingActionMenu(): void {
    this.isHeadingMenuOpen = false;
    this.teardownHeadingMenuListeners();

    if (this.headingActionMenu) {
      this.headingActionMenu.classList.remove('open');
    }

    if (this.headingActionButton) {
      this.headingActionButton.classList.remove('active');
      this.headingActionButton.setAttribute('aria-expanded', 'false');
    }

    this.scheduleHeadingActionHide(120);
  }

  private getHeadingLineIndex(headingElement: HTMLElement): number | null {
    if (!this.editor) {
      return null;
    }

    try {
      const headingPosition = this.editor.view.posAtDOM(headingElement, 0);
      const contentBeforeHeading = this.editor.state.doc.textBetween(0, headingPosition, '\n', '\n');
      if (contentBeforeHeading.length === 0) {
        return 0;
      }

      return contentBeforeHeading.split('\n').length - 1;
    } catch {
      return null;
    }
  }

  private formatHeadingToTitleCase(): void {
    if (!this.editor || !this.headingActionTarget) {
      return;
    }

    const lineIndex = this.getHeadingLineIndex(this.headingActionTarget);
    if (lineIndex === null || lineIndex < 0) {
      return;
    }

    const content = this.getEditorText();
    const lines = content.split('\n');
    const currentLine = lines[lineIndex];
    if (typeof currentLine !== 'string') {
      return;
    }

    const headingMatch = currentLine.match(/^(#{1,6}\s+)(.*)$/);
    if (!headingMatch) {
      return;
    }

    const trailingWhitespaceMatch = headingMatch[2].match(/\s+$/);
    const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : '';
    const headingBody = trailingWhitespace
      ? headingMatch[2].slice(0, -trailingWhitespace.length)
      : headingMatch[2];
    const titleCasedHeading = toTitleCase(headingBody);
    if (!titleCasedHeading || titleCasedHeading === headingBody) {
      this.closeHeadingActionMenu();
      return;
    }

    lines[lineIndex] = `${headingMatch[1]}${titleCasedHeading}${trailingWhitespace}`;
    const nextContent = lines.join('\n');

    this.setEditorContentPreservingSelection(this.editor, this.markdownToTipTap(nextContent));
    if (this.currentNote) {
      this.currentNote = {
        ...this.currentNote,
        content: nextContent,
      };
    }

    this.closeHeadingActionMenu();
    this.hideHeadingActionButton();
    this.scheduleAutosave();
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
          this.renderHeader(this.currentNote);
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

    if (!this.isHeadingMenuOpen) {
      this.hideHeadingActionButton();
    }

    this.scheduleMarkdownStyling(editor);

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

  private scheduleMarkdownStyling(editor: Editor, delayMs = 120): void {
    if (this.markdownStylingTimer !== null) {
      window.clearTimeout(this.markdownStylingTimer);
    }

    this.markdownStylingTimer = window.setTimeout(() => {
      this.markdownStylingTimer = null;
      this.applyMarkdownStyling(editor);
    }, delayMs);
  }

  private applyMarkdownStyling(editor: Editor): void {
    if (!this.currentNote || this.isApplyingContent) {
      return;
    }

    const content = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n');
    const normalizedHtml = this.markdownToTipTap(content);

    if (editor.getHTML() === normalizedHtml) {
      return;
    }

    const anchorOffset = editor.state.doc.textBetween(
      0,
      editor.state.selection.anchor,
      '\n',
      '\n',
    ).length;
    const headOffset = editor.state.doc.textBetween(0, editor.state.selection.head, '\n', '\n').length;

    this.setEditorContentPreservingSelection(editor, normalizedHtml, anchorOffset, headOffset);
  }

  private setEditorContentPreservingSelection(
    editor: Editor,
    normalizedHtml: string,
    anchorOffsetOverride?: number,
    headOffsetOverride?: number,
  ): void {
    const anchorOffset =
      anchorOffsetOverride ??
      editor.state.doc.textBetween(0, editor.state.selection.anchor, '\n', '\n').length;
    const headOffset =
      headOffsetOverride ??
      editor.state.doc.textBetween(0, editor.state.selection.head, '\n', '\n').length;

    this.isApplyingContent = true;
    try {
      editor.commands.setContent(normalizedHtml, false, { preserveWhitespace: 'full' });

      const anchorPosition = this.plainTextOffsetToDocPosition(editor, anchorOffset);
      const headPosition = this.plainTextOffsetToDocPosition(editor, headOffset);

      const from = Math.min(anchorPosition, headPosition);
      const to = Math.max(anchorPosition, headPosition);
      editor.commands.setTextSelection({ from, to });
    } catch (error) {
      console.debug('Could not update editor content:', error);
    } finally {
      this.isApplyingContent = false;
    }
  }

  private plainTextOffsetToDocPosition(editor: Editor, offset: number): number {
    const { doc } = editor.state;
    const totalText = doc.textBetween(0, doc.content.size, '\n', '\n');
    const clampedOffset = Math.max(0, Math.min(offset, totalText.length));

    let low = 0;
    let high = doc.content.size;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const midLength = doc.textBetween(0, mid, '\n', '\n').length;
      if (midLength < clampedOffset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return Math.max(1, Math.min(doc.content.size - 1, low));
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

    this.lastSavedOverlay.textContent = 'Saved';
  }

  render(note: Note | null): void {
    if (!note) {
      this.renderEmpty();
      return;
    }

    const isDifferentNote = this.currentNote?.id !== note.id;
    if (isDifferentNote) {
      this.clearAutosaveTimer();
      if (this.markdownStylingTimer !== null) {
        window.clearTimeout(this.markdownStylingTimer);
        this.markdownStylingTimer = null;
      }
      this.isSaving = false;
      this.isSavingMetadata = false;
      this.pendingAutosave = false;
      this.pendingMetadataUpdate = null;
      this.hideSelectionTooltip();
      this.closeHeadingActionMenu();
      this.hideHeadingActionButton();
    }

    this.currentNote = note;
    this.lastSavedContent = note.content;
    this.renderHeader(note);
    this.renderContent(note);
    this.renderLastSavedStatus();
  }

  private renderHeader(note: Note): void {
    this.renderTags(note);
    this.renderActions();
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
    addTagButton.setAttribute('aria-haspopup', 'dialog');
    addTagButton.setAttribute('aria-expanded', 'false');

    const addTagPopover = document.createElement('div');
    addTagPopover.className = 'tag-add-popover hidden';

    const addTagInput = document.createElement('input');
    addTagInput.className = 'tag-add-input';
    addTagInput.type = 'text';
    addTagInput.setAttribute('aria-label', 'New tag');
    addTagInput.placeholder = 'Add a tag';

    const positionPopover = (): void => {
      const panelElement = addTagControl.closest<HTMLElement>('.note-view-panel, .comments-panel');
      if (!panelElement) {
        return;
      }

      addTagPopover.style.left = '0';
      addTagPopover.style.right = 'auto';

      const panelRect = panelElement.getBoundingClientRect();
      const popoverRect = addTagPopover.getBoundingClientRect();
      const boundaryPadding = 8;

      if (popoverRect.right > panelRect.right - boundaryPadding) {
        addTagPopover.style.left = 'auto';
        addTagPopover.style.right = '0';
      }
    };

    const closePopover = (): void => {
      addTagPopover.classList.add('hidden');
      addTagButton.setAttribute('aria-expanded', 'false');
      addTagInput.value = '';
    };

    const openPopover = (): void => {
      addTagPopover.classList.remove('hidden');
      addTagButton.setAttribute('aria-expanded', 'true');
      positionPopover();
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
      if (event.key === 'Enter') {
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
      tags: nextTags,
    });
  }

  private async saveMetadata(update: MetadataUpdate): Promise<void> {
    if (!this.currentNote || !this.onNoteMetadataSaveCallback) {
      return;
    }

    const normalizedTags = this.normalizeTags(update.tags);

    if (this.haveSameTags(normalizedTags, this.currentNote.tags)) {
      return;
    }

    if (this.isSavingMetadata) {
      this.pendingMetadataUpdate = {
        tags: normalizedTags,
      };
      return;
    }

    this.isSavingMetadata = true;
    this.renderLastSavedStatus('Saving...');

    try {
      const noteId = this.currentNote.id;
      const updatedNote = await this.onNoteMetadataSaveCallback(noteId, normalizedTags);

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
    this.closeHeadingActionMenu();
    this.hideHeadingActionButton();
    this.isApplyingContent = true;
    try {
      this.editor.commands.setContent(content, false, { preserveWhitespace: 'full' });
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

    return markdown
      .split('\n')
      .map((line) => this.markdownLineToTipTap(line))
      .join('');
  }

  private markdownLineToTipTap(line: string): string {
    if (line.trim().length === 0) {
      return '<p></p>';
    }

    const headingMatch = line.match(/^(#{1,6})\s+\S/);
    const escapedLine = this.escapeHtml(line);
    const styledLine = this.applyInlineMarkdownStyles(escapedLine);

    if (headingMatch) {
      const level = headingMatch[1].length;
      return `<h${level}>${styledLine}</h${level}>`;
    }

    const blockQuoteMatch = line.match(/^>\s?/);
    if (blockQuoteMatch) {
      return `<blockquote><p>${styledLine}</p></blockquote>`;
    }

    return `<p>${styledLine}</p>`;
  }

  private applyInlineMarkdownStyles(escapedLine: string): string {
    if (!escapedLine) {
      return escapedLine;
    }

    const styledSegments: string[] = [];
    const toToken = (html: string): string => {
      const token = `@@MDTOKEN${styledSegments.length}@@`;
      styledSegments.push(html);
      return token;
    };

    let withTokens = escapedLine.replace(/`[^`]+`/g, (match) => toToken(`<code>${match}</code>`));
    withTokens = withTokens.replace(/(\*\*[^*]+\*\*|__[^_]+__)/g, (match) =>
      toToken(`<strong>${match}</strong>`),
    );
    withTokens = withTokens.replace(/(~~[^~]+~~)/g, (match) => toToken(`<s>${match}</s>`));
    withTokens = withTokens.replace(/(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g, (match) =>
      toToken(`<em>${match}</em>`),
    );

    return withTokens.replace(/@@MDTOKEN(\d+)@@/g, (_, rawIndex: string) => {
      const index = Number.parseInt(rawIndex, 10);
      return Number.isFinite(index) ? (styledSegments[index] ?? '') : '';
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    if (this.markdownStylingTimer !== null) {
      window.clearTimeout(this.markdownStylingTimer);
      this.markdownStylingTimer = null;
    }
    this.teardownActionsMenuListeners();
    this.teardownHeadingActionControls();
    this.currentNote = null;
    this.isSaving = false;
    this.isSavingMetadata = false;
    this.pendingAutosave = false;
    this.pendingMetadataUpdate = null;
    this.lastSavedContent = '';
    this.isApplyingContent = false;
    this.hideSelectionTooltip();

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
    if (this.markdownStylingTimer !== null) {
      window.clearTimeout(this.markdownStylingTimer);
      this.markdownStylingTimer = null;
    }
    this.teardownActionsMenuListeners();
    this.teardownHeadingActionControls();

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

    if (this.contentBackgroundMouseHandler) {
      this.contentContainer.removeEventListener('mousedown', this.contentBackgroundMouseHandler);
      this.contentBackgroundMouseHandler = null;
    }
  }
}
