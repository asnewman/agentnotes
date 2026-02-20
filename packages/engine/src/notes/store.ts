import fs from 'node:fs';
import path from 'node:path';
import { ulid } from 'ulid';
import type {
  AddCommentPayload,
  CommentAnchor,
  CommentMutationResult,
  CreateDirectoryPayload,
  CreateNotePayload,
  DeleteCommentPayload,
  DeleteDirectoryPayload,
  DeleteNotePayload,
  DirectoryMutationResult,
  MoveNotePayload,
  Note,
  NotesListResult,
  OperationResult,
  UpdateNoteMetadataPayload,
  UpdateNotePayload,
} from '../types.js';
import { slugify } from '../utils/slugify.js';
import { normalizeTags, normalizeContent } from '../utils/normalization.js';
import { normalizeAffinity } from '../utils/normalization.js';
import { buildAnchorFromRange } from '../comments/anchoring.js';
import { remapCommentsForEdit } from '../comments/transformation.js';
import {
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
} from '../storage/filesystem.js';
import {
  getNoteSidecarPath,
  writeSidecarData,
} from '../storage/sidecar.js';

export interface NoteStoreOptions {
  notesDirectory: string;
}

export class NoteStore {
  private notesDir: string;

  constructor(options: NoteStoreOptions) {
    this.notesDir = options.notesDirectory;
  }

  getNotesDirectory(): string {
    return this.notesDir;
  }

