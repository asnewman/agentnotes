export interface SimpleEditorOptions {
  text: string;
}

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
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    const div = document.createElement('div');
    div.textContent = this.options.text;
    this.container.appendChild(div);
  }

  public setText(text: string): void {
    this.options.text = text;
    this.render();
  }

  public getText(): string {
    return this.options.text;
  }
}
