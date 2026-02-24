import { CharacterMetrics } from '../types.js';

// Type for caretPositionFromPoint result (Firefox)
interface CaretPosition {
  offsetNode: Node;
  offset: number;
}

// Helper to get caret position from point (cross-browser)
function getCaretPositionFromPoint(x: number, y: number): CaretPosition | null {
  // Firefox
  if ('caretPositionFromPoint' in document) {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos) {
      return { offsetNode: pos.offsetNode, offset: pos.offset };
    }
  }
  // WebKit/Blink (Chrome, Safari, Edge)
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      return { offsetNode: range.startContainer, offset: range.startOffset };
    }
  }
  return null;
}

/**
 * Measures character positions within a text container.
 * Uses a range-based approach for accurate measurements.
 */
export class PositionCalculator {
  private container: HTMLElement;
  private measureSpan: HTMLSpanElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.measureSpan = document.createElement('span');
    this.measureSpan.style.visibility = 'hidden';
    this.measureSpan.style.position = 'absolute';
    this.measureSpan.style.whiteSpace = 'pre';
    this.measureSpan.style.pointerEvents = 'none';
  }

  /**
   * Gets the character offset from x,y coordinates.
   * Uses binary search for efficiency.
   */
  getOffsetFromPoint(x: number, y: number, textElement: HTMLElement): number {
    const textContent = textElement.textContent || '';
    // Handle zero-width space used for empty editor
    if (textContent.length === 0 || textContent === '\u200B') return 0;

    const containerRect = this.container.getBoundingClientRect();

    // Find all text nodes and their positions
    const textNodes = this.getTextNodes(textElement);
    if (textNodes.length === 0) return 0;

    // Filter out zero-width space nodes entirely for offset counting
    const validTextNodes = textNodes.filter(
      node => {
        if (!node.textContent) return false;
        if (node.textContent === '\u200B') return false;
        return true;
      }
    );

    // Calculate total text length
    const totalTextLength = validTextNodes.reduce(
      (sum, node) => sum + (node.textContent || '').length, 0
    );

    if (validTextNodes.length === 0) return 0;

    // Use browser's caret position API for accurate positioning
    // This handles wrapped text correctly
    const caretPos = getCaretPositionFromPoint(x, y);

    if (caretPos && caretPos.offsetNode.nodeType === Node.TEXT_NODE) {
      // Verify the node is within our text element
      if (textElement.contains(caretPos.offsetNode)) {
        // Check if click is on trailing cursor anchor
        const parent = caretPos.offsetNode.parentElement;
        if (parent?.classList.contains('trailing-cursor-anchor')) {
          return totalTextLength;
        }

        // Find the cumulative offset for this text node
        let cumulativeOffset = 0;
        for (const node of validTextNodes) {
          if (node === caretPos.offsetNode) {
            return cumulativeOffset + caretPos.offset;
          }
          cumulativeOffset += (node.textContent || '').length;
        }
      }
    }

    // Fallback: manual calculation
    return this.getOffsetFromPointManual(x, y, textElement, validTextNodes, containerRect);
  }

  /**
   * Manual fallback for offset calculation when caretPositionFromPoint isn't available.
   */
  private getOffsetFromPointManual(
    x: number,
    y: number,
    textElement: HTMLElement,
    validTextNodes: Text[],
    containerRect: DOMRect
  ): number {
    const relativeX = x - containerRect.left;
    const relativeY = y - containerRect.top;

    // Track closest match for fallback
    let closestNode: Text | null = null;
    let closestDistance = Infinity;
    let closestCumulativeOffset = 0;

    let cumulativeOffset = 0;
    for (const node of validTextNodes) {
      const nodeLength = (node.textContent || '').length;
      const range = document.createRange();

      // Check each character position to find the line
      for (let i = 0; i <= nodeLength; i++) {
        range.setStart(node, i);
        range.setEnd(node, Math.min(i + 1, nodeLength));
        const rect = range.getBoundingClientRect();

        const rectRelativeY = rect.top - containerRect.top;
        const rectRelativeBottom = rect.bottom - containerRect.top;

        // Calculate distance to this rect for fallback
        const distY = relativeY < rectRelativeY
          ? rectRelativeY - relativeY
          : relativeY > rectRelativeBottom
            ? relativeY - rectRelativeBottom
            : 0;

        if (distY < closestDistance) {
          closestDistance = distY;
          closestNode = node;
          closestCumulativeOffset = cumulativeOffset;
        }

        if (relativeY >= rectRelativeY && relativeY <= rectRelativeBottom) {
          // We're on this line - now find exact character
          const charLeft = rect.left - containerRect.left;
          const charRight = rect.right - containerRect.left;
          const charMid = (charLeft + charRight) / 2;

          if (relativeX <= charMid) {
            return cumulativeOffset + i;
          }
        }
      }

      cumulativeOffset += nodeLength;
    }

    // Fallback: use closest node with binary search
    if (closestNode) {
      const offset = this.findCharacterInNode(
        closestNode,
        relativeX,
        containerRect.left
      );
      return closestCumulativeOffset + offset;
    }

    return (textElement.textContent || '').length;
  }

  /**
   * Finds the character offset within a text node using binary search.
   */
  private findCharacterInNode(
    node: Text,
    targetX: number,
    containerLeft: number
  ): number {
    const text = node.textContent || '';
    if (text.length === 0) return 0;

    const range = document.createRange();
    let low = 0;
    let high = text.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      range.setStart(node, 0);
      range.setEnd(node, mid);

      const rect = range.getBoundingClientRect();
      const charRight = rect.right - containerLeft;

      if (targetX <= charRight) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    // Check if we're closer to the previous character
    if (low > 0 && low <= text.length) {
      range.setStart(node, 0);
      range.setEnd(node, low - 1);
      const prevRect = range.getBoundingClientRect();
      const prevRight = prevRect.right - containerLeft;

      range.setStart(node, 0);
      range.setEnd(node, low);
      const currRect = range.getBoundingClientRect();
      const currRight = currRect.right - containerLeft;

      // If closer to the start of current char, stay; otherwise go to previous
      const prevMid = prevRight;
      const currMid = (prevRight + currRight) / 2;

      if (targetX < currMid) {
        return low - 1;
      }
    }

    return Math.min(low, text.length);
  }

  /**
   * Gets the rectangle for a character at a given offset.
   */
  getCharacterRect(
    offset: number,
    textElement: HTMLElement
  ): DOMRect | null {
    const textNodes = this.getTextNodes(textElement);

    // Find trailing cursor anchor separately
    const trailingAnchor = textElement.querySelector('.trailing-cursor-anchor');

    // Filter out zero-width space nodes (including trailing cursor anchor for counting)
    const validTextNodes = textNodes.filter(
      node => {
        if (!node.textContent) return false;
        if (node.textContent === '\u200B') return false;
        return true;
      }
    );

    // Calculate total text length (excluding zero-width spaces)
    const totalTextLength = validTextNodes.reduce(
      (sum, node) => sum + (node.textContent || '').length, 0
    );

    // If cursor is at the end and there's a trailing anchor, use its position
    if (offset >= totalTextLength && trailingAnchor) {
      const rect = trailingAnchor.getBoundingClientRect();
      return new DOMRect(rect.left, rect.top, 0, rect.height || 20);
    }

    if (validTextNodes.length === 0) {
      // No text, return a rect at the start
      const rect = textElement.getBoundingClientRect();
      return new DOMRect(rect.left, rect.top, 0, rect.height || 20);
    }

    let cumulativeOffset = 0;
    for (const node of validTextNodes) {
      const nodeLength = (node.textContent || '').length;

      if (offset <= cumulativeOffset + nodeLength) {
        const localOffset = offset - cumulativeOffset;
        const range = document.createRange();

        if (localOffset === 0) {
          range.setStart(node, 0);
          range.setEnd(node, Math.min(1, nodeLength));
          const rect = range.getBoundingClientRect();
          return new DOMRect(rect.left, rect.top, 0, rect.height);
        } else if (localOffset >= nodeLength) {
          range.setStart(node, Math.max(0, nodeLength - 1));
          range.setEnd(node, nodeLength);
          const rect = range.getBoundingClientRect();
          return new DOMRect(rect.right, rect.top, 0, rect.height);
        } else {
          range.setStart(node, localOffset);
          range.setEnd(node, localOffset + 1);
          const rect = range.getBoundingClientRect();
          return new DOMRect(rect.left, rect.top, rect.width, rect.height);
        }
      }

      cumulativeOffset += nodeLength;
    }

    // Offset is at the end
    const lastNode = validTextNodes[validTextNodes.length - 1];
    const range = document.createRange();
    range.selectNodeContents(lastNode);
    const rect = range.getBoundingClientRect();
    return new DOMRect(rect.right, rect.top, 0, rect.height);
  }

  /**
   * Gets the bounding rectangle for a selection range.
   */
  getSelectionRects(
    from: number,
    to: number,
    textElement: HTMLElement
  ): DOMRect[] {
    if (from === to) return [];

    const start = Math.min(from, to);
    const end = Math.max(from, to);

    const textNodes = this.getTextNodes(textElement);
    // Filter out zero-width space nodes
    const validTextNodes = textNodes.filter(
      node => node.textContent && node.textContent !== '\u200B'
    );
    if (validTextNodes.length === 0) return [];

    const rects: DOMRect[] = [];
    let cumulativeOffset = 0;

    for (const node of validTextNodes) {
      const nodeLength = (node.textContent || '').length;
      const nodeEnd = cumulativeOffset + nodeLength;

      // Check if this node overlaps with the selection
      if (start < nodeEnd && end > cumulativeOffset) {
        const localStart = Math.max(0, start - cumulativeOffset);
        const localEnd = Math.min(nodeLength, end - cumulativeOffset);

        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, localEnd);

        const nodeRects = range.getClientRects();
        for (const rect of nodeRects) {
          rects.push(
            new DOMRect(rect.x, rect.y, rect.width, rect.height)
          );
        }
      }

      cumulativeOffset = nodeEnd;
    }

    return rects;
  }

  /**
   * Gets all text nodes within an element.
   */
  private getTextNodes(element: HTMLElement): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    return textNodes;
  }

  /**
   * Cleans up resources.
   */
  destroy(): void {
    if (this.measureSpan.parentNode) {
      this.measureSpan.parentNode.removeChild(this.measureSpan);
    }
  }
}