  async listNotes(): Promise<NotesListResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { notes: [], directories: [], noDirectory: false };
    }

    try {
      const files = getAllMarkdownFiles(this.notesDir);
      const directories = Array.from(new Set(getAllDirectories(this.notesDir))).sort((a, b) =>
        a.localeCompare(b),
      );

      const notes = files
        .map(({ fullPath, relativePath }) => parseNoteFile(fullPath, relativePath))
        .filter((note): note is Note => note !== null)
        .sort(compareNotes);

      return { notes, directories, noDirectory: false };
    } catch (error) {
      console.error('Error listing notes:', error);
      return { notes: [], directories: [], noDirectory: false };
    }
  }

  async getNote(noteId: string): Promise<Note | null> {
    if (!fs.existsSync(this.notesDir)) {
      return null;
    }

    try {
      const record = findNoteRecordById(this.notesDir, noteId);
      if (!record) {
        return null;
      }

      return parseNoteFile(record.fullPath, record.relativePath);
    } catch (error) {
      console.error('Error getting note:', error);
      return null;
    }
  }

  async createNote(payload: CreateNotePayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    const title = payload.title.trim();
    if (!title) {
      return { success: false, error: 'Title cannot be empty' };
    }

    const normalizedDirectory = normalizeDirectoryInput(payload.directory);
    if (normalizedDirectory === null) {
      return { success: false, error: 'Invalid directory path' };
    }

    const targetDirectory = resolveNotesPath(this.notesDir, normalizedDirectory);
    if (!targetDirectory) {
      return { success: false, error: 'Directory path escapes notes root' };
    }

    try {
      fs.mkdirSync(targetDirectory, { recursive: true });

      const nowIso = new Date().toISOString();
      const datePrefix = nowIso.slice(0, 10);
      const titleSlug = slugify(title) || 'note';
      const filePath = generateUniqueFilePath(targetDirectory, `${datePrefix}-${titleSlug}`);
      const noteContent = `# ${title}\n\n`;
      fs.writeFileSync(filePath, noteContent, 'utf-8');
      writeSidecarData(filePath, [], [], 0);

      const relativePath = this.getRelativePath(filePath);
      return {
        success: true,
        note: parseNoteFile(filePath, relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error creating note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateNote(payload: UpdateNotePayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      const currentNote = parseNoteFile(record.fullPath, record.relativePath);
      if (!currentNote) {
        return { success: false, error: 'Failed to parse current note' };
      }

      const updatedContent = normalizeContent(payload.content);
      let nextComments = currentNote.comments;
      let nextRev = currentNote.commentRev;

      if (updatedContent !== currentNote.content) {
        const remap = remapCommentsForEdit(
          currentNote.comments,
          currentNote.content,
          updatedContent,
          currentNote.commentRev,
        );
        nextComments = remap.comments;
        nextRev = remap.nextRev;
      }

      fs.writeFileSync(record.fullPath, updatedContent, 'utf-8');
      writeSidecarData(record.fullPath, currentNote.tags, nextComments, nextRev);

      return {
        success: true,
        note: parseNoteFile(record.fullPath, record.relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error updating note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateNoteMetadata(payload: UpdateNoteMetadataPayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    const normalizedTags = normalizeTags(payload.tags);

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      const currentNote = parseNoteFile(record.fullPath, record.relativePath);
      if (!currentNote) {
        return { success: false, error: 'Failed to parse current note' };
      }

      writeSidecarData(
        record.fullPath,
        normalizedTags,
        currentNote.comments,
        currentNote.commentRev,
      );

      return {
        success: true,
        note: parseNoteFile(record.fullPath, record.relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error updating note metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteNote(payload: DeleteNotePayload): Promise<OperationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      fs.unlinkSync(record.fullPath);
      const sidecarPath = getNoteSidecarPath(record.fullPath);
      if (fs.existsSync(sidecarPath)) {
        fs.unlinkSync(sidecarPath);
      }

      const parentDir = path.dirname(record.fullPath);
      if (path.resolve(parentDir) !== path.resolve(this.notesDir)) {
        cleanupEmptyParentDirectories(parentDir, this.notesDir);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async moveNote(payload: MoveNotePayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    const normalizedDirectory = normalizeDirectoryInput(payload.directory);
    if (normalizedDirectory === null) {
      return { success: false, error: 'Invalid target directory' };
    }

    const targetDirectory = resolveNotesPath(this.notesDir, normalizedDirectory);
    if (!targetDirectory) {
      return { success: false, error: 'Target directory escapes notes root' };
    }

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      fs.mkdirSync(targetDirectory, { recursive: true });

      const currentPath = path.resolve(record.fullPath);
      const currentDirectory = path.dirname(currentPath);

      let destinationPath = path.join(targetDirectory, path.basename(record.fullPath));
      if (
        path.resolve(destinationPath) !== currentPath &&
        (fs.existsSync(destinationPath) ||
          fs.existsSync(getNoteSidecarPath(destinationPath)))
      ) {
        destinationPath = generateUniqueFilePath(
          targetDirectory,
          path.basename(record.fullPath, '.md'),
        );
      }

      if (path.resolve(destinationPath) !== currentPath) {
        const sourceSidecarPath = getNoteSidecarPath(record.fullPath);
        const destinationSidecarPath = getNoteSidecarPath(destinationPath);
        fs.renameSync(record.fullPath, destinationPath);
        if (fs.existsSync(sourceSidecarPath)) {
          fs.renameSync(sourceSidecarPath, destinationSidecarPath);
        }
        if (path.resolve(currentDirectory) !== path.resolve(this.notesDir)) {
          cleanupEmptyParentDirectories(currentDirectory, this.notesDir);
        }
      }

      const relativePath = this.getRelativePath(destinationPath);
      return {
        success: true,
        note: parseNoteFile(destinationPath, relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error moving note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async addComment(payload: AddCommentPayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      const currentNote = parseNoteFile(record.fullPath, record.relativePath);
      if (!currentNote) {
        return { success: false, error: 'Failed to parse current note' };
      }

      if (payload.anchor.rev !== currentNote.commentRev) {
        return {
          success: false,
          error: `Anchor revision mismatch. Expected rev ${currentNote.commentRev}, received rev ${payload.anchor.rev}`,
        };
      }

      const targetRev = currentNote.commentRev > 0 ? currentNote.commentRev : 1;
      let anchor: CommentAnchor;

      try {
        anchor = buildAnchorFromRange(
          currentNote.content,
          payload.anchor.from,
          payload.anchor.to,
          targetRev,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid comment range',
        };
      }

      anchor.startAffinity = normalizeAffinity(payload.anchor.startAffinity, 'after');
      anchor.endAffinity = normalizeAffinity(payload.anchor.endAffinity, 'before');

      const newComment = {
        id: ulid(),
        author: payload.author,
        created: new Date().toISOString(),
        content: payload.content,
        status: 'attached' as const,
        anchor,
      };

      const comments = [...currentNote.comments, newComment];
      writeSidecarData(record.fullPath, currentNote.tags, comments, targetRev);

      return {
        success: true,
        note: parseNoteFile(record.fullPath, record.relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteComment(payload: DeleteCommentPayload): Promise<CommentMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    if (!payload.commentId) {
      return { success: false, error: 'Comment ID is required' };
    }

    try {
      const record = findNoteRecordById(this.notesDir, payload.noteId);
      if (!record) {
        return { success: false, error: 'Note not found' };
      }

      const currentNote = parseNoteFile(record.fullPath, record.relativePath);
      if (!currentNote) {
        return { success: false, error: 'Failed to parse current note' };
      }

      const nextComments = currentNote.comments.filter(
        (comment) => comment.id !== payload.commentId,
      );

      if (nextComments.length === currentNote.comments.length) {
        return { success: false, error: 'Comment not found' };
      }

      writeSidecarData(record.fullPath, currentNote.tags, nextComments, currentNote.commentRev);

      return {
        success: true,
        note: parseNoteFile(record.fullPath, record.relativePath) ?? undefined,
      };
    } catch (error) {
      console.error('Error deleting comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createDirectory(payload: CreateDirectoryPayload): Promise<DirectoryMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    const normalizedPath = normalizeDirectoryInput(payload.path);
    if (normalizedPath === null || !normalizedPath) {
      return { success: false, error: 'Invalid directory path' };
    }

    const targetPath = resolveNotesPath(this.notesDir, normalizedPath);
    if (!targetPath) {
      return { success: false, error: 'Directory path escapes notes root' };
    }

    try {
      fs.mkdirSync(targetPath, { recursive: true });
      return { success: true, path: normalizedPath };
    } catch (error) {
      console.error('Error creating directory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteDirectory(payload: DeleteDirectoryPayload): Promise<DirectoryMutationResult> {
    if (!fs.existsSync(this.notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    const normalizedPath = normalizeDirectoryInput(payload.path);
    if (normalizedPath === null || !normalizedPath) {
      return { success: false, error: 'Invalid directory path' };
    }

    const targetPath = resolveNotesPath(this.notesDir, normalizedPath);
    if (!targetPath || path.resolve(targetPath) === path.resolve(this.notesDir)) {
      return { success: false, error: 'Directory path escapes notes root' };
    }

    if (!fs.existsSync(targetPath)) {
      return { success: false, error: 'Directory not found' };
    }

    try {
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Target path is not a directory' };
      }

      fs.rmSync(targetPath, { recursive: true, force: false });

      const parentDir = path.dirname(targetPath);
      if (path.resolve(parentDir) !== path.resolve(this.notesDir)) {
        cleanupEmptyParentDirectories(parentDir, this.notesDir);
      }

      return { success: true, path: normalizedPath };
    } catch (error) {
      console.error('Error deleting directory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getRelativePath(fullPath: string): string {
    return formatRelativePath(path.relative(this.notesDir, fullPath));
  }
}
