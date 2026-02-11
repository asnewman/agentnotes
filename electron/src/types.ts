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
  author: string;
  created: string;
  content: string;
  status: CommentStatus;
  anchor: CommentAnchor;
}

export interface Note {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
  source: string;
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
  noDirectory: boolean;
}

export type NotesListResponse = Note[] | NotesListResult;

export interface CommentMutationResult {
  success: boolean;
  note?: Note;
  error?: string;
}

export interface OperationResult {
  success: boolean;
  error?: string;
}

export interface DirectoryMutationResult extends OperationResult {
  path?: string;
}

export interface AddCommentPayload {
  noteId: string;
  content: string;
  author: string;
  anchor: CommentAnchor;
}

export interface DeleteCommentPayload {
  noteId: string;
  commentId: string;
}

export interface UpdateNotePayload {
  noteId: string;
  content: string;
}

export interface UpdateNoteMetadataPayload {
  noteId: string;
  title: string;
  tags: string[];
}

export interface CreateNotePayload {
  title: string;
  directory: string;
}

export interface DeleteNotePayload {
  noteId: string;
}

export interface MoveNotePayload {
  noteId: string;
  directory: string;
}

export interface CreateDirectoryPayload {
  path: string;
}

export interface PreloadApi {
  listNotes: () => Promise<NotesListResult>;
  getNote: (noteId: string) => Promise<Note | null>;
  createNote: (title: string, directory: string) => Promise<CommentMutationResult>;
  deleteNote: (noteId: string) => Promise<OperationResult>;
  moveNote: (noteId: string, directory: string) => Promise<CommentMutationResult>;
  createDirectory: (path: string) => Promise<DirectoryMutationResult>;
  updateNote: (noteId: string, content: string) => Promise<CommentMutationResult>;
  updateNoteMetadata: (
    noteId: string,
    title: string,
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
