import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import Store from 'electron-store';
import { ulid } from 'ulid';
import type {
  AddCommentPayload,
  CommentAnchor,
  CommentMutationResult,
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

function parseCommentAnchor(anchor: unknown): CommentAnchor {
  if (!isRecord(anchor)) {
    return {
      exact: '',
      prefix: '',
      suffix: '',
    };
  }

  return {
    exact: toStringValue(anchor.exact),
    prefix: toStringValue(anchor.prefix),
    suffix: toStringValue(anchor.suffix),
  };
}

function parseCommentEntry(comment: unknown, fallbackIso: string): NoteComment {
  if (!isRecord(comment)) {
    return {
      id: '',
      author: '',
      created: fallbackIso,
      content: '',
      anchor: {
        exact: '',
        prefix: '',
        suffix: '',
      },
    };
  }

  return {
    id: toStringValue(comment.id),
    author: toStringValue(comment.author),
    created: toIsoDate(comment.created, fallbackIso),
    content: toStringValue(comment.content),
    anchor: parseCommentAnchor(comment.anchor),
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
    const directory = relativePath ? path.dirname(relativePath) : '';
    const commentSource = Array.isArray(data.comments) ? data.comments : [];

    return {
      id: toStringValue(data.id),
      title: toStringValue(data.title, 'Untitled'),
      tags: toStringArray(data.tags),
      created: toIsoDate(data.created, nowIso),
      updated: toIsoDate(data.updated, nowIso),
      source: toStringValue(data.source),
      priority: toNumberValue(data.priority),
      comments: commentSource.map((comment) => parseCommentEntry(comment, nowIso)),
      content: parsedMatter.content.trim(),
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
  if (!isRecord(payload)) {
    return false;
  }

  if (!isRecord(payload.anchor)) {
    return false;
  }

  return (
    typeof payload.noteId === 'string' &&
    typeof payload.content === 'string' &&
    typeof payload.author === 'string' &&
    typeof payload.anchor.exact === 'string' &&
    typeof payload.anchor.prefix === 'string' &&
    typeof payload.anchor.suffix === 'string'
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

        const newComment = {
          id: ulid(),
          author: payload.author,
          created: new Date().toISOString(),
          content: payload.content,
          anchor: {
            exact: payload.anchor.exact,
            prefix: payload.anchor.prefix,
            suffix: payload.anchor.suffix,
          },
        };

        const comments = Array.isArray(data.comments) ? [...data.comments] : [];
        comments.push(newComment);
        data.comments = comments;
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

        const comments = Array.isArray(data.comments) ? [...data.comments] : [];
        const commentIndex = comments.findIndex((comment) => {
          if (!isRecord(comment)) {
            return false;
          }

          return toStringValue(comment.id) === payload.commentId;
        });

        if (commentIndex === -1) {
          return { success: false, error: 'Comment not found' };
        }

        comments.splice(commentIndex, 1);
        data.comments = comments;
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
