import { CommentsPanel } from './components/CommentsPanel';
import { NoteList } from './components/NoteList';
import { NoteView } from './components/NoteView';
import {
  addComment,
  clearCache,
  createDirectory,
  createNote,
  deleteComment,
  deleteDirectory,
  deleteNote,
  getDirectory,
  listNotes,
  moveNote,
  selectDirectory,
  updateNote,
  updateNoteMetadata,
} from './lib/noteStore';
import type { CommentAnchor, Note, NotesListResponse, NotesListResult } from './types';

let noteList: NoteList | null = null;
let noteView: NoteView | null = null;
let commentsPanel: CommentsPanel | null = null;
let currentNoteId: string | null = null;

let directoryOverlay: HTMLElement | null = null;
let appElement: HTMLElement | null = null;
let titleBarDirectory: HTMLElement | null = null;
let directoryPath: HTMLElement | null = null;
let toggleNoteListButton: HTMLButtonElement | null = null;
let toggleCommentsButton: HTMLButtonElement | null = null;
let isNoteListVisible = true;
let isCommentsVisible = true;

interface TextInputDialogOptions {
  title: string;
  description: string;
  confirmLabel: string;
  placeholder?: string;
  value?: string;
  allowEmpty?: boolean;
}

function isNotesListResult(result: NotesListResponse): result is NotesListResult {
  return !Array.isArray(result);
}

function extractNotes(result: NotesListResponse): Note[] {
  if (Array.isArray(result)) {
    return result;
  }

  return result.notes;
}

function extractDirectories(result: NotesListResponse): string[] {
  if (Array.isArray(result)) {
    return [];
  }

  return Array.isArray(result.directories) ? result.directories : [];
}

function joinDirectoryPath(baseDirectory: string, relativePath: string): string {
  const base = baseDirectory.trim().replace(/^\/+|\/+$/g, '');
  const child = relativePath.trim().replace(/^\/+|\/+$/g, '');

  if (!base) {
    return child;
  }

  if (!child) {
    return base;
  }

  return `${base}/${child}`;
}

function showTextInputDialog(options: TextInputDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'input-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'input-dialog';

    const title = document.createElement('h3');
    title.className = 'input-dialog-title';
    title.textContent = options.title;

    const description = document.createElement('p');
    description.className = 'input-dialog-description';
    description.textContent = options.description;

    const input = document.createElement('input');
    input.className = 'input-dialog-input';
    input.type = 'text';
    input.placeholder = options.placeholder ?? '';
    input.value = options.value ?? '';

    const error = document.createElement('p');
    error.className = 'input-dialog-error hidden';
    error.textContent = 'This field is required.';

    const buttons = document.createElement('div');
    buttons.className = 'input-dialog-buttons';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'input-dialog-btn input-dialog-btn-cancel';
    cancelButton.textContent = 'Cancel';

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'input-dialog-btn input-dialog-btn-confirm';
    confirmButton.textContent = options.confirmLabel;

    const cleanup = (result: string | null): void => {
      overlay.remove();
      resolve(result);
    };

    const submit = (): void => {
      const value = input.value.trim();
      if (!options.allowEmpty && !value) {
        error.classList.remove('hidden');
        input.focus();
        return;
      }

      cleanup(input.value);
    };

    cancelButton.addEventListener('click', () => cleanup(null));
    confirmButton.addEventListener('click', submit);

    input.addEventListener('input', () => {
      if (input.value.trim()) {
        error.classList.add('hidden');
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    buttons.append(cancelButton, confirmButton);
    dialog.append(title, description, input, error, buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    input.focus();
    input.select();
  });
}

function requireElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }

  return element as T;
}

