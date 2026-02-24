// Main exports
export { Editor } from './Editor.js';

// Types
export {
  EditorState,
  EditorCallbacks,
  EditorOptions,
  Selection,
  Decoration,
  DecorationType,
  StyledSpan,
  CharacterMetrics,
} from './types.js';

// Utilities
export {
  splitTextIntoSpans,
  mergeDecorations,
  isPositionDecorated,
  getDecorationsAtPosition,
} from './utils/decorations.js';

export { PositionCalculator } from './utils/position.js';
