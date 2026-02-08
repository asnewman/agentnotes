export interface NoteComment {
  id: string;
  author: string;
  line: number;
  startChar: number;
  endChar: number;
  created: string;
  content: string;
}

export interface Note {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
  source: string;
  priority: number;
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
  startChar: number;
  endChar: number;
}

export interface DeleteCommentPayload {
  noteId: string;
  commentId: string;
}

export interface PreloadApi {
  listNotes: () => Promise<NotesListResult>;
  getNote: (noteId: string) => Promise<Note | null>;
  addComment: (
    noteId: string,
    content: string,
    author: string,
    startChar: number,
    endChar: number,
  ) => Promise<CommentMutationResult>;
  deleteComment: (noteId: string, commentId: string) => Promise<CommentMutationResult>;
  getDirectory: () => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}
