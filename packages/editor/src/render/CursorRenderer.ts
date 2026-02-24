import { PositionCalculator } from '../utils/position.js';

const CLASS_PREFIX = 'agentnotes-editor';

/**
 * Renders and animates the cursor.
 */
export class CursorRenderer {
  private container: HTMLElement;
  private cursorElement: HTMLElement;
  private positionCalculator: PositionCalculator;
  private blinkInterval: number | null = null;
  private isVisible = true;

  constructor(container: HTMLElement, positionCalculator: PositionCalculator) {
    this.container = container;
    this.positionCalculator = positionCalculator;

    this.cursorElement = document.createElement('div');
    this.cursorElement.className = `${CLASS_PREFIX}-cursor`;
    this.cursorElement.style.cssText = `
      position: absolute;
      width: 2px;
      background-color: #fff;
      pointer-events: none;
      z-index: 10;
    `;

    this.container.appendChild(this.cursorElement);
  }

  /**
   * Updates the cursor position.
   */
  render(position: number, textElement: HTMLElement, hasFocus: boolean): void {
    if (!hasFocus) {
      this.cursorElement.style.display = 'none';
      this.stopBlink();
      return;
    }

    this.cursorElement.style.display = 'block';
    this.startBlink();

    const rect = this.positionCalculator.getCharacterRect(position, textElement);
    if (!rect) {
      // Position at start if we can't calculate
      const containerRect = textElement.getBoundingClientRect();
      this.cursorElement.style.left = '0px';
      this.cursorElement.style.top = '0px';
      this.cursorElement.style.height = '1.2em';
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const left = rect.left - containerRect.left;
    const top = rect.top - containerRect.top;

    this.cursorElement.style.left = `${left}px`;
    this.cursorElement.style.top = `${top}px`;
    this.cursorElement.style.height = `${rect.height || 20}px`;

    // Reset visibility when position changes
    this.cursorElement.style.opacity = '1';
    this.isVisible = true;
  }

  /**
   * Starts the cursor blink animation.
   */
  private startBlink(): void {
    if (this.blinkInterval !== null) return;

    this.blinkInterval = window.setInterval(() => {
      this.isVisible = !this.isVisible;
      this.cursorElement.style.opacity = this.isVisible ? '1' : '0';
    }, 530);
  }

  /**
   * Stops the cursor blink animation.
   */
  private stopBlink(): void {
    if (this.blinkInterval !== null) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }

  /**
   * Resets the blink cycle (shows cursor immediately).
   */
  resetBlink(): void {
    this.stopBlink();
    this.cursorElement.style.opacity = '1';
    this.isVisible = true;
    this.startBlink();
  }

  /**
   * Cleans up the renderer.
   */
  destroy(): void {
    this.stopBlink();
    if (this.cursorElement.parentNode) {
      this.cursorElement.parentNode.removeChild(this.cursorElement);
    }
  }
}

/**
 * CSS styles for the cursor.
 */
export const cursorStyles = `
  .${CLASS_PREFIX}-cursor {
    position: absolute;
    width: 2px;
    background-color: #fff;
    pointer-events: none;
    z-index: 10;
    transition: opacity 0.05s ease-in-out;
  }
`;
