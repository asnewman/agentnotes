const CLASS_PREFIX = 'agentnotes-editor';
/**
 * Renders selection highlight boxes.
 */
export class SelectionRenderer {
    constructor(container, positionCalculator) {
        this.highlightElements = [];
        this.container = container;
        this.positionCalculator = positionCalculator;
        this.selectionLayer = document.createElement('div');
        this.selectionLayer.className = `${CLASS_PREFIX}-selection-layer`;
        this.selectionLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 1;
    `;
        // Insert at the beginning so it's behind the text
        this.container.insertBefore(this.selectionLayer, this.container.firstChild);
    }
    /**
     * Renders the selection highlight.
     */
    render(selection, textElement, hasFocus) {
        this.clearHighlights();
        // No selection if collapsed or no focus
        if (selection.anchor === selection.head || !hasFocus) {
            return;
        }
        const from = Math.min(selection.anchor, selection.head);
        const to = Math.max(selection.anchor, selection.head);
        const rects = this.positionCalculator.getSelectionRects(from, to, textElement);
        const containerRect = this.container.getBoundingClientRect();
        for (const rect of rects) {
            const highlight = document.createElement('div');
            highlight.className = `${CLASS_PREFIX}-selection-highlight`;
            highlight.style.cssText = `
        position: absolute;
        background-color: rgba(66, 133, 244, 0.3);
        pointer-events: none;
        left: ${rect.left - containerRect.left}px;
        top: ${rect.top - containerRect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
      `;
            this.selectionLayer.appendChild(highlight);
            this.highlightElements.push(highlight);
        }
    }
    /**
     * Clears all highlight elements.
     */
    clearHighlights() {
        for (const el of this.highlightElements) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this.highlightElements = [];
    }
    /**
     * Cleans up the renderer.
     */
    destroy() {
        this.clearHighlights();
        if (this.selectionLayer.parentNode) {
            this.selectionLayer.parentNode.removeChild(this.selectionLayer);
        }
    }
}
/**
 * CSS styles for selection.
 */
export const selectionStyles = `
  .${CLASS_PREFIX}-selection-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
  }

  .${CLASS_PREFIX}-selection-highlight {
    position: absolute;
    background-color: rgba(66, 133, 244, 0.3);
    pointer-events: none;
  }
`;
