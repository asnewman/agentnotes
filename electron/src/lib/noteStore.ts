import type {
  CommentMutationResult,
  Note,
  NotesListResponse,
  NotesListResult,
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

export function clearCache(): void {
  notesCache = null;
}

export async function addComment(
  noteId: string,
  content: string,
  author: string,
  startChar: number,
  endChar: number,
): Promise<CommentMutationResult> {
  const result = await window.api.addComment(noteId, content, author, startChar, endChar);

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
