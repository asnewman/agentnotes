// Core store
export { NoteStore } from './notes/store.js';
export type { NoteStoreOptions } from './notes/store.js';

// Search & filtering
export { search, getAllTags, getSortedTags } from './notes/search.js';

// Comment system
export {
  hashQuote,
  buildAnchorFromRange,
  getUniqueMatchRange,
  deriveTextEditOps,
  remapCommentsForEdit,
  normalizeComment,
  transformOffset,
  resolveCommentRange,
  getAllHighlightRanges,
} from './comments/index.js';
export type { TextEditOp, CharRange } from './comments/index.js';

// Storage
export {
  parseNoteFile,
  extractNoteTitle,
  getNoteSidecarPath,
  parseComments,
  toCommentRecord,
  getAllMarkdownFiles,
  getAllDirectories,
  normalizeDirectoryInput,
  resolveNotesPath,
  compareNotes,
} from './storage/index.js';
export type { MarkdownFileRecord } from './storage/index.js';

// Utilities
export {
  slugify,
  normalizeTags,
  normalizeContent,
  toTitleCase,
  isRecord,
  toStringValue,
  toNumberValue,
  toIsoDate,
  toStringArray,
} from './utils/index.js';

// Types
export type {
  CommentAffinity,
  CommentStatus,
  CommentAnchor,
  NoteComment,
  Note,
  NotesListResult,
  CommentMutationResult,
  OperationResult,
  DirectoryMutationResult,
  AddCommentPayload,
  DeleteCommentPayload,
  UpdateNotePayload,
  UpdateNoteMetadataPayload,
  CreateNotePayload,
  DeleteNotePayload,
  MoveNotePayload,
  CreateDirectoryPayload,
  DeleteDirectoryPayload,
  SortField,
  SearchOptions,
  TagCount,
} from './types.js';
