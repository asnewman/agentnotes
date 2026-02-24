const CLASS_PREFIX = 'agentnotes-editor';
/**
 * Renders and animates the cursor.
 */
export class CursorRenderer {
    constructor(container, positionCalculator) {
        this.blinkInterval = null;
        this.isVisible = true;
        this.container = container;
        this.positionCalculator = positionCalculator;
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = `${CLASS_PREFIX}-cursor`;
        this.cursorElement.style.cssText = `
      position: absolute;
      width: 2px;
      background-color: #000;
      pointer-events: none;
      z-index: 10;
    `;
        this.container.appendChild(this.cursorElement);
    }
    /**
     * Updates the cursor position.
     */
    render(position, textElement, hasFocus) {
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
    startBlink() {
        if (this.blinkInterval !== null)
            return;
        this.blinkInterval = window.setInterval(() => {
            this.isVisible = !this.isVisible;
            this.cursorElement.style.opacity = this.isVisible ? '1' : '0';
        }, 530);
    }
    /**
     * Stops the cursor blink animation.
     */
    stopBlink() {
        if (this.blinkInterval !== null) {
            clearInterval(this.blinkInterval);
            this.blinkInterval = null;
        }
    }
    /**
     * Resets the blink cycle (shows cursor immediately).
     */
    resetBlink() {
        this.stopBlink();
        this.cursorElement.style.opacity = '1';
        this.isVisible = true;
        this.startBlink();
    }
    /**
     * Cleans up the renderer.
     */
    destroy() {
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
    background-color: #000;
    pointer-events: none;
    z-index: 10;
    transition: opacity 0.05s ease-in-out;
  }
`;
