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

export interface DeleteDirectoryPayload {
  path: string;
}

export type SortField = 'created' | 'updated' | 'title';

export interface SearchOptions {
  query?: string;
  tags?: string[];
  limit?: number;
  sortBy?: SortField;
  reverse?: boolean;
}

export interface TagCount {
  tag: string;
  count: number;
}
