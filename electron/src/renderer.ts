import { CommentsPanel } from './components/CommentsPanel';
import { NoteList } from './components/NoteList';
import { NoteView } from './components/NoteView';
import {
  addComment,
  clearCache,
  deleteComment,
  getDirectory,
  listNotes,
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

function isNotesListResult(result: NotesListResponse): result is NotesListResult {
  return !Array.isArray(result);
}

function extractNotes(result: NotesListResponse): Note[] {
  if (Array.isArray(result)) {
    return result;
  }

  return result.notes;
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
    if (
      target === titleBar ||
      (target instanceof Element && target.classList.contains('title-bar-title'))
    ) {
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

    const notes = extractNotes(await listNotes());
    noteList?.render(notes);
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

    const notes = extractNotes(await listNotes());
    noteList?.render(notes);
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

    const notes = extractNotes(await listNotes());
    noteList?.render(notes);

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

    const notes = extractNotes(await listNotes());
    noteList?.render(notes);

    return result.note;
  } catch (error) {
    console.error('Error updating note metadata:', error);
    return null;
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

async function loadNotes(): Promise<void> {
  const noteListContainer = requireElementById<HTMLElement>('noteList');

  try {
    const result = await listNotes();
    const notes = extractNotes(result);

    if (isNotesListResult(result) && result.noDirectory) {
      noteListContainer.innerHTML = '<p class="empty-state">No directory configured</p>';
      noteView?.clear();
      commentsPanel?.clear();
      return;
    }

    noteList?.render(notes);

    if (notes.length > 0) {
      const firstNote = notes[0];
      noteList?.selectNote(firstNote.id);
    } else {
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

  noteList = new NoteList(noteListContainer, onSelectNote);
  noteView = new NoteView(noteHeaderContainer, noteContentContainer);
  commentsPanel = new CommentsPanel(commentsListContainer);

  noteView.setOnCommentCreate(onCommentCreate);
  noteView.setOnNoteSave(onNoteSave);
  noteView.setOnNoteMetadataSave(onNoteMetadataSave);
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
