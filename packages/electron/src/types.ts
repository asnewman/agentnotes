/**
 * Types for the Electron app.
 * These are defined locally to avoid bundling the engine in the renderer.
 */

export type CommentAffinity = 'before' | 'after';
export type CommentStatus = 'attached' | 'stale' | 'detached';

export interface CommentAnchor {
  from: number;
  to: number;
  rev: number;
  startAffinity?: CommentAffinity;
  endAffinity?: CommentAffinity;
  quote?: string;
  quoteHash?: string;
}

export interface NoteComment {
  id: string;
  content: string;
  author: string;
  created: string;
  anchor: CommentAnchor;
  status: CommentStatus;
}

export interface Note {
  id: string;
  title: string;
  tags: string[];
  commentRev: number;
  comments: NoteComment[];
  content: string;
  filename: string;
  relativePath: string;
  directory: string;
}

export interface NotesListResult {
  notes: Note[];
  directories: string[];
  noDirectory?: boolean;
}

export interface OperationResult {
  success: boolean;
  error?: string;
}

export interface CommentMutationResult extends OperationResult {
  note?: Note;
}

export interface DirectoryMutationResult extends OperationResult {
  directories?: string[];
}

export type NotesListResponse = Note[] | NotesListResult;

export interface PreloadApi {
  listNotes: () => Promise<NotesListResult>;
  getNote: (noteId: string) => Promise<Note | null>;
  createNote: (title: string, directory: string) => Promise<CommentMutationResult>;
  deleteNote: (noteId: string) => Promise<OperationResult>;
  moveNote: (noteId: string, directory: string) => Promise<CommentMutationResult>;
  createDirectory: (path: string) => Promise<DirectoryMutationResult>;
  deleteDirectory: (path: string) => Promise<DirectoryMutationResult>;
  updateNote: (noteId: string, content: string) => Promise<CommentMutationResult>;
  updateNoteMetadata: (
    noteId: string,
    tags: string[],
  ) => Promise<CommentMutationResult>;
  addComment: (
    noteId: string,
    content: string,
    author: string,
    anchor: CommentAnchor,
  ) => Promise<CommentMutationResult>;
  deleteComment: (noteId: string, commentId: string) => Promise<CommentMutationResult>;
  getDirectory: () => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}
