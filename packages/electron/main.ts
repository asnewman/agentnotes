import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Store from 'electron-store';
import { NoteStore } from '@agentnotes/engine';
import type {
  AddCommentPayload,
  CommentMutationResult,
  CreateNotePayload,
  DeleteCommentPayload,
  DeleteNotePayload,
  DirectoryMutationResult,
  MoveNotePayload,
  Note,
  NotesListResult,
  OperationResult,
  UpdateNoteMetadataPayload,
  UpdateNotePayload,
  CreateDirectoryPayload,
  DeleteDirectoryPayload,
} from '@agentnotes/engine';

interface StoreSchema {
  notesDirectory: string | null;
}

interface PanelPreferences {
  noteListVisible: boolean;
  commentsVisible: boolean;
}

const CONFIG_FILENAME = '.agentnotes-config.json';

const store = new Store<StoreSchema>({
  defaults: {
    notesDirectory: null,
  },
});

let mainWindow: BrowserWindow | null = null;
let noteStore: NoteStore | null = null;

function getNotesDir(): string | null {
  return store.get('notesDirectory');
}

function getConfigPath(): string | null {
  const notesDir = getNotesDir();
  if (!notesDir) {
    return null;
  }
  return path.join(notesDir, CONFIG_FILENAME);
}

function readPanelPreferences(): PanelPreferences {
  const defaults: PanelPreferences = {
    noteListVisible: true,
    commentsVisible: true,
  };

  const configPath = getConfigPath();
  if (!configPath) {
    return defaults;
  }

  try {
    if (!fs.existsSync(configPath)) {
      return defaults;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<PanelPreferences>;
    return {
      noteListVisible: typeof parsed.noteListVisible === 'boolean' ? parsed.noteListVisible : defaults.noteListVisible,
      commentsVisible: typeof parsed.commentsVisible === 'boolean' ? parsed.commentsVisible : defaults.commentsVisible,
    };
  } catch {
    return defaults;
  }
}

function writePanelPreferences(preferences: PanelPreferences): boolean {
  const configPath = getConfigPath();
  if (!configPath) {
    return false;
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(preferences, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function ensureNoteStore(): NoteStore | null {
  const notesDir = getNotesDir();
  if (!notesDir) {
    noteStore = null;
    return null;
  }

  if (noteStore && noteStore.getNotesDirectory() === notesDir) {
    return noteStore;
  }

  noteStore = new NoteStore({ notesDirectory: notesDir });
  return noteStore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAddCommentPayload(payload: unknown): payload is AddCommentPayload {
  if (!isRecord(payload) || !isRecord(payload.anchor)) {
    return false;
  }

  return (
    typeof payload.noteId === 'string' &&
    typeof payload.content === 'string' &&
    typeof payload.author === 'string' &&
    typeof payload.anchor.from === 'number' &&
    typeof payload.anchor.to === 'number' &&
    payload.anchor.to > payload.anchor.from
  );
}

function isDeleteCommentPayload(payload: unknown): payload is DeleteCommentPayload {
  return isRecord(payload) && typeof payload.noteId === 'string' && typeof payload.commentId === 'string';
}

function isUpdateNotePayload(payload: unknown): payload is UpdateNotePayload {
  return isRecord(payload) && typeof payload.noteId === 'string' && typeof payload.content === 'string';
}

function isUpdateNoteMetadataPayload(payload: unknown): payload is UpdateNoteMetadataPayload {
  return (
    isRecord(payload) &&
    typeof payload.noteId === 'string' &&
    Array.isArray(payload.tags) &&
    payload.tags.every((tag: unknown) => typeof tag === 'string')
  );
}

function isCreateNotePayload(payload: unknown): payload is CreateNotePayload {
  return isRecord(payload) && typeof payload.title === 'string' && typeof payload.directory === 'string';
}

function isDeleteNotePayload(payload: unknown): payload is DeleteNotePayload {
  return isRecord(payload) && typeof payload.noteId === 'string';
}

function isMoveNotePayload(payload: unknown): payload is MoveNotePayload {
  return isRecord(payload) && typeof payload.noteId === 'string' && typeof payload.directory === 'string';
}

function isCreateDirectoryPayload(payload: unknown): payload is CreateDirectoryPayload {
  return isRecord(payload) && typeof payload.path === 'string';
}

function isDeleteDirectoryPayload(payload: unknown): payload is DeleteDirectoryPayload {
  return isRecord(payload) && typeof payload.path === 'string';
}

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

// --- IPC Handlers ---

ipcMain.handle('notes:list', async (): Promise<NotesListResult> => {
  const ns = ensureNoteStore();
  if (!ns) {
    return { notes: [], directories: [], noDirectory: true };
  }

  const notesDir = getNotesDir()!;
  if (!fs.existsSync(notesDir)) {
    return { notes: [], directories: [], noDirectory: false };
  }

  return ns.listNotes();
});

ipcMain.handle('notes:get', async (_event, noteId: string): Promise<Note | null> => {
  const ns = ensureNoteStore();
  if (!ns) {
    return null;
  }
  return ns.getNote(noteId);
});

ipcMain.handle(
  'notes:create',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isCreateNotePayload(payload)) {
      return { success: false, error: 'Invalid create note payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.createNote(payload);
  },
);

ipcMain.handle(
  'notes:delete',
  async (_event, payload: unknown): Promise<OperationResult> => {
    if (!isDeleteNotePayload(payload)) {
      return { success: false, error: 'Invalid delete note payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.deleteNote(payload);
  },
);

ipcMain.handle(
  'notes:move',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isMoveNotePayload(payload)) {
      return { success: false, error: 'Invalid move note payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.moveNote(payload);
  },
);

ipcMain.handle(
  'notes:update',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isUpdateNotePayload(payload)) {
      return { success: false, error: 'Invalid update payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.updateNote(payload);
  },
);

ipcMain.handle(
  'notes:updateMetadata',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isUpdateNoteMetadataPayload(payload)) {
      return { success: false, error: 'Invalid metadata payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.updateNoteMetadata(payload);
  },
);

ipcMain.handle(
  'notes:addComment',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isAddCommentPayload(payload)) {
      return { success: false, error: 'Invalid comment payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.addComment(payload);
  },
);

ipcMain.handle(
  'notes:deleteComment',
  async (_event, payload: unknown): Promise<CommentMutationResult> => {
    if (!isDeleteCommentPayload(payload)) {
      return { success: false, error: 'Invalid delete payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.deleteComment(payload);
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

ipcMain.on('shell:openExternal', (_event, url: string) => {
  if (typeof url === 'string' && url.length > 0) {
    void shell.openExternal(url);
  }
});

ipcMain.handle('directory:get', async (): Promise<string | null> => {
  return getNotesDir();
});

ipcMain.handle(
  'directory:create',
  async (_event, payload: unknown): Promise<DirectoryMutationResult> => {
    if (!isCreateDirectoryPayload(payload)) {
      return { success: false, error: 'Invalid create directory payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.createDirectory(payload);
  },
);

ipcMain.handle(
  'directory:delete',
  async (_event, payload: unknown): Promise<DirectoryMutationResult> => {
    if (!isDeleteDirectoryPayload(payload)) {
      return { success: false, error: 'Invalid delete directory payload' };
    }
    const ns = ensureNoteStore();
    if (!ns) {
      return { success: false, error: 'Notes directory not found' };
    }
    return ns.deleteDirectory(payload);
  },
);

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
      noteStore = null;
    }
    return selectedPath;
  }

  return null;
});

ipcMain.handle('preferences:getPanels', async (): Promise<PanelPreferences> => {
  return readPanelPreferences();
});

ipcMain.handle(
  'preferences:savePanels',
  async (_event, preferences: PanelPreferences): Promise<boolean> => {
    return writePanelPreferences(preferences);
  },
);

interface SaveImagePayload {
  data: string; // base64 encoded image data
  mimeType: string;
}

interface SaveImageResult {
  success: boolean;
  relativePath?: string;
  error?: string;
}

function isSaveImagePayload(payload: unknown): payload is SaveImagePayload {
  return (
    isRecord(payload) &&
    typeof payload.data === 'string' &&
    typeof payload.mimeType === 'string'
  );
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return mimeToExt[mimeType] || 'png';
}

ipcMain.handle(
  'images:save',
  async (_event, payload: unknown): Promise<SaveImageResult> => {
    if (!isSaveImagePayload(payload)) {
      return { success: false, error: 'Invalid save image payload' };
    }

    const notesDir = getNotesDir();
    if (!notesDir) {
      return { success: false, error: 'Notes directory not found' };
    }

    try {
      const imagesDir = path.join(notesDir, 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      const extension = getExtensionFromMimeType(payload.mimeType);
      const uniqueId = crypto.randomBytes(4).toString('hex');
      const filename = `${uniqueId}.${extension}`;
      const filepath = path.join(imagesDir, filename);

      const imageBuffer = Buffer.from(payload.data, 'base64');
      fs.writeFileSync(filepath, imageBuffer);

      return {
        success: true,
        relativePath: `images/${filename}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  },
);
