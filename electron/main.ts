import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import Store from 'electron-store';
import { ulid } from 'ulid';
import { buildAnchorFromRange, remapCommentsForEdit } from './src/lib/highlighter';
import type {
  AddCommentPayload,
  CommentAffinity,
  CommentAnchor,
  CommentMutationResult,
  CommentStatus,
  DeleteCommentPayload,
  Note,
  NoteComment,
  NotesListResult,
  UpdateNotePayload,
} from './src/types';

interface StoreSchema {
  notesDirectory: string | null;
}

interface MarkdownFileRecord {
  fullPath: string;
  relativePath: string;
}

interface FrontmatterData extends Record<string, unknown> {
  id?: unknown;
  title?: unknown;
  tags?: unknown;
  created?: unknown;
  updated?: unknown;
  source?: unknown;
  priority?: unknown;
  comment_rev?: unknown;
  comments?: unknown;
}

const store = new Store<StoreSchema>({
  defaults: {
    notesDirectory: null,
  },
});

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    transparent: true,
    vibrancy: 'sidebar',
    backgroundColor: '#00000000',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function toIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function normalizeStatus(value: unknown, hasRange: boolean): CommentStatus {
  if (value === 'attached' || value === 'stale' || value === 'detached') {
    return value;
  }

  return hasRange ? 'attached' : 'detached';
}

function normalizeAffinity(value: unknown, fallback: CommentAffinity): CommentAffinity {
  if (value === 'before' || value === 'after') {
    return value;
  }
  return fallback;
}

function getUniqueMatchRange(content: string, exact: string): { from: number; to: number } | null {
  if (!exact) {
    return null;
  }

  const first = content.indexOf(exact);
  if (first < 0) {
    return null;
  }

  const second = content.indexOf(exact, first + exact.length);
  if (second >= 0) {
    return null;
  }

  return { from: first, to: first + exact.length };
}

function parseCommentAnchor(
  source: unknown,
  noteContent: string,
  fallbackRev: number,
): CommentAnchor {
  if (!isRecord(source)) {
    return {
      from: 0,
      to: 0,
      rev: fallbackRev,
      startAffinity: 'after',
      endAffinity: 'before',
    };
  }

  const fromValue = toOptionalNonNegativeInt(source.from);
  const toValue = toOptionalNonNegativeInt(source.to);
  const legacyStart = toOptionalNonNegativeInt(source.start);
  const legacyEnd = toOptionalNonNegativeInt(source.end);
  const exact = toStringValue(source.exact);

  let from = 0;
  let to = 0;

  if (fromValue !== undefined && toValue !== undefined && toValue >= fromValue) {
    from = fromValue;
    to = toValue;
  } else if (legacyStart !== undefined && legacyEnd !== undefined && legacyEnd >= legacyStart) {
    from = legacyStart;
    to = legacyEnd;
  } else {
    const uniqueMatch = getUniqueMatchRange(noteContent, exact);
    if (uniqueMatch) {
      from = uniqueMatch.from;
      to = uniqueMatch.to;
    }
  }

  from = Math.max(0, Math.min(from, noteContent.length));
  to = Math.max(0, Math.min(to, noteContent.length));

  const revValue = toOptionalNonNegativeInt(source.rev);
  const quote = toStringValue(source.quote, exact);
  const quoteHash = toStringValue(source.quote_hash || source.quoteHash);

  return {
    from,
    to,
    rev: revValue !== undefined ? revValue : fallbackRev,
    startAffinity: normalizeAffinity(source.start_affinity || source.startAffinity, 'after'),
    endAffinity: normalizeAffinity(source.end_affinity || source.endAffinity, 'before'),
    ...(quote ? { quote } : {}),
    ...(quoteHash ? { quoteHash } : {}),
  };
}

function parseCommentEntry(
  source: unknown,
  fallbackIso: string,
  noteContent: string,
  fallbackRev: number,
): NoteComment {
  if (!isRecord(source)) {
    return {
      id: '',
      author: '',
      created: fallbackIso,
      content: '',
      status: 'detached',
      anchor: {
        from: 0,
        to: 0,
        rev: fallbackRev,
        startAffinity: 'after',
        endAffinity: 'before',
      },
    };
  }

  const anchor = parseCommentAnchor(source.anchor, noteContent, fallbackRev);
  const hasRange = anchor.to > anchor.from;

  return {
    id: toStringValue(source.id),
    author: toStringValue(source.author),
    created: toIsoDate(source.created, fallbackIso),
    content: toStringValue(source.content),
    status: normalizeStatus(source.status, hasRange),
    anchor,
  };
}

function parseComments(source: unknown, noteContent: string, commentRev: number): NoteComment[] {
  if (!Array.isArray(source)) {
    return [];
  }

  const fallbackIso = new Date().toISOString();
  return source.map((entry) => parseCommentEntry(entry, fallbackIso, noteContent, commentRev));
}

