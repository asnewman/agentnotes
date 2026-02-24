import { EditorState, EditorCallbacks, EditorOptions, Selection } from './types.js';
import { TextRenderer, textRendererStyles } from './render/TextRenderer.js';
import { CursorRenderer, cursorStyles } from './render/CursorRenderer.js';
import { SelectionRenderer, selectionStyles } from './render/SelectionRenderer.js';
import { KeyboardHandler, keyboardStyles } from './input/KeyboardHandler.js';
import { MouseHandler } from './input/MouseHandler.js';
import { PositionCalculator } from './utils/position.js';

const CLASS_PREFIX = 'agentnotes-editor';

/**
 * A vanilla JS text editor with externally-managed state.
 * The editor renders current state and emits change events via callbacks.
 */
export class Editor {
  private container: HTMLElement;
  private editorRoot: HTMLElement;
  private callbacks: EditorCallbacks;
  private options: EditorOptions;

  private textRenderer: TextRenderer;
  private cursorRenderer: CursorRenderer;
  private selectionRenderer: SelectionRenderer;
  private keyboardHandler: KeyboardHandler;
  private mouseHandler: MouseHandler;
  private positionCalculator: PositionCalculator;

  private currentState: EditorState = {
    text: '',
    selection: { anchor: 0, head: 0 },
    decorations: [],
  };

  private hasFocus = false;
  private styleElement: HTMLStyleElement | null = null;

  constructor(
    container: HTMLElement,
    callbacks: EditorCallbacks,
    options: EditorOptions = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.options = options;

    // Inject styles
    this.injectStyles();

    // Create editor root element
    this.editorRoot = document.createElement('div');
    this.editorRoot.className = `${CLASS_PREFIX}-root`;
    this.editorRoot.style.cssText = `
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      padding: 8px;
      cursor: text;
      min-height: 100px;
    `;
    this.container.appendChild(this.editorRoot);

    // Initialize position calculator
    this.positionCalculator = new PositionCalculator(this.editorRoot);

    // Initialize renderers
    this.selectionRenderer = new SelectionRenderer(this.editorRoot, this.positionCalculator);
    this.textRenderer = new TextRenderer(this.editorRoot);
    this.cursorRenderer = new CursorRenderer(this.editorRoot, this.positionCalculator);

    // Initialize input handlers
    this.keyboardHandler = new KeyboardHandler(
      this.editorRoot,
      this.callbacks,
      () => this.currentState
    );

    this.mouseHandler = new MouseHandler(
      this.editorRoot,
      this.callbacks,
      this.positionCalculator,
      () => this.focus()
    );

    this.mouseHandler.setTextElement(this.textRenderer.getTextElement());

    // Bind focus/blur events
    this.editorRoot.addEventListener('focus', this.handleFocus, true);
    this.editorRoot.addEventListener('blur', this.handleBlur, true);
  }

  /**
   * Injects CSS styles into the document.
   */
  private injectStyles(): void {
    if (document.getElementById(`${CLASS_PREFIX}-styles`)) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = `${CLASS_PREFIX}-styles`;
    this.styleElement.textContent = `
      ${textRendererStyles}
      ${cursorStyles}
      ${selectionStyles}
      ${keyboardStyles}

      .${CLASS_PREFIX}-root {
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        padding: 8px;
        cursor: text;
        min-height: 100px;
      }

      .${CLASS_PREFIX}-root:focus-within {
        outline: none;
      }
    `;

    document.head.appendChild(this.styleElement);
  }

  /**
   * Handles focus event.
   */
  private handleFocus = (): void => {
    this.hasFocus = true;
    this.renderCursorAndSelection();
  };

  /**
   * Handles blur event.
   */
  private handleBlur = (): void => {
    this.hasFocus = false;
    this.renderCursorAndSelection();
  };

  /**
   * Re-renders the editor with new state.
   */
  render(state: EditorState): void {
    this.currentState = state;

    // Render text
    this.textRenderer.render(state.text, state.decorations);
    this.textRenderer.setPlaceholder(this.options.placeholder, state.text.length === 0);

    // Update mouse handler's text element reference
    this.mouseHandler.setTextElement(this.textRenderer.getTextElement());

    // Render cursor and selection
    this.renderCursorAndSelection();
  }

  /**
   * Renders cursor and selection based on current state and focus.
   */
  private renderCursorAndSelection(): void {
    const textElement = this.textRenderer.getTextElement();

    // Render selection highlight
    this.selectionRenderer.render(
      this.currentState.selection,
      textElement,
      this.hasFocus
    );

    // Render cursor
    const cursorPosition = this.currentState.selection.head;
    this.cursorRenderer.render(cursorPosition, textElement, this.hasFocus);

    // Reset cursor blink on selection change
    if (this.hasFocus) {
      this.cursorRenderer.resetBlink();
    }
  }

  /**
   * Focuses the editor.
   */
  focus(): void {
    this.keyboardHandler.focus();
    this.hasFocus = true;
    this.renderCursorAndSelection();
  }

  /**
   * Blurs the editor.
   */
  blur(): void {
    this.keyboardHandler.blur();
    this.hasFocus = false;
    this.renderCursorAndSelection();
  }

  /**
   * Checks if the editor has focus.
   */
  isFocused(): boolean {
    return this.hasFocus;
  }

  /**
   * Gets the current selection.
   */
  getSelection(): Selection {
    return { ...this.currentState.selection };
  }

  /**
   * Gets the editor root element.
   */
  getElement(): HTMLElement {
    return this.editorRoot;
  }

  /**
   * Cleans up the editor.
   */
  destroy(): void {
    this.editorRoot.removeEventListener('focus', this.handleFocus, true);
    this.editorRoot.removeEventListener('blur', this.handleBlur, true);

    this.textRenderer.destroy();
    this.cursorRenderer.destroy();
    this.selectionRenderer.destroy();
    this.keyboardHandler.destroy();
    this.mouseHandler.destroy();
    this.positionCalculator.destroy();

    if (this.editorRoot.parentNode) {
      this.editorRoot.parentNode.removeChild(this.editorRoot);
    }
  }
}
