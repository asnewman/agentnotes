import { SimpleEditor, Engine } from '@agentnotes/simple-editor';

// State
let currentFilePath: string | null = null;
let isDirty = false;

// DOM elements
const filenameEl = document.getElementById('filename') as HTMLSpanElement;
const dirtyIndicatorEl = document.getElementById('dirty-indicator') as HTMLSpanElement;
const editorWrapper = document.getElementById('editor-wrapper') as HTMLDivElement;
const hiddenInput = document.getElementById('hidden-input') as HTMLTextAreaElement;

// Title management
function getDisplayName(): string {
  if (!currentFilePath) return 'Untitled';
  const parts = currentFilePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function updateTitle(): void {
  const name = getDisplayName();
  const prefix = isDirty ? '* ' : '';
  filenameEl.textContent = `${prefix}${name}`;
  dirtyIndicatorEl.classList.toggle('hidden', !isDirty);
  window.api.setTitle(`${prefix}${name} - Simple Markdown`);
}

// Engine setup
const engine = new Engine({
  text: '',
  cursorPos: 0,
  onChange(state) {
    new SimpleEditor('editor-container', {
      content: state.content,
      cursorPos: state.cursorPos,
      cursorColor: '#d4d4d4',
      cursorTextColor: '#1e1e1e',
    });
  },
  onSave() {
    if (!isDirty) {
      isDirty = true;
      updateTitle();
    }
  },
});

// Initial render
const initialState = engine.getState();
new SimpleEditor('editor-container', {
  content: initialState.content,
  cursorPos: initialState.cursorPos,
});
updateTitle();

// File operations
async function handleOpen(): Promise<void> {
  const result = await window.api.openFile();
  if (result) {
    currentFilePath = result.filePath;
    engine.dispatch({ type: 'SET_CONTENT', text: result.content });
    isDirty = false;
    updateTitle();
  }
}

async function handleSave(): Promise<void> {
  const text = engine.getText();
  if (currentFilePath) {
    const result = await window.api.saveFile(text, currentFilePath);
    if (result.success) {
      isDirty = false;
      updateTitle();
    }
  } else {
    const result = await window.api.saveFileAs(text);
    if (result.success && result.filePath) {
      currentFilePath = result.filePath;
      isDirty = false;
      updateTitle();
    }
  }
}

// Menu event listeners
window.api.onMenuOpen(handleOpen);
window.api.onMenuSave(handleSave);

// Focus management
editorWrapper.addEventListener('click', () => {
  hiddenInput.focus();
});

hiddenInput.addEventListener('blur', () => {
  setTimeout(() => hiddenInput.focus(), 10);
});

hiddenInput.focus();

// Keyboard handling
hiddenInput.addEventListener('keydown', (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Backspace':
      e.preventDefault();
      engine.dispatch({ type: 'DELETE_BACKWARD' });
      break;
    case 'ArrowLeft':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_LEFT' });
      break;
    case 'ArrowRight':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_RIGHT' });
      break;
    case 'ArrowUp':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_UP' });
      break;
    case 'ArrowDown':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
      break;
    case 'Home':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_TO_START' });
      break;
    case 'End':
      e.preventDefault();
      engine.dispatch({ type: 'MOVE_CURSOR_TO_END' });
      break;
    case 'Enter':
      e.preventDefault();
      engine.dispatch({ type: 'INSERT_TEXT', text: '\n' });
      break;
  }
});

// Text input (captures typed characters and IME)
hiddenInput.addEventListener('input', () => {
  const text = hiddenInput.value;
  if (text) {
    engine.dispatch({ type: 'INSERT_TEXT', text });
    hiddenInput.value = '';
  }
});