function toAnchorRecord(anchor: CommentAnchor): Record<string, unknown> {
  return {
    from: anchor.from,
    to: anchor.to,
    rev: anchor.rev,
    start_affinity: anchor.startAffinity ?? 'after',
    end_affinity: anchor.endAffinity ?? 'before',
    ...(anchor.quote ? { quote: anchor.quote } : {}),
    ...(anchor.quoteHash ? { quote_hash: anchor.quoteHash } : {}),
  };
}

function toCommentRecord(comment: NoteComment): Record<string, unknown> {
  return {
    id: comment.id,
    author: comment.author,
    created: comment.created,
    content: comment.content,
    status: comment.status,
    anchor: toAnchorRecord(comment.anchor),
  };
}

function getNotesDir(): string | null {
  return store.get('notesDirectory');
}

function getAllMarkdownFiles(dir: string, baseDir = dir): MarkdownFileRecord[] {
  const files: MarkdownFileRecord[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath, baseDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

function parseNoteFile(filePath: string, relativePath = ''): Note | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedMatter = matter(fileContent);
    const data = parsedMatter.data as FrontmatterData;
    const nowIso = new Date().toISOString();
    const content = normalizeContent(parsedMatter.content);
    const directory = relativePath ? path.dirname(relativePath) : '';

    const declaredRev = Math.max(0, toNumberValue(data.comment_rev, 0));
    const defaultRev = declaredRev > 0 ? declaredRev : 0;
    const comments = parseComments(data.comments, content, defaultRev);
    const commentRev = comments.length > 0 ? Math.max(1, declaredRev) : declaredRev;

    return {
      id: toStringValue(data.id),
      title: toStringValue(data.title, 'Untitled'),
      tags: toStringArray(data.tags),
      created: toIsoDate(data.created, nowIso),
      updated: toIsoDate(data.updated, nowIso),
      source: toStringValue(data.source),
      priority: toNumberValue(data.priority),
      commentRev,
      comments: comments.map((comment) => ({
        ...comment,
        anchor: {
          ...comment.anchor,
          rev: comment.anchor.rev > 0 ? comment.anchor.rev : commentRev,
        },
      })),
      content,
      filename: path.basename(filePath),
      relativePath: relativePath || path.basename(filePath),
      directory: directory === '.' ? '' : directory,
    };
  } catch (error) {
    console.error(`Error parsing note file ${filePath}:`, error);
    return null;
  }
}

function isAddCommentPayload(payload: unknown): payload is AddCommentPayload {
  if (!isRecord(payload) || !isRecord(payload.anchor)) {
    return false;
  }

  const hasRange =
    typeof payload.anchor.from === 'number' &&
    typeof payload.anchor.to === 'number' &&
    Number.isFinite(payload.anchor.from) &&
    Number.isFinite(payload.anchor.to) &&
    payload.anchor.to > payload.anchor.from;

  const hasRev =
    typeof payload.anchor.rev === 'number' &&
    Number.isFinite(payload.anchor.rev) &&
    payload.anchor.rev >= 0;

  const hasValidAffinity =
    payload.anchor.startAffinity === undefined ||
    payload.anchor.startAffinity === 'before' ||
    payload.anchor.startAffinity === 'after';

  const hasValidEndAffinity =
    payload.anchor.endAffinity === undefined ||
    payload.anchor.endAffinity === 'before' ||
    payload.anchor.endAffinity === 'after';

  return (
    typeof payload.noteId === 'string' &&
    typeof payload.content === 'string' &&
    typeof payload.author === 'string' &&
    hasRange &&
    hasRev &&
    hasValidAffinity &&
    hasValidEndAffinity
  );
}

function isDeleteCommentPayload(payload: unknown): payload is DeleteCommentPayload {
  if (!isRecord(payload)) {
    return false;
  }

  return typeof payload.noteId === 'string' && typeof payload.commentId === 'string';
}

function isUpdateNotePayload(payload: unknown): payload is UpdateNotePayload {
  if (!isRecord(payload)) {
    return false;
  }

  return typeof payload.noteId === 'string' && typeof payload.content === 'string';
}

ipcMain.handle('notes:list', async (): Promise<NotesListResult> => {
  const notesDir = getNotesDir();

  if (!notesDir) {
    return { notes: [], noDirectory: true };
  }

  if (!fs.existsSync(notesDir)) {
    return { notes: [], noDirectory: false };
  }

  try {
    const files = getAllMarkdownFiles(notesDir);

    const notes = files
      .map(({ fullPath, relativePath }) => parseNoteFile(fullPath, relativePath))
      .filter((note): note is Note => note !== null)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return { notes, noDirectory: false };
  } catch (error) {
    console.error('Error listing notes:', error);
    return { notes: [], noDirectory: false };
  }
});

