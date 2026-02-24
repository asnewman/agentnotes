/**
 * Measures character positions within a text container.
 * Uses a range-based approach for accurate measurements.
 */
export class PositionCalculator {
    constructor(container) {
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
    getOffsetFromPoint(x, y, textElement) {
        const textContent = textElement.textContent || '';
        if (textContent.length === 0)
            return 0;
        const containerRect = this.container.getBoundingClientRect();
        const relativeX = x - containerRect.left;
        const relativeY = y - containerRect.top;
        // Find all text nodes and their positions
        const textNodes = this.getTextNodes(textElement);
        if (textNodes.length === 0)
            return 0;
        // Find which text node we're in based on y coordinate
        let cumulativeOffset = 0;
        for (const node of textNodes) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = range.getClientRects();
            for (const rect of rects) {
                const rectRelativeY = rect.top - containerRect.top;
                const rectRelativeBottom = rect.bottom - containerRect.top;
                if (relativeY >= rectRelativeY && relativeY <= rectRelativeBottom) {
                    // We're in this line, find the character
                    const nodeText = node.textContent || '';
                    const offset = this.findCharacterInNode(node, relativeX, containerRect.left);
                    return cumulativeOffset + offset;
                }
            }
            cumulativeOffset += (node.textContent || '').length;
        }
        // If we're below all text, return end position
        return textContent.length;
    }
    /**
     * Finds the character offset within a text node using binary search.
     */
    findCharacterInNode(node, targetX, containerLeft) {
        const text = node.textContent || '';
        if (text.length === 0)
            return 0;
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
            }
            else {
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
    getCharacterRect(offset, textElement) {
        const textNodes = this.getTextNodes(textElement);
        if (textNodes.length === 0) {
            // No text, return a rect at the start
            const rect = textElement.getBoundingClientRect();
            return new DOMRect(rect.left, rect.top, 0, rect.height || 20);
        }
        let cumulativeOffset = 0;
        for (const node of textNodes) {
            const nodeLength = (node.textContent || '').length;
            if (offset <= cumulativeOffset + nodeLength) {
                const localOffset = offset - cumulativeOffset;
                const range = document.createRange();
                if (localOffset === 0) {
                    range.setStart(node, 0);
                    range.setEnd(node, Math.min(1, nodeLength));
                    const rect = range.getBoundingClientRect();
                    return new DOMRect(rect.left, rect.top, 0, rect.height);
                }
                else if (localOffset >= nodeLength) {
                    range.setStart(node, Math.max(0, nodeLength - 1));
                    range.setEnd(node, nodeLength);
                    const rect = range.getBoundingClientRect();
                    return new DOMRect(rect.right, rect.top, 0, rect.height);
                }
                else {
                    range.setStart(node, localOffset);
                    range.setEnd(node, localOffset + 1);
                    const rect = range.getBoundingClientRect();
                    return new DOMRect(rect.left, rect.top, rect.width, rect.height);
                }
            }
            cumulativeOffset += nodeLength;
        }
        // Offset is at the end
        const lastNode = textNodes[textNodes.length - 1];
        const range = document.createRange();
        range.selectNodeContents(lastNode);
        const rect = range.getBoundingClientRect();
        return new DOMRect(rect.right, rect.top, 0, rect.height);
    }
    /**
     * Gets the bounding rectangle for a selection range.
     */
    getSelectionRects(from, to, textElement) {
        if (from === to)
            return [];
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        const textNodes = this.getTextNodes(textElement);
        if (textNodes.length === 0)
            return [];
        const rects = [];
        let cumulativeOffset = 0;
        for (const node of textNodes) {
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
                    rects.push(new DOMRect(rect.x, rect.y, rect.width, rect.height));
                }
            }
            cumulativeOffset = nodeEnd;
        }
        return rects;
    }
    /**
     * Gets all text nodes within an element.
     */
    getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }
        return textNodes;
    }
    /**
     * Cleans up resources.
     */
    destroy() {
        if (this.measureSpan.parentNode) {
            this.measureSpan.parentNode.removeChild(this.measureSpan);
        }
    }
}
