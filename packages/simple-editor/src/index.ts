export interface SimpleEditorOptions {
  text: string;
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

  private render(): void {
    this.container.innerHTML = '';
    const div = document.createElement('div');

    // If cursor position is specified, render text with cursor
    if (this.options.cursorPos !== undefined && this.options.cursorPos >= 0) {
      const pos = Math.min(this.options.cursorPos, this.options.text.length);
      const beforeCursor = this.options.text.substring(0, pos);
      const afterCursor = this.options.text.substring(pos);

      div.appendChild(document.createTextNode(beforeCursor));

      const cursor = document.createElement('span');
      cursor.className = 'simple-editor-cursor';
      div.appendChild(cursor);

      div.appendChild(document.createTextNode(afterCursor));
    } else {
      div.textContent = this.options.text;
    }

    this.container.appendChild(div);
  }
}