function requireElementBySelector<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element ${selector}`);
  }

  return element as T;
}

function updatePanelToggleButtons(): void {
  if (toggleNoteListButton) {
    const notesLabel = isNoteListVisible ? 'Hide notes list' : 'Show notes list';
    toggleNoteListButton.classList.toggle('panel-toggle-btn-collapsed', !isNoteListVisible);
    toggleNoteListButton.title = notesLabel;
    toggleNoteListButton.setAttribute('aria-label', notesLabel);
    toggleNoteListButton.setAttribute('aria-expanded', String(isNoteListVisible));
  }

  if (toggleCommentsButton) {
    const commentsLabel = isCommentsVisible ? 'Hide comments panel' : 'Show comments panel';
    toggleCommentsButton.classList.toggle('panel-toggle-btn-collapsed', !isCommentsVisible);
    toggleCommentsButton.title = commentsLabel;
    toggleCommentsButton.setAttribute('aria-label', commentsLabel);
    toggleCommentsButton.setAttribute('aria-expanded', String(isCommentsVisible));
  }
}

function setNoteListVisible(visible: boolean): void {
  isNoteListVisible = visible;
  appElement?.classList.toggle('note-list-collapsed', !visible);
  updatePanelToggleButtons();
}

function setCommentsVisible(visible: boolean): void {
  isCommentsVisible = visible;
  appElement?.classList.toggle('comments-collapsed', !visible);
  updatePanelToggleButtons();
}

function initPanelToggles(): void {
  toggleNoteListButton = requireElementById<HTMLButtonElement>('toggleNoteListBtn');
  toggleCommentsButton = requireElementById<HTMLButtonElement>('toggleCommentsBtn');

  toggleNoteListButton.addEventListener('click', () => {
    setNoteListVisible(!isNoteListVisible);
  });

  toggleCommentsButton.addEventListener('click', () => {
    setCommentsVisible(!isCommentsVisible);
  });

  setNoteListVisible(true);
  setCommentsVisible(true);
}

function initTitleBar(): void {
  const titleBar = requireElementById<HTMLElement>('titleBar');
  const closeButton = requireElementById<HTMLElement>('btnClose');
  const minimizeButton = requireElementById<HTMLElement>('btnMinimize');
  const maximizeButton = requireElementById<HTMLElement>('btnMaximize');

  closeButton.addEventListener('click', () => {
    window.api.windowClose();
  });

  minimizeButton.addEventListener('click', () => {
    window.api.windowMinimize();
  });

  maximizeButton.addEventListener('click', () => {
    window.api.windowMaximize();
  });

  titleBar.addEventListener('dblclick', (event) => {
    const target = event.target;
    const isInteractiveControl =
      target instanceof Element &&
      (target.closest('.title-bar-controls') !== null ||
        target.closest('.title-bar-panel-controls') !== null ||
        target.closest('.change-directory-btn') !== null);

    if (!isInteractiveControl) {
      window.api.windowMaximize();
    }
  });

  window.addEventListener('focus', () => {
    titleBar.classList.remove('unfocused');
  });

  window.addEventListener('blur', () => {
    titleBar.classList.add('unfocused');
  });
}

function onSelectNote(note: Note): void {
  currentNoteId = note.id;
  noteView?.render(note);
  commentsPanel?.render(note.comments);
}

function onCommentCreate(anchor: CommentAnchor, selectedText: string): void {
  commentsPanel?.startNewComment(anchor, selectedText);
}

async function onCommentSubmit(content: string, anchor: CommentAnchor): Promise<void> {
  if (!currentNoteId) {
    console.error('No note selected');
    return;
  }

  try {
    const result = await addComment(currentNoteId, content, '', anchor);

    if (!result.success || !result.note) {
      console.error('Failed to add comment:', result.error);
      return;
    }

    clearCache();
    noteView?.render(result.note);
    commentsPanel?.render(result.note.comments);

    const notesResult = await listNotes();
    const notes = extractNotes(notesResult);
    const directories = extractDirectories(notesResult);
    noteList?.render(notes, directories);
    noteList?.selectNote(currentNoteId);
  } catch (error) {
    console.error('Error adding comment:', error);
  }
}

async function onCommentDelete(commentId: string): Promise<void> {
  if (!currentNoteId) {
    console.error('No note selected');
    return;
  }

  try {
    const result = await deleteComment(currentNoteId, commentId);

    if (!result.success || !result.note) {
      console.error('Failed to delete comment:', result.error);
      return;
    }

    clearCache();
    noteView?.render(result.note);
    commentsPanel?.render(result.note.comments);

    const notesResult = await listNotes();
    const notes = extractNotes(notesResult);
    const directories = extractDirectories(notesResult);
    noteList?.render(notes, directories);
    noteList?.selectNote(currentNoteId);
  } catch (error) {
    console.error('Error deleting comment:', error);
  }
}

async function onNoteSave(noteId: string, content: string): Promise<Note | null> {
  try {
    const result = await updateNote(noteId, content);

    if (!result.success || !result.note) {
      console.error('Failed to update note:', result.error);
      return null;
    }

    const isStillCurrentNote = currentNoteId === noteId;
    clearCache();
    if (isStillCurrentNote) {
      currentNoteId = result.note.id;
      commentsPanel?.render(result.note.comments);
    }

    const notesResult = await listNotes();
    const notes = extractNotes(notesResult);
    const directories = extractDirectories(notesResult);
    noteList?.render(notes, directories);

    return result.note;
  } catch (error) {
    console.error('Error updating note:', error);
    return null;
  }
}

async function onNoteMetadataSave(noteId: string, title: string, tags: string[]): Promise<Note | null> {
  try {
    const result = await updateNoteMetadata(noteId, title, tags);

    if (!result.success || !result.note) {
      console.error('Failed to update note metadata:', result.error);
      return null;
    }

    const isStillCurrentNote = currentNoteId === noteId;
    clearCache();
    if (isStillCurrentNote) {
      currentNoteId = result.note.id;
      commentsPanel?.render(result.note.comments);
    }

    const notesResult = await listNotes();
    const notes = extractNotes(notesResult);
    const directories = extractDirectories(notesResult);
    noteList?.render(notes, directories);

    return result.note;
  } catch (error) {
    console.error('Error updating note metadata:', error);
    return null;
  }
}

async function onCreateNote(targetDirectory: string): Promise<void> {
  const rawTitle = await showTextInputDialog({
    title: 'Create Note',
    description: targetDirectory
      ? `Enter a title for a new note in "${targetDirectory}".`
      : 'Enter a title for a new root note.',
    confirmLabel: 'Create',
    placeholder: 'Note title',
  });

  if (rawTitle === null) {
    return;
  }

  const title = rawTitle.trim();
  if (!title) {
    window.alert('Title cannot be empty.');
    return;
  }

  try {
    const result = await createNote(title, targetDirectory);

    if (!result.success || !result.note) {
      window.alert(result.error ?? 'Failed to create note.');
      return;
    }

    await loadNotes(result.note.id);
  } catch (error) {
    console.error('Error creating note:', error);
    window.alert('Failed to create note.');
  }
}

async function onCreateDirectory(targetDirectory: string): Promise<void> {
  const rawPath = await showTextInputDialog({
    title: 'Create Directory',
    description: targetDirectory
      ? `Create a folder inside "${targetDirectory}".`
      : 'Create a root folder.',
    confirmLabel: 'Create',
    placeholder: 'Folder name',
  });

  if (rawPath === null) {
    return;
  }

  const directoryPathInput = rawPath.trim();
  if (!directoryPathInput) {
    window.alert('Directory path cannot be empty.');
    return;
  }

  const fullPath = joinDirectoryPath(targetDirectory, directoryPathInput);

  try {
    const result = await createDirectory(fullPath);

    if (!result.success) {
      window.alert(result.error ?? 'Failed to create directory.');
      return;
    }

    await loadNotes(currentNoteId);
  } catch (error) {
    console.error('Error creating directory:', error);
    window.alert('Failed to create directory.');
  }
}

async function onDeleteDirectory(targetDirectory: string): Promise<void> {
  if (!targetDirectory) {
    return;
  }

  const shouldDelete = window.confirm(
    `Delete folder "${targetDirectory}"? All notes inside this folder and its subfolders will be deleted. This cannot be undone.`,
  );
  if (!shouldDelete) {
    return;
  }

  try {
    const result = await deleteDirectory(targetDirectory);

    if (!result.success) {
      window.alert(result.error ?? 'Failed to delete directory.');
      return;
    }

    await loadNotes(currentNoteId);
  } catch (error) {
    console.error('Error deleting directory:', error);
    window.alert('Failed to delete directory.');
  }
}

async function onMoveNote(note: Note, targetDirectory: string): Promise<void> {
  if (targetDirectory === note.directory) {
    return;
  }

  try {
    const result = await moveNote(note.id, targetDirectory);

    if (!result.success || !result.note) {
      window.alert(result.error ?? 'Failed to move note.');
      return;
    }

    await loadNotes(result.note.id);
  } catch (error) {
    console.error('Error moving note:', error);
    window.alert('Failed to move note.');
  }
}

async function onDeleteNote(note: Note): Promise<void> {
  const shouldDelete = window.confirm(`Delete note "${note.title}"? This cannot be undone.`);
  if (!shouldDelete) {
    return;
  }

  try {
    const result = await deleteNote(note.id);

    if (!result.success) {
      window.alert(result.error ?? 'Failed to delete note.');
      return;
    }

    if (currentNoteId === note.id) {
      currentNoteId = null;
    }

    await loadNotes(currentNoteId);
  } catch (error) {
    console.error('Error deleting note:', error);
    window.alert('Failed to delete note.');
  }
}

function updateDirectoryIndicator(path: string | null): void {
  if (!titleBarDirectory || !directoryPath) {
    return;
  }

  if (!path) {
    titleBarDirectory.classList.add('hidden');
    return;
  }

  const parts = path.split('/');
  const folderName = parts[parts.length - 1] || path;

  directoryPath.textContent = folderName;
  directoryPath.title = path;
  titleBarDirectory.classList.remove('hidden');
}

async function handleSelectDirectory(): Promise<void> {
  const selectedPath = await selectDirectory();

  if (!selectedPath || !directoryOverlay || !appElement) {
    return;
  }

  directoryOverlay.classList.add('hidden');
  appElement.classList.remove('hidden');

  updateDirectoryIndicator(selectedPath);
  clearCache();
  await loadNotes();
}

async function loadNotes(preferredNoteId: string | null = currentNoteId): Promise<void> {
  const noteListContainer = requireElementById<HTMLElement>('noteList');

  try {
    const result = await listNotes();
    const notes = extractNotes(result);
    const directories = extractDirectories(result);

    if (isNotesListResult(result) && result.noDirectory) {
      noteListContainer.innerHTML = '<p class="empty-state">No directory configured</p>';
      currentNoteId = null;
      noteView?.clear();
      commentsPanel?.clear();
      return;
    }

    noteList?.render(notes, directories);

    if (notes.length > 0) {
      const fallbackNoteId = notes[0]?.id ?? null;
      const nextSelectedId = preferredNoteId && notes.some((note) => note.id === preferredNoteId)
        ? preferredNoteId
        : fallbackNoteId;

      if (nextSelectedId) {
        noteList?.selectNote(nextSelectedId);
      }
    } else {
      currentNoteId = null;
      noteView?.clear();
      commentsPanel?.clear();
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    noteListContainer.innerHTML = '<p class="empty-state">Error loading notes</p>';
  }
}

async function init(): Promise<void> {
  initTitleBar();

  directoryOverlay = requireElementById<HTMLElement>('directoryOverlay');
  appElement = requireElementBySelector<HTMLElement>('.app');
  initPanelToggles();
  titleBarDirectory = requireElementById<HTMLElement>('titleBarDirectory');
  directoryPath = requireElementById<HTMLElement>('directoryPath');

  const selectDirectoryButton = requireElementById<HTMLElement>('selectDirectoryBtn');
  const changeDirectoryButton = requireElementById<HTMLElement>('changeDirectoryBtn');

  selectDirectoryButton.addEventListener('click', () => {
    void handleSelectDirectory();
  });

  changeDirectoryButton.addEventListener('click', () => {
    void handleSelectDirectory();
  });

  const noteListContainer = requireElementById<HTMLElement>('noteList');
  const noteHeaderContainer = requireElementById<HTMLElement>('noteHeader');
  const noteContentContainer = requireElementById<HTMLElement>('noteContent');
  const commentsListContainer = requireElementById<HTMLElement>('commentsList');

  noteList = new NoteList(noteListContainer, {
    onSelectNote,
    onMoveNote,
    onCreateNote,
    onCreateDirectory,
    onDeleteDirectory,
  });
  noteView = new NoteView(noteHeaderContainer, noteContentContainer);
  commentsPanel = new CommentsPanel(commentsListContainer);

  noteView.setOnCommentCreate(onCommentCreate);
  noteView.setOnNoteSave(onNoteSave);
  noteView.setOnNoteMetadataSave(onNoteMetadataSave);
  noteView.setOnNoteDelete(onDeleteNote);
  commentsPanel.setOnCommentSubmit(onCommentSubmit);
  commentsPanel.setOnCommentDelete(onCommentDelete);

  try {
    const currentDirectory = await getDirectory();

    if (!currentDirectory) {
      directoryOverlay.classList.remove('hidden');
      appElement.classList.add('hidden');
      return;
    }

    directoryOverlay.classList.add('hidden');
    appElement.classList.remove('hidden');
    updateDirectoryIndicator(currentDirectory);
    await loadNotes();
  } catch (error) {
    console.error('Error checking directory:', error);
    directoryOverlay.classList.remove('hidden');
    appElement.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