ipcMain.handle('notes:get', async (_event, noteId: string): Promise<Note | null> => {
  const notesDir = getNotesDir();

  if (!notesDir || !fs.existsSync(notesDir)) {
    return null;
  }

  try {
    const files = getAllMarkdownFiles(notesDir);

    for (const { fullPath, relativePath } of files) {
      const note = parseNoteFile(fullPath, relativePath);
      if (note && note.id === noteId) {
        return note;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting note:', error);
    return null;
  }
});

ipcMain.handle(
  'notes:update',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isUpdateNotePayload(payload)) {
      return { success: false, error: 'Invalid update payload' };
    }

    const notesDir = getNotesDir();

    if (!notesDir || !fs.existsSync(notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const files = getAllMarkdownFiles(notesDir);

      for (const { fullPath, relativePath } of files) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const parsedMatter = matter(fileContent);
        const data = parsedMatter.data as FrontmatterData;

        if (toStringValue(data.id) !== payload.noteId) {
          continue;
        }

        const currentNote = parseNoteFile(fullPath, relativePath);
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

        data.comments = nextComments.map((comment) => toCommentRecord(comment));
        if (nextRev > 0) {
          data.comment_rev = nextRev;
        } else {
          delete data.comment_rev;
        }
        data.updated = new Date().toISOString();

        const updatedFile = matter.stringify(payload.content, data);
        fs.writeFileSync(fullPath, updatedFile, 'utf-8');

        return {
          success: true,
          note: parseNoteFile(fullPath, relativePath) ?? undefined,
        };
      }

      return { success: false, error: 'Note not found' };
    } catch (error) {
      console.error('Error updating note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('directory:get', async (): Promise<string | null> => {
  return getNotesDir();
});

ipcMain.handle('directory:select', async (): Promise<string | null> => {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openDirectory'],
    title: 'Select Notes Directory',
    buttonLabel: 'Select Folder',
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0] ?? null;
    if (selectedPath) {
      store.set('notesDirectory', selectedPath);
    }
    return selectedPath;
  }

  return null;
});

ipcMain.handle(
  'notes:addComment',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isAddCommentPayload(payload)) {
      return { success: false, error: 'Invalid comment payload' };
    }

    const notesDir = getNotesDir();

    if (!notesDir || !fs.existsSync(notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const files = getAllMarkdownFiles(notesDir);

      for (const { fullPath, relativePath } of files) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const parsedMatter = matter(fileContent);
        const data = parsedMatter.data as FrontmatterData;

        if (toStringValue(data.id) !== payload.noteId) {
          continue;
        }

        const currentNote = parseNoteFile(fullPath, relativePath);
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

        const newComment: NoteComment = {
          id: ulid(),
          author: payload.author,
          created: new Date().toISOString(),
          content: payload.content,
          status: 'attached',
          anchor,
        };

        const comments = [...currentNote.comments, newComment];
        data.comments = comments.map((comment) => toCommentRecord(comment));
        data.comment_rev = targetRev;
        data.updated = new Date().toISOString();

        const updatedFile = matter.stringify(parsedMatter.content, data);
        fs.writeFileSync(fullPath, updatedFile, 'utf-8');

        return {
          success: true,
          note: parseNoteFile(fullPath, relativePath) ?? undefined,
        };
      }

      return { success: false, error: 'Note not found' };
    } catch (error) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.handle(
  'notes:deleteComment',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isDeleteCommentPayload(payload)) {
      return { success: false, error: 'Invalid delete payload' };
    }

    const notesDir = getNotesDir();

    if (!notesDir || !fs.existsSync(notesDir)) {
      return { success: false, error: 'Notes directory not found' };
    }

    if (!payload.commentId) {
      return { success: false, error: 'Comment ID is required' };
    }

    try {
      const files = getAllMarkdownFiles(notesDir);

      for (const { fullPath, relativePath } of files) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const parsedMatter = matter(fileContent);
        const data = parsedMatter.data as FrontmatterData;

        if (toStringValue(data.id) !== payload.noteId) {
          continue;
        }

        const currentNote = parseNoteFile(fullPath, relativePath);
        if (!currentNote) {
          return { success: false, error: 'Failed to parse current note' };
        }

        const nextComments = currentNote.comments.filter((comment) => comment.id !== payload.commentId);

        if (nextComments.length === currentNote.comments.length) {
          return { success: false, error: 'Comment not found' };
        }

        data.comments = nextComments.map((comment) => toCommentRecord(comment));
        if (currentNote.commentRev > 0) {
          data.comment_rev = currentNote.commentRev;
        } else {
          delete data.comment_rev;
        }
        data.updated = new Date().toISOString();

        const updatedFile = matter.stringify(parsedMatter.content, data);
        fs.writeFileSync(fullPath, updatedFile, 'utf-8');

        return {
          success: true,
          note: parseNoteFile(fullPath, relativePath) ?? undefined,
        };
      }

      return { success: false, error: 'Note not found' };
    } catch (error) {
      console.error('Error deleting comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);
