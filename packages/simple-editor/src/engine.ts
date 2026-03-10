import type { Node, TextNode, ImageNode, Mark } from './types.js';

export interface EditorState {
  content: Node[];
  cursorPos: number;
}

export type Action =
  | { type: 'INSERT_TEXT'; text: string }
  | { type: 'DELETE_BACKWARD' }
  | { type: 'MOVE_CURSOR'; position: number }
  | { type: 'MOVE_CURSOR_LEFT' }
  | { type: 'MOVE_CURSOR_RIGHT' }
  | { type: 'MOVE_CURSOR_UP' }
  | { type: 'MOVE_CURSOR_DOWN' }
  | { type: 'MOVE_CURSOR_TO_START' }
  | { type: 'MOVE_CURSOR_TO_END' }
  | { type: 'INSERT_IMAGE'; src: string }
  | { type: 'SET_CONTENT'; text: string };

export interface EngineOptions {
  text?: string;
  cursorPos?: number;
  onSave?: (text: string) => void;
  onChange?: (state: EditorState) => void;
}

interface Decoration {
  from: number;
  to: number;
  type: 'bold' | 'italic' | 'fontSize' | 'image';
  attributes?: Record<string, string | number>;
}

const HEADING_SIZES: Record<number, string> = {
  1: '32px',
  2: '24px',
  3: '20px',
  4: '18px',
  5: '16px',
  6: '14px',
};

function parseMarkdownToDecorations(text: string): Decoration[] {
  const decorations: Decoration[] = [];
  const lines = text.split('\n');
  let offset = 0;

  for (const line of lines) {
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      decorations.push({
        from: offset,
        to: offset + line.length,
        type: 'fontSize',
        attributes: { size: HEADING_SIZES[level] },
      });
    }

    // Bold (**text** or __text__)
    const boldRegex = /(\*\*|__)([^*_]+)\1/g;
    let match;
    while ((match = boldRegex.exec(line)) !== null) {
      decorations.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        type: 'bold',
      });
    }

    // Italic (*text* or _text_)
    const italicRegex = /(?<!\*|\w)(\*|_)(?!\1)([^*_\n]+)\1(?!\1|\w)/g;
    while ((match = italicRegex.exec(line)) !== null) {
      decorations.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        type: 'italic',
      });
    }

    // Images (![alt](url)) - must be on their own line
    const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
    const imageMatch = line.match(imageRegex);
    if (imageMatch) {
      decorations.push({
        from: offset,
        to: offset + line.length,
        type: 'image',
        attributes: { src: imageMatch[2], alt: imageMatch[1] || 'image' },
      });
    }

    offset += line.length + 1; // +1 for newline
  }

  return decorations;
}

function decorationsToNodes(text: string, decorations: Decoration[]): Node[] {
  if (text.length === 0) return [];

  const imageDecorations = decorations.filter(d => d.type === 'image');
  const styleDecorations = decorations.filter(d => d.type !== 'image');

  // If there are no image decorations, process as a single text segment
  if (imageDecorations.length === 0) {
    return textSegmentToNodes(text, 0, text.length, styleDecorations);
  }

  // Split into segments around image lines
  const nodes: Node[] = [];
  let pos = 0;

  for (const imgDec of imageDecorations) {
    // Text before the image line
    if (pos < imgDec.from) {
      const segment = text.slice(pos, imgDec.from);
      // Text before an image line always ends with \n (images start at line beginnings)
      const trimmed = segment.slice(0, -1);
      if (trimmed.length > 0) {
        const segNodes = textSegmentToNodes(text, pos, pos + trimmed.length, styleDecorations);
        nodes.push(...segNodes);
      }
      // Add a newline TextNode to preserve line break before image
      nodes.push({ type: 'text', value: '\n' });
    }

    // The image itself
    nodes.push({
      type: 'image',
      src: String(imgDec.attributes!.src),
    } as ImageNode);

    pos = imgDec.to + 1; // skip past the newline after the image line
  }

  // Remaining text after last image
  if (pos < text.length) {
    nodes.push({ type: 'text', value: '\n' });
    const segNodes = textSegmentToNodes(text, pos, text.length, styleDecorations);
    nodes.push(...segNodes);
  }

  return nodes;
}

