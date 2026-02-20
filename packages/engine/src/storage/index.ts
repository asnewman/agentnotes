export {
  parseMarkdownContent,
  extractNoteTitle,
} from './markdown.js';
export type { LegacyFrontmatterData, ParsedMarkdownNote } from './markdown.js';

export {
  getNoteSidecarPath,
  readSidecarData,
  writeSidecarData,
  parseComments,
  toCommentRecord,
} from './sidecar.js';
export type { NoteSidecarData } from './sidecar.js';

export {
  formatRelativePath,
  normalizeDirectoryInput,
  resolveNotesPath,
  getAllMarkdownFiles,
  getAllDirectories,
  generateUniqueFilePath,
  cleanupEmptyParentDirectories,
  findNoteRecordById,
  compareNotes,
  parseNoteFile,
} from './filesystem.js';
export type { MarkdownFileRecord } from './filesystem.js';
