export type Mark = 'bold' | 'italic' | 'underline';

export interface TextNode {
  type: 'text';
  value: string;
  marks?: Mark[];
  size?: string;
}

export interface ImageNode {
  type: 'image';
  src: string;
}

export type Node = TextNode | ImageNode;

function isTextNode(node: Node): node is TextNode {
  return node.type === 'text';
}

export interface SimpleEditorOptions {
  content: Node[];
  cursorPos?: number;
}

const CURSOR_BLINK_STYLE = `
  #simple-editor-container {
    font-family: monospace;
  }
  .simple-editor-cursor {
    background-color: #000;
    color: #fff;
    padding: 0;
    white-space: pre-wrap;
  }
`;

export class SimpleEditor {
  private container: HTMLDivElement;
  private options: SimpleEditorOptions;

  constructor(containerId: string, options: SimpleEditorOptions) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container element not found: ${containerId}`);
    }
    this.container = element as HTMLDivElement;

    this.options = options;
    this.injectStyles();
    this.render();
  }

  private injectStyles(): void {
    // Check if styles are already injected globally
    if (document.getElementById('simple-editor-styles')) return;

    const style = document.createElement('style');
    style.id = 'simple-editor-styles';
    style.textContent = CURSOR_BLINK_STYLE;
    document.head.appendChild(style);
  }

  private applyTextNodeStyling(el: HTMLSpanElement, marks?: Mark[], size?: string): void {
    if (marks && marks.length > 0) {
      marks.forEach(mark => {
        if (mark === 'bold') {
          el.style.fontWeight = 'bold';
        } else if (mark === 'italic') {
          el.style.fontStyle = 'italic';
        } else if (mark === 'underline') {
          el.style.textDecoration = 'underline';
        }
      });
    }

    if (size) {
      el.style.fontSize = size;
    }
  }

  private renderTextWithNewlines(container: HTMLElement, text: string, marks?: Mark[], size?: string): void {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        const span = document.createElement('span');
        span.textContent = lines[i];
        this.applyTextNodeStyling(span, marks, size);
        container.appendChild(span);
      }
      if (i < lines.length - 1) {
        container.appendChild(document.createElement('br'));
      }
    }
  }

  private renderImageNode(container: HTMLElement, node: ImageNode): void {
    const img = document.createElement('img');
    img.src = node.src;
    img.style.width = '500px';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    container.appendChild(img);
  }

  private findPreviousCharSize(pos: number): string | undefined {
    const p = pos - 1;
    if (p < 0) return undefined;

    let searchOffset = 0;
    for (const n of this.options.content) {
      if (!isTextNode(n)) continue;
      const nEnd = searchOffset + n.value.length;
      if (p >= searchOffset && p < nEnd) {
        if (n.value[p - searchOffset] !== '\n') {
          return n.size;
        }
        return undefined;
      }
      searchOffset = nEnd;
    }
    return undefined;
  }

  private createCursor(character: string = ' ', marks?: Mark[], size?: string): HTMLSpanElement {
    const cursor = document.createElement('span');
    cursor.className = 'simple-editor-cursor';
    cursor.textContent = character;
    this.applyTextNodeStyling(cursor, marks, size);
    return cursor;
  }

  private render(): void {
    this.container.innerHTML = '';
    const div = document.createElement('div');
    div.id = 'simple-editor-container';

    // Calculate total text length (image nodes contribute 0)
    const totalLength = this.options.content.reduce((sum, node) => {
      return sum + (isTextNode(node) ? node.value.length : 0);
    }, 0);

    // If cursor position is specified, render text with cursor
    if (this.options.cursorPos !== undefined && this.options.cursorPos >= 0) {
      const pos = Math.min(this.options.cursorPos, totalLength);
      let offset = 0;
      let cursorInserted = false;

      for (const node of this.options.content) {
        if (!isTextNode(node)) {
          this.renderImageNode(div, node);
          continue;
        }

        const nodeStart = offset;
        const nodeEnd = offset + node.value.length;

        if (!cursorInserted && pos >= nodeStart && (pos < nodeEnd || nodeEnd === totalLength)) {
          // This node contains the cursor
          const beforeText = node.value.substring(0, pos - nodeStart);
          const rawCursorChar = node.value.charAt(pos - nodeStart);
          const isNewline = rawCursorChar === '\n';
          // Display space for newlines and empty positions (newline positions can occur naturally during navigation)
          const cursorChar = (!rawCursorChar || isNewline) ? ' ' : rawCursorChar;
          const afterText = node.value.substring(pos - nodeStart + 1);

          // For newlines/end-of-text, inherit font size from the previous non-newline character
          let cursorSize = node.size;
          if (!rawCursorChar || isNewline) {
            cursorSize = this.findPreviousCharSize(pos);
          }

          this.renderTextWithNewlines(div, beforeText, node.marks, node.size);
          div.appendChild(this.createCursor(cursorChar, node.marks, cursorSize));
          // Preserve the line break when cursor is on a newline character
          if (isNewline) {
            div.appendChild(document.createElement('br'));
          }
          this.renderTextWithNewlines(div, afterText, node.marks, node.size);

          cursorInserted = true;
        } else {
          // Normal node rendering
          this.renderTextWithNewlines(div, node.value, node.marks, node.size);
        }

        offset = nodeEnd;
      }
    } else {
      // No cursor, just render all nodes
      for (const node of this.options.content) {
        if (!isTextNode(node)) {
          this.renderImageNode(div, node);
          continue;
        }
        this.renderTextWithNewlines(div, node.value, node.marks, node.size);
      }
    }

    this.container.appendChild(div);
  }
}
