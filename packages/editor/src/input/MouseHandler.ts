import { Selection, EditorCallbacks } from '../types.js';
import { PositionCalculator } from '../utils/position.js';

/**
 * Handles mouse interactions for cursor positioning and selection.
 */
export class MouseHandler {
  private container: HTMLElement;
  private callbacks: EditorCallbacks;
  private positionCalculator: PositionCalculator;
  private textElement: HTMLElement | null = null;

  private isDragging = false;
  private dragAnchor = 0;

  private onFocus: () => void;

  constructor(
    container: HTMLElement,
    callbacks: EditorCallbacks,
    positionCalculator: PositionCalculator,
    onFocus: () => void
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.positionCalculator = positionCalculator;
    this.onFocus = onFocus;

    this.bindEvents();
  }

  /**
   * Sets the text element for position calculations.
   */
  setTextElement(element: HTMLElement): void {
    this.textElement = element;
  }

  /**
   * Binds mouse events.
   */
  private bindEvents(): void {
    this.container.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * Handles mouse down - starts selection.
   */
  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return; // Only handle left click
    if (!this.textElement) return;

    event.preventDefault();
    this.onFocus();

    const offset = this.positionCalculator.getOffsetFromPoint(
      event.clientX,
      event.clientY,
      this.textElement
    );

    if (event.shiftKey) {
      // Extend existing selection
      // We don't have access to current selection here, so just set a new one
      this.callbacks.onSelectionChange?.({ anchor: this.dragAnchor, head: offset });
    } else if (event.detail === 2) {
      // Double click - select word
      this.selectWord(offset);
    } else if (event.detail === 3) {
      // Triple click - select line (or all for simplicity)
      this.selectAll();
    } else {
      // Single click - set cursor position
      this.isDragging = true;
      this.dragAnchor = offset;
      this.callbacks.onSelectionChange?.({ anchor: offset, head: offset });
    }
  };

  /**
   * Handles mouse move - extends selection during drag.
   */
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging || !this.textElement) return;

    event.preventDefault();

    const offset = this.positionCalculator.getOffsetFromPoint(
      event.clientX,
      event.clientY,
      this.textElement
    );

    this.callbacks.onSelectionChange?.({ anchor: this.dragAnchor, head: offset });
  };

  /**
   * Handles mouse up - ends selection.
   */
  private handleMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    this.isDragging = false;
  };

  /**
   * Selects the word at the given offset.
   */
  private selectWord(offset: number): void {
    if (!this.textElement) return;

    const text = this.textElement.textContent || '';
    let start = offset;
    let end = offset;

    // Expand backwards to word boundary
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }

    // Expand forwards to word boundary
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    if (start !== end) {
      this.dragAnchor = start;
      this.callbacks.onSelectionChange?.({ anchor: start, head: end });
    }
  }

  /**
   * Selects all text.
   */
  private selectAll(): void {
    if (!this.textElement) return;

    const text = this.textElement.textContent || '';
    this.dragAnchor = 0;
    this.callbacks.onSelectionChange?.({ anchor: 0, head: text.length });
  }

  /**
   * Cleans up the handler.
   */
  destroy(): void {
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}
