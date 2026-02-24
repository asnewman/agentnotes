/**
 * Represents the cursor position or text selection range.
 * When anchor === head, the cursor is collapsed (no selection).
 */
export interface Selection {
  /** Selection start position (character offset) */
  anchor: number;
  /** Selection end position (character offset). Equals anchor if collapsed. */
  head: number;
}

/**
 * Types of text decorations supported by the editor.
 */
export type DecorationType = 'bold' | 'italic' | 'underline' | 'highlight' | 'fontSize' | 'color';

/**
 * A decoration applied to a range of text.
 */
export interface Decoration {
  /** Start character offset (inclusive) */
  from: number;
  /** End character offset (exclusive) */
  to: number;
  /** Type of decoration */
  type: DecorationType;
  /** Optional attributes for the decoration (e.g., { size: 18 } for fontSize) */
  attributes?: Record<string, unknown>;
}

/**
 * The complete state of the editor, owned externally.
 */
export interface EditorState {
  /** Plain text content */
  text: string;
  /** Cursor position or selection range */
  selection: Selection;
  /** Style ranges applied to the text */
  decorations: Decoration[];
}

/**
 * Callbacks fired when the user interacts with the editor.
 * The external owner handles these to update state.
 */
export interface EditorCallbacks {
  /** Called when text is inserted at a position */
  onInsert?: (position: number, text: string) => void;
  /** Called when text is deleted from a range */
  onDelete?: (from: number, to: number) => void;
  /** Called when the selection changes */
  onSelectionChange?: (selection: Selection) => void;
}

/**
 * Configuration options for the Editor.
 */
export interface EditorOptions {
  /** Placeholder text when editor is empty */
  placeholder?: string;
}

/**
 * A span of text with combined decoration styles.
 * Used internally for rendering.
 */
export interface StyledSpan {
  /** Start character offset */
  from: number;
  /** End character offset */
  to: number;
  /** The text content of this span */
  text: string;
  /** Combined decoration types active on this span */
  decorations: Decoration[];
}

/**
 * Represents a measured character position for hit testing.
 */
export interface CharacterMetrics {
  /** Character index */
  index: number;
  /** Left edge x coordinate */
  left: number;
  /** Right edge x coordinate */
  right: number;
  /** Top y coordinate */
  top: number;
  /** Bottom y coordinate */
  bottom: number;
}
