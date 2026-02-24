import { Decoration, StyledSpan } from '../types.js';
import { splitTextIntoSpans } from '../utils/decorations.js';

/**
 * CSS class prefix for styling
 */
const CLASS_PREFIX = 'agentnotes-editor';

/**
 * Renders text with decorations into the DOM.
 */
export class TextRenderer {
  private container: HTMLElement;
  private textElement: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.textElement = document.createElement('div');
    this.textElement.className = `${CLASS_PREFIX}-text`;
    this.textElement.style.cssText = `
      position: relative;
      white-space: pre-wrap;
      word-wrap: break-word;
      outline: none;
      min-height: 1.5em;
    `;
    this.container.appendChild(this.textElement);
  }

  /**
   * Renders the text with decorations.
   */
  render(text: string, decorations: Decoration[]): void {
    // Clear existing content
    this.textElement.innerHTML = '';

    if (text.length === 0) {
      // Add a zero-width space to maintain height
      const placeholder = document.createElement('span');
      placeholder.textContent = '\u200B';
      this.textElement.appendChild(placeholder);
      return;
    }

    const spans = splitTextIntoSpans(text, decorations);

    for (const span of spans) {
      const element = this.createSpanElement(span);
      this.textElement.appendChild(element);
    }

    // If text ends with a newline, add a zero-width space after it.
    // This prevents the browser from collapsing the trailing newline,
    // allowing pre-wrap to render it visually.
    if (text.endsWith('\n')) {
      const trailingSpan = document.createElement('span');
      trailingSpan.textContent = '\u200B';
      trailingSpan.dataset.from = String(text.length);
      trailingSpan.dataset.to = String(text.length);
      trailingSpan.className = 'trailing-cursor-anchor';
      this.textElement.appendChild(trailingSpan);
    }
  }

  /**
   * Creates a span element with appropriate styles for decorations.
   */
  private createSpanElement(span: StyledSpan): HTMLSpanElement {
    const element = document.createElement('span');
    element.textContent = span.text;
    element.dataset.from = String(span.from);
    element.dataset.to = String(span.to);

    const styles: string[] = [];

    for (const decoration of span.decorations) {
      switch (decoration.type) {
        case 'bold':
          styles.push('font-weight: bold');
          break;
        case 'italic':
          styles.push('font-style: italic');
          break;
        case 'underline':
          styles.push('text-decoration: underline');
          break;
        case 'highlight':
          const bgColor = decoration.attributes?.color || '#ffff00';
          styles.push(`background-color: ${bgColor}`);
          break;
        case 'fontSize':
          const size = decoration.attributes?.size || 16;
          styles.push(`font-size: ${size}px`);
          break;
      }
    }

    if (styles.length > 0) {
      element.style.cssText = styles.join('; ');
    }

    return element;
  }

  /**
   * Gets the text element for position calculations.
   */
  getTextElement(): HTMLElement {
    return this.textElement;
  }

  /**
   * Sets placeholder text when editor is empty.
   */
  setPlaceholder(placeholder: string | undefined, isEmpty: boolean): void {
    if (isEmpty && placeholder) {
      this.textElement.dataset.placeholder = placeholder;
      this.textElement.classList.add(`${CLASS_PREFIX}-empty`);
    } else {
      delete this.textElement.dataset.placeholder;
      this.textElement.classList.remove(`${CLASS_PREFIX}-empty`);
    }
  }

  /**
   * Cleans up the renderer.
   */
  destroy(): void {
    if (this.textElement.parentNode) {
      this.textElement.parentNode.removeChild(this.textElement);
    }
  }
}

/**
 * CSS styles for the text renderer.
 */
export const textRendererStyles = `
  .${CLASS_PREFIX}-text {
    position: relative;
    white-space: pre-wrap;
    word-wrap: break-word;
    outline: none;
    min-height: 1.5em;
  }

  .${CLASS_PREFIX}-text.${CLASS_PREFIX}-empty::before {
    content: attr(data-placeholder);
    color: #999;
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
  }
`;
