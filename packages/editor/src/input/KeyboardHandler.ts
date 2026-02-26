import { Selection, EditorCallbacks, EditorState, ImagePasteData } from '../types.js';

const CLASS_PREFIX = 'agentnotes-editor';

/**
 * Handles keyboard input via a hidden textarea.
 */
export class KeyboardHandler {
  private container: HTMLElement;
  private hiddenInput: HTMLTextAreaElement;
  private callbacks: EditorCallbacks;
  private getState: () => EditorState;

  constructor(
    container: HTMLElement,
    callbacks: EditorCallbacks,
    getState: () => EditorState
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.getState = getState;

    this.hiddenInput = document.createElement('textarea');
    this.hiddenInput.className = `${CLASS_PREFIX}-hidden-input`;
    this.hiddenInput.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: 0;
      border: none;
      outline: none;
      resize: none;
      overflow: hidden;
      white-space: pre;
      font: inherit;
      color: transparent;
      background: transparent;
      caret-color: transparent;
      z-index: -1;
    `;
    this.hiddenInput.setAttribute('autocomplete', 'off');
    this.hiddenInput.setAttribute('autocorrect', 'off');
    this.hiddenInput.setAttribute('autocapitalize', 'off');
    this.hiddenInput.setAttribute('spellcheck', 'false');
    this.hiddenInput.setAttribute('aria-hidden', 'true');

    this.container.appendChild(this.hiddenInput);

    this.bindEvents();
  }

  /**
   * Binds input and keyboard events.
   */
  private bindEvents(): void {
    this.hiddenInput.addEventListener('input', this.handleInput);
    this.hiddenInput.addEventListener('keydown', this.handleKeyDown);
    this.hiddenInput.addEventListener('paste', this.handlePaste);
    this.hiddenInput.addEventListener('compositionstart', this.handleCompositionStart);
    this.hiddenInput.addEventListener('compositionend', this.handleCompositionEnd);
  }

  /**
   * Handles text input from the hidden textarea.
   */
  private handleInput = (event: Event): void => {
    const text = this.hiddenInput.value;

    if (text && !this.isComposing) {
      const state = this.getState();
      const { anchor, head } = state.selection;

      // If there's a selection, delete it first
      if (anchor !== head) {
        const from = Math.min(anchor, head);
        const to = Math.max(anchor, head);
        this.callbacks.onDelete?.(from, to);
        // Insert at the start of the deleted range
        this.callbacks.onInsert?.(from, text);
      } else {
        this.callbacks.onInsert?.(anchor, text);
      }
    }

    // Clear the input
    this.hiddenInput.value = '';
  };

  private isComposing = false;

  /**
   * Handles paste events for images.
   */
  private handlePaste = (event: ClipboardEvent): void => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    // Check for image items in clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          this.processImageBlob(blob, item.type);
        }
        return;
      }
    }
  };

  /**
   * Processes an image blob and calls the onImagePaste callback.
   */
  private processImageBlob(blob: Blob, mimeType: string, filename?: string): void {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just base64 data
      const base64Data = result.split(',')[1];
      if (base64Data && this.callbacks.onImagePaste) {
        const imageData: ImagePasteData = {
          data: base64Data,
          mimeType,
          filename,
        };
        this.callbacks.onImagePaste(imageData);
      }
    };
    reader.readAsDataURL(blob);
  }

  private handleCompositionStart = (): void => {
    this.isComposing = true;
  };

  private handleCompositionEnd = (event: CompositionEvent): void => {
    this.isComposing = false;
    const text = event.data;

    if (text) {
      const state = this.getState();
      const { anchor, head } = state.selection;

      // If there's a selection, delete it first
      if (anchor !== head) {
        const from = Math.min(anchor, head);
        const to = Math.max(anchor, head);
        this.callbacks.onDelete?.(from, to);
        this.callbacks.onInsert?.(from, text);
      } else {
        this.callbacks.onInsert?.(anchor, text);
      }
    }

    this.hiddenInput.value = '';
  };

  /**
   * Handles special key events.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const state = this.getState();
    const { anchor, head } = state.selection;
    const textLength = state.text.length;
    const isMac = navigator.platform.includes('Mac');
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        this.handleBackspace(state);
        break;

      case 'Delete':
        event.preventDefault();
        this.handleDelete(state);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        this.handleArrowLeft(state, event.shiftKey, modKey);
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.handleArrowRight(state, event.shiftKey, modKey);
        break;

      case 'ArrowUp':
        event.preventDefault();
        // TODO: Implement line-based navigation
        this.callbacks.onSelectionChange?.({ anchor: 0, head: 0 });
        break;

      case 'ArrowDown':
        event.preventDefault();
        // TODO: Implement line-based navigation
        this.callbacks.onSelectionChange?.({ anchor: textLength, head: textLength });
        break;

      case 'Home':
        event.preventDefault();
        if (event.shiftKey) {
          this.callbacks.onSelectionChange?.({ anchor, head: 0 });
        } else {
          this.callbacks.onSelectionChange?.({ anchor: 0, head: 0 });
        }
        break;

      case 'End':
        event.preventDefault();
        if (event.shiftKey) {
          this.callbacks.onSelectionChange?.({ anchor, head: textLength });
        } else {
          this.callbacks.onSelectionChange?.({ anchor: textLength, head: textLength });
        }
        break;

      case 'a':
        if (modKey) {
          event.preventDefault();
          this.callbacks.onSelectionChange?.({ anchor: 0, head: textLength });
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (anchor !== head) {
          const from = Math.min(anchor, head);
          const to = Math.max(anchor, head);
          this.callbacks.onDelete?.(from, to);
          this.callbacks.onInsert?.(from, '\n');
        } else {
          this.callbacks.onInsert?.(anchor, '\n');
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (anchor !== head) {
          const from = Math.min(anchor, head);
          const to = Math.max(anchor, head);
          this.callbacks.onDelete?.(from, to);
          this.callbacks.onInsert?.(from, '\t');
        } else {
          this.callbacks.onInsert?.(anchor, '\t');
        }
        break;
    }
  };

  /**
   * Handles backspace key.
   */
  private handleBackspace(state: EditorState): void {
    const { anchor, head } = state.selection;

    if (anchor !== head) {
      const from = Math.min(anchor, head);
      const to = Math.max(anchor, head);
      this.callbacks.onDelete?.(from, to);
    } else if (anchor > 0) {
      this.callbacks.onDelete?.(anchor - 1, anchor);
    }
  }

  /**
   * Handles delete key.
   */
  private handleDelete(state: EditorState): void {
    const { anchor, head } = state.selection;

    if (anchor !== head) {
      const from = Math.min(anchor, head);
      const to = Math.max(anchor, head);
      this.callbacks.onDelete?.(from, to);
    } else if (anchor < state.text.length) {
      this.callbacks.onDelete?.(anchor, anchor + 1);
    }
  }

  /**
   * Handles left arrow key.
   */
  private handleArrowLeft(state: EditorState, shift: boolean, mod: boolean): void {
    const { anchor, head } = state.selection;

    if (mod) {
      // Move to start of word or line
      const newPos = this.findWordBoundaryLeft(state.text, head);
      if (shift) {
        this.callbacks.onSelectionChange?.({ anchor, head: newPos });
      } else {
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      }
    } else if (shift) {
      // Extend selection left
      const newHead = Math.max(0, head - 1);
      this.callbacks.onSelectionChange?.({ anchor, head: newHead });
    } else {
      // Move cursor left (or collapse selection to left)
      if (anchor !== head) {
        const newPos = Math.min(anchor, head);
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      } else {
        const newPos = Math.max(0, anchor - 1);
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      }
    }
  }

  /**
   * Handles right arrow key.
   */
  private handleArrowRight(state: EditorState, shift: boolean, mod: boolean): void {
    const { anchor, head } = state.selection;
    const textLength = state.text.length;

    if (mod) {
      // Move to end of word or line
      const newPos = this.findWordBoundaryRight(state.text, head);
      if (shift) {
        this.callbacks.onSelectionChange?.({ anchor, head: newPos });
      } else {
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      }
    } else if (shift) {
      // Extend selection right
      const newHead = Math.min(textLength, head + 1);
      this.callbacks.onSelectionChange?.({ anchor, head: newHead });
    } else {
      // Move cursor right (or collapse selection to right)
      if (anchor !== head) {
        const newPos = Math.max(anchor, head);
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      } else {
        const newPos = Math.min(textLength, anchor + 1);
        this.callbacks.onSelectionChange?.({ anchor: newPos, head: newPos });
      }
    }
  }

  /**
   * Finds the word boundary to the left of a position.
   */
  private findWordBoundaryLeft(text: string, pos: number): number {
    if (pos === 0) return 0;

    let i = pos - 1;

    // Skip whitespace
    while (i > 0 && /\s/.test(text[i])) {
      i--;
    }

    // Skip word characters
    while (i > 0 && /\w/.test(text[i - 1])) {
      i--;
    }

    return i;
  }

  /**
   * Finds the word boundary to the right of a position.
   */
  private findWordBoundaryRight(text: string, pos: number): number {
    if (pos >= text.length) return text.length;

    let i = pos;

    // Skip current word
    while (i < text.length && /\w/.test(text[i])) {
      i++;
    }

    // Skip whitespace
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }

    return i;
  }

  /**
   * Focuses the hidden input.
   */
  focus(): void {
    this.hiddenInput.focus();
  }

  /**
   * Blurs the hidden input.
   */
  blur(): void {
    this.hiddenInput.blur();
  }

  /**
   * Checks if the hidden input is focused.
   */
  hasFocus(): boolean {
    return document.activeElement === this.hiddenInput;
  }

  /**
   * Cleans up the handler.
   */
  destroy(): void {
    this.hiddenInput.removeEventListener('input', this.handleInput);
    this.hiddenInput.removeEventListener('keydown', this.handleKeyDown);
    this.hiddenInput.removeEventListener('paste', this.handlePaste);
    this.hiddenInput.removeEventListener('compositionstart', this.handleCompositionStart);
    this.hiddenInput.removeEventListener('compositionend', this.handleCompositionEnd);

    if (this.hiddenInput.parentNode) {
      this.hiddenInput.parentNode.removeChild(this.hiddenInput);
    }
  }
}

/**
 * CSS styles for the keyboard handler.
 */
export const keyboardStyles = `
  .${CLASS_PREFIX}-hidden-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: 0;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    color: transparent;
    background: transparent;
    caret-color: transparent;
    z-index: -1;
  }
`;
