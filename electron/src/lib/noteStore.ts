import type {
  CommentAnchor,
  CommentMutationResult,
  DirectoryMutationResult,
  Note,
  NotesListResponse,
  NotesListResult,
  OperationResult,
} from '../types';

let notesCache: NotesListResult | null = null;

export async function getDirectory(): Promise<string | null> {
  return window.api.getDirectory();
}

export async function selectDirectory(): Promise<string | null> {
  const selectedPath = await window.api.selectDirectory();

  if (selectedPath) {
    clearCache();
  }

  return selectedPath;
}

export async function listNotes(): Promise<NotesListResponse> {
  if (notesCache) {
    return notesCache;
  }

  notesCache = await window.api.listNotes();
  return notesCache;
}

export async function getNote(noteId: string): Promise<Note | null> {
  return window.api.getNote(noteId);
}

export async function createNote(
  title: string,
  directory: string,
): Promise<CommentMutationResult> {
  const result = await window.api.createNote(title, directory);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function deleteNote(noteId: string): Promise<OperationResult> {
  const result = await window.api.deleteNote(noteId);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function moveNote(
  noteId: string,
  directory: string,
): Promise<CommentMutationResult> {
  const result = await window.api.moveNote(noteId, directory);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function createDirectory(path: string): Promise<DirectoryMutationResult> {
  const result = await window.api.createDirectory(path);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function deleteDirectory(path: string): Promise<DirectoryMutationResult> {
  const result = await window.api.deleteDirectory(path);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function updateNote(noteId: string, content: string): Promise<CommentMutationResult> {
  const result = await window.api.updateNote(noteId, content);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function updateNoteMetadata(
  noteId: string,
  title: string,
  tags: string[],
): Promise<CommentMutationResult> {
  const result = await window.api.updateNoteMetadata(noteId, title, tags);

  if (result.success) {
    clearCache();
  }

  return result;
}

export function clearCache(): void {
  notesCache = null;
}

export async function addComment(
  noteId: string,
  content: string,
  author: string,
  anchor: CommentAnchor,
): Promise<CommentMutationResult> {
  const result = await window.api.addComment(noteId, content, author, anchor);

  if (result.success) {
    clearCache();
  }

  return result;
}

export async function deleteComment(
  noteId: string,
  commentId: string,
): Promise<CommentMutationResult> {
  const result = await window.api.deleteComment(noteId, commentId);

  if (result.success) {
    clearCache();
  }

  return result;
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
