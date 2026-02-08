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
  priority: number;
  commentRev: number;
  comments: NoteComment[];
  content: string;
  filename: string;
  relativePath: string;
  directory: string;
}

export interface NotesListResult {
  notes: Note[];
  noDirectory: boolean;
}

export type NotesListResponse = Note[] | NotesListResult;

export interface CommentMutationResult {
  success: boolean;
  note?: Note;
  error?: string;
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

export interface PreloadApi {
  listNotes: () => Promise<NotesListResult>;
  getNote: (noteId: string) => Promise<Note | null>;
  updateNote: (noteId: string, content: string) => Promise<CommentMutationResult>;
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
