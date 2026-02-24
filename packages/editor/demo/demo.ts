import { Editor, EditorState, Selection, Decoration } from '../dist/index.js';

/**
 * Demo: External state management with the Editor component.
 */

// State is managed externally
let state: EditorState = {
  text: 'Hello, this is a demo of the custom text editor. Try typing, selecting text, and using the buttons below to apply decorations.',
  selection: { anchor: 0, head: 0 },
  decorations: [],
};

// Create the editor
const container = document.getElementById('editor-container')!;
const stateDisplay = document.getElementById('state-display')!;

const editor = new Editor(
  container,
  {
    onInsert: (position: number, text: string) => {
      console.log('onInsert:', position, JSON.stringify(text));

      // Update state externally
      const before = state.text.slice(0, position);
      const after = state.text.slice(position);
      state.text = before + text + after;

      // Update selection to after inserted text
      const newPos = position + text.length;
      state.selection = { anchor: newPos, head: newPos };

      // Adjust decorations
      state.decorations = adjustDecorationsForInsert(
        state.decorations,
        position,
        text.length
      );

      // Re-render
      editor.render(state);
      updateStateDisplay();
    },

    onDelete: (from: number, to: number) => {
      console.log('onDelete:', from, to);

      // Update state externally
      const before = state.text.slice(0, from);
      const after = state.text.slice(to);
      state.text = before + after;

      // Update selection to deletion point
      state.selection = { anchor: from, head: from };

      // Adjust decorations
      state.decorations = adjustDecorationsForDelete(state.decorations, from, to);

      // Re-render
      editor.render(state);
      updateStateDisplay();
    },

    onSelectionChange: (selection: Selection) => {
      console.log('onSelectionChange:', selection);

      // Update state externally
      state.selection = selection;

      // Re-render
      editor.render(state);
      updateStateDisplay();
    },
  },
  {
    placeholder: 'Start typing...',
  }
);

// Initial render
editor.render(state);
editor.focus();
updateStateDisplay();

/**
 * Adjusts decoration positions after text insertion.
 */
function adjustDecorationsForInsert(
  decorations: Decoration[],
  position: number,
  length: number
): Decoration[] {
  return decorations
    .map((dec) => {
      // Decoration is entirely before insertion - no change
      if (dec.to <= position) {
        return dec;
      }

      // Decoration is entirely after insertion - shift
      if (dec.from >= position) {
        return {
          ...dec,
          from: dec.from + length,
          to: dec.to + length,
        };
      }

      // Decoration spans the insertion point - extend
      return {
        ...dec,
        to: dec.to + length,
      };
    })
    .filter((dec) => dec.from < dec.to);
}

/**
 * Adjusts decoration positions after text deletion.
 */
function adjustDecorationsForDelete(
  decorations: Decoration[],
  from: number,
  to: number
): Decoration[] {
  const length = to - from;

  return decorations
    .map((dec) => {
      // Decoration is entirely before deletion - no change
      if (dec.to <= from) {
        return dec;
      }

      // Decoration is entirely after deletion - shift
      if (dec.from >= to) {
        return {
          ...dec,
          from: dec.from - length,
          to: dec.to - length,
        };
      }

      // Decoration is entirely within deletion - remove
      if (dec.from >= from && dec.to <= to) {
        return null;
      }

      // Decoration overlaps deletion start
      if (dec.from < from && dec.to <= to) {
        return {
          ...dec,
          to: from,
        };
      }

      // Decoration overlaps deletion end
      if (dec.from >= from && dec.to > to) {
        return {
          ...dec,
          from: from,
          to: dec.to - length,
        };
      }

      // Decoration spans the entire deletion
      return {
        ...dec,
        to: dec.to - length,
      };
    })
    .filter((dec): dec is Decoration => dec !== null && dec.from < dec.to);
}

/**
 * Updates the state display.
 */
function updateStateDisplay(): void {
  const { anchor, head } = state.selection;
  const hasSelection = anchor !== head;

  stateDisplay.textContent = JSON.stringify(
    {
      textLength: state.text.length,
      selection: state.selection,
      hasSelection,
      decorationCount: state.decorations.length,
    },
    null,
    2
  );
}

/**
 * Applies a decoration to the current selection.
 */
function applyDecoration(type: Decoration['type'], attributes?: Record<string, unknown>): void {
  const { anchor, head } = state.selection;
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);

  if (from === to) {
    console.log('No selection to decorate');
    return;
  }

  // Check if this decoration already exists
  const existingIndex = state.decorations.findIndex(
    (dec) => dec.from === from && dec.to === to && dec.type === type
  );

  if (existingIndex >= 0) {
    // Toggle off
    state.decorations.splice(existingIndex, 1);
  } else {
    // Add decoration
    state.decorations.push({ from, to, type, attributes });
  }

  editor.render(state);
  updateStateDisplay();
}

/**
 * Clears all decorations.
 */
function clearDecorations(): void {
  state.decorations = [];
  editor.render(state);
  updateStateDisplay();
}

// Button handlers
document.getElementById('btn-bold')?.addEventListener('click', () => {
  applyDecoration('bold');
});

document.getElementById('btn-italic')?.addEventListener('click', () => {
  applyDecoration('italic');
});

document.getElementById('btn-underline')?.addEventListener('click', () => {
  applyDecoration('underline');
});

document.getElementById('btn-highlight')?.addEventListener('click', () => {
  applyDecoration('highlight', { color: '#ffff00' });
});

document.getElementById('btn-clear')?.addEventListener('click', () => {
  clearDecorations();
});

// Export for console access
(window as unknown as { state: EditorState; editor: Editor }).state = state;
(window as unknown as { state: EditorState; editor: Editor }).editor = editor;
