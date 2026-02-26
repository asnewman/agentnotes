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
      if (element) {
        this.textElement.appendChild(element);
      }
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
   * Returns null if the span should not be rendered (e.g., image markdown text).
   */
  private createSpanElement(span: StyledSpan): HTMLElement | null {
    // Check if this span has an image decoration
    const imageDecoration = span.decorations.find((d) => d.type === 'image');
    if (imageDecoration) {
      return this.createImageElement(span, imageDecoration);
    }

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
        case 'color':
          const textColor = decoration.attributes?.color || '#000000';
          styles.push(`color: ${textColor}`);
          break;
      }
    }

    if (styles.length > 0) {
      element.style.cssText = styles.join('; ');
    }

    return element;
  }

  /**
   * Creates an image element for image decorations.
   */
  private createImageElement(span: StyledSpan, decoration: Decoration): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `${CLASS_PREFIX}-image-wrapper`;
    wrapper.dataset.from = String(span.from);
    wrapper.dataset.to = String(span.to);
    wrapper.style.cssText = `
      display: block;
      margin: 8px 0;
      max-width: 100%;
    `;

    const img = document.createElement('img');
    const src = decoration.attributes?.src as string || '';
    const alt = decoration.attributes?.alt as string || 'Image';
    img.src = src;
    img.alt = alt;
    img.style.cssText = `
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    `;

    // Show the raw markdown text below the image for editing context
    const markdownText = document.createElement('span');
    markdownText.textContent = span.text;
    markdownText.style.cssText = `
      display: block;
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      font-family: monospace;
    `;

    wrapper.appendChild(img);
    wrapper.appendChild(markdownText);

    return wrapper;
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
