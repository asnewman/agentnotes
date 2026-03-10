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

export interface SimpleEditorOptions {
  content: Node[];
  cursorPos?: number;
}
