export type Mark = 'bold' | 'italic' | 'underline';

export interface TextNode {
  value: string;
  marks?: Mark[];
}

export interface SimpleEditorOptions {
  text: TextNode[];
  cursorPos?: number;
}

const CURSOR_BLINK_STYLE = `
  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  .simple-editor-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background-color: #000;
    animation: blink 1s infinite;
    margin: 0 -1px;
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

  private applyMarks(el: HTMLSpanElement, marks?: Mark[]): void {
    if (!marks || marks.length === 0) return;

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

  private createCursor(): HTMLSpanElement {
    const cursor = document.createElement('span');
    cursor.className = 'simple-editor-cursor';
    return cursor;
  }

  private render(): void {
    this.container.innerHTML = '';
    const div = document.createElement('div');

    // Calculate total text length
    const totalLength = this.options.text.reduce((sum, node) => sum + node.value.length, 0);

    // If cursor position is specified, render text with cursor
    if (this.options.cursorPos !== undefined && this.options.cursorPos >= 0) {
      const pos = Math.min(this.options.cursorPos, totalLength);
      let offset = 0;
      let cursorInserted = false;

      for (const node of this.options.text) {
        const nodeStart = offset;
        const nodeEnd = offset + node.value.length;

        if (!cursorInserted && pos >= nodeStart && pos <= nodeEnd) {
          // This node contains the cursor
          const beforeText = node.value.substring(0, pos - nodeStart);
          const afterText = node.value.substring(pos - nodeStart);

          if (beforeText) {
            const beforeSpan = document.createElement('span');
            beforeSpan.textContent = beforeText;
            this.applyMarks(beforeSpan, node.marks);
            div.appendChild(beforeSpan);
          }

          div.appendChild(this.createCursor());

          if (afterText) {
            const afterSpan = document.createElement('span');
            afterSpan.textContent = afterText;
            this.applyMarks(afterSpan, node.marks);
            div.appendChild(afterSpan);
          }

          cursorInserted = true;
        } else {
          // Normal node rendering
          const span = document.createElement('span');
          span.textContent = node.value;
          this.applyMarks(span, node.marks);
          div.appendChild(span);
        }

        offset = nodeEnd;
      }
    } else {
      // No cursor, just render all nodes
      for (const node of this.options.text) {
        const span = document.createElement('span');
        span.textContent = node.value;
        this.applyMarks(span, node.marks);
        div.appendChild(span);
      }
    }

    this.container.appendChild(div);
  }
}