function textSegmentToNodes(
  fullText: string,
  segStart: number,
  segEnd: number,
  decorations: Decoration[]
): Node[] {
  // Collect boundaries within this segment
  const boundaries = new Set<number>();
  boundaries.add(segStart);
  boundaries.add(segEnd);

  for (const dec of decorations) {
    if (dec.from > segStart && dec.from < segEnd) boundaries.add(dec.from);
    if (dec.to > segStart && dec.to < segEnd) boundaries.add(dec.to);
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const nodes: Node[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const spanText = fullText.slice(from, to);
    const active = decorations.filter(d => d.from < to && d.to > from);

    const marks: Mark[] = [];
    let size: string | undefined;

    for (const dec of active) {
      if (dec.type === 'bold') marks.push('bold');
      if (dec.type === 'italic') marks.push('italic');
      if (dec.type === 'fontSize') size = String(dec.attributes!.size);
    }

    const node: TextNode = { type: 'text', value: spanText };
    if (marks.length > 0) node.marks = marks;
    if (size) node.size = size;
    nodes.push(node);
  }

  // Merge adjacent TextNodes with identical marks/size
  return mergeTextNodes(nodes);
}

function marksEqual(a?: Mark[], b?: Mark[]): boolean {
  const aMarks = a ?? [];
  const bMarks = b ?? [];
  if (aMarks.length !== bMarks.length) return false;
  const aSorted = [...aMarks].sort();
  const bSorted = [...bMarks].sort();
  return aSorted.every((m, i) => m === bSorted[i]);
}

function mergeTextNodes(nodes: Node[]): Node[] {
  const result: Node[] = [nodes[0]];

  for (let i = 1; i < nodes.length; i++) {
    const prev = result[result.length - 1];
    const curr = nodes[i];

    if (
      prev.type === 'text' &&
      curr.type === 'text' &&
      marksEqual(prev.marks, curr.marks) &&
      prev.size === curr.size
    ) {
      result[result.length - 1] = {
        ...prev,
        value: prev.value + curr.value,
      };
    } else {
      result.push(curr);
    }
  }

  return result;
}

export function parseMarkdown(text: string): Node[] {
  const decorations = parseMarkdownToDecorations(text);
  return decorationsToNodes(text, decorations);
}

function getLineAndColumn(text: string, pos: number): { line: number; col: number } {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const lineEnd = offset + lines[i].length;
    if (pos <= lineEnd) {
      return { line: i, col: pos - offset };
    }
    offset = lineEnd + 1; // +1 for the newline
  }
  return { line: lines.length - 1, col: pos - offset };
}

function getPositionFromLineAndColumn(text: string, line: number, col: number): number {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < line; i++) {
    offset += lines[i].length + 1;
  }
  return offset + Math.min(col, lines[line].length);
}

export class Engine {
  private text: string;
  private cursorPos: number;
  private onSave?: (text: string) => void;
  private onChange?: (state: EditorState) => void;

  constructor(options?: EngineOptions) {
    this.text = options?.text ?? '';
    this.cursorPos = Math.min(options?.cursorPos ?? 0, this.text.length);
    this.onSave = options?.onSave;
    this.onChange = options?.onChange;
  }

  dispatch(action: Action): EditorState {
    let textChanged = false;

    switch (action.type) {
      case 'INSERT_TEXT': {
        this.text =
          this.text.slice(0, this.cursorPos) +
          action.text +
          this.text.slice(this.cursorPos);
        this.cursorPos += action.text.length;
        textChanged = true;
        break;
      }

      case 'DELETE_BACKWARD': {
        if (this.cursorPos > 0) {
          this.text =
            this.text.slice(0, this.cursorPos - 1) +
            this.text.slice(this.cursorPos);
          this.cursorPos--;
          textChanged = true;
        }
        break;
      }

      case 'MOVE_CURSOR': {
        this.cursorPos = Math.max(0, Math.min(action.position, this.text.length));
        break;
      }

      case 'MOVE_CURSOR_LEFT': {
        if (this.cursorPos > 0) this.cursorPos--;
        break;
      }

      case 'MOVE_CURSOR_RIGHT': {
        if (this.cursorPos < this.text.length) this.cursorPos++;
        break;
      }

      case 'MOVE_CURSOR_UP': {
        const { line, col } = getLineAndColumn(this.text, this.cursorPos);
        if (line > 0) {
          this.cursorPos = getPositionFromLineAndColumn(this.text, line - 1, col);
        }
        break;
      }

      case 'MOVE_CURSOR_DOWN': {
        const { line, col } = getLineAndColumn(this.text, this.cursorPos);
        const lineCount = this.text.split('\n').length;
        if (line < lineCount - 1) {
          this.cursorPos = getPositionFromLineAndColumn(this.text, line + 1, col);
        }
        break;
      }

      case 'MOVE_CURSOR_TO_START': {
        this.cursorPos = 0;
        break;
      }

      case 'MOVE_CURSOR_TO_END': {
        this.cursorPos = this.text.length;
        break;
      }

      case 'INSERT_IMAGE': {
        let insertion = `![](${action.src})`;
        // Ensure image is on its own line
        if (this.cursorPos > 0 && this.text[this.cursorPos - 1] !== '\n') {
          insertion = '\n' + insertion;
        }
        if (this.cursorPos < this.text.length && this.text[this.cursorPos] !== '\n') {
          insertion = insertion + '\n';
        }
        this.text =
          this.text.slice(0, this.cursorPos) +
          insertion +
          this.text.slice(this.cursorPos);
        this.cursorPos += insertion.length;
        textChanged = true;
        break;
      }

      case 'SET_CONTENT': {
        this.text = action.text;
        this.cursorPos = 0;
        textChanged = true;
        break;
      }
    }

    const state = this.getState();

    if (textChanged && this.onSave) {
      this.onSave(this.text);
    }

    if (this.onChange) {
      this.onChange(state);
    }

    return state;
  }

  getState(): EditorState {
    return {
      content: parseMarkdown(this.text),
      cursorPos: this.cursorPos,
    };
  }

  getText(): string {
    return this.text;
  }

  getTextLength(): number {
    return this.text.length;
  }
}
