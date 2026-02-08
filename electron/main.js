const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const { ulid } = require('ulid');
const Store = require('electron-store');

// Initialize settings store
const store = new Store({
  defaults: {
    notesDirectory: null
  }
});

let mainWindow;

function createWindow() {
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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
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

// Get the notes directory path from stored settings
function getNotesDir() {
  return store.get('notesDirectory');
}

// Recursively get all markdown files in a directory
function getAllMarkdownFiles(dir, baseDir = dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

// Parse a note file
function parseNoteFile(filePath, relativePath = '') {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: markdownContent } = matter(content);

    // Extract directory from relativePath (empty string for root-level notes)
    const directory = relativePath ? path.dirname(relativePath) : '';

    return {
      id: data.id || '',
      title: data.title || 'Untitled',
      tags: data.tags || [],
      created: data.created ? new Date(data.created).toISOString() : new Date().toISOString(),
      updated: data.updated ? new Date(data.updated).toISOString() : new Date().toISOString(),
      source: data.source || '',
      priority: data.priority || 0,
      comments: (data.comments || []).map(c => ({
        id: c.id || '',
        author: c.author || '',
        line: c.line || 0,
        startChar: c.start_char || 0,
        endChar: c.end_char || 0,
        created: c.created ? new Date(c.created).toISOString() : new Date().toISOString(),
        content: c.content || ''
      })),
      content: markdownContent.trim(),
      filename: path.basename(filePath),
      relativePath: relativePath || path.basename(filePath),
      directory: directory === '.' ? '' : directory
    };
  } catch (err) {
    console.error(`Error parsing note file ${filePath}:`, err);
    return null;
  }
}

// IPC handler: List all notes
ipcMain.handle('notes:list', async () => {
  const notesDir = getNotesDir();

  // No directory configured yet
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
      .filter(n => n !== null)
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return { notes, noDirectory: false };
  } catch (err) {
    console.error('Error listing notes:', err);
    return { notes: [], noDirectory: false };
  }
});

// IPC handler: Get a single note by ID
ipcMain.handle('notes:get', async (event, noteId) => {
  const notesDir = getNotesDir();

  if (!fs.existsSync(notesDir)) {
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
  } catch (err) {
    console.error('Error getting note:', err);
    return null;
  }
});

// IPC handlers: Window controls
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

// IPC handler: Get the configured notes directory
ipcMain.handle('directory:get', async () => {
  return store.get('notesDirectory');
});

// IPC handler: Open directory picker and save selection
ipcMain.handle('directory:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Notes Directory',
    buttonLabel: 'Select Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    store.set('notesDirectory', selectedPath);
    return selectedPath;
  }

  return null;
});

// IPC handler: Add a comment to a note
ipcMain.handle('notes:addComment', async (event, { noteId, content, author, startChar, endChar }) => {
  const notesDir = getNotesDir();

  if (!notesDir || !fs.existsSync(notesDir)) {
    return { success: false, error: 'Notes directory not found' };
  }

  try {
    const files = getAllMarkdownFiles(notesDir);

    // Find the note file by ID
    for (const { fullPath, relativePath } of files) {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const { data, content: markdownContent } = matter(fileContent);

      if (data.id === noteId) {
        // Create new comment
        const newComment = {
          id: ulid(),
          author: author || '',
          start_char: startChar,
          end_char: endChar,
          created: new Date().toISOString(),
          content: content
        };

        // Initialize comments array if not present
        if (!data.comments) {
          data.comments = [];
        }

        // Add the new comment
        data.comments.push(newComment);

        // Update the 'updated' timestamp
        data.updated = new Date().toISOString();

        // Write the file back
        const updatedFile = matter.stringify(markdownContent, data);
        fs.writeFileSync(fullPath, updatedFile, 'utf-8');

        // Return the updated note
        return {
          success: true,
          note: parseNoteFile(fullPath, relativePath)
        };
      }
    }

    return { success: false, error: 'Note not found' };
  } catch (err) {
    console.error('Error adding comment:', err);
    return { success: false, error: err.message };
  }
});

// IPC handler: Delete a comment from a note
ipcMain.handle('notes:deleteComment', async (event, { noteId, commentId }) => {
  const notesDir = getNotesDir();

  if (!notesDir || !fs.existsSync(notesDir)) {
    return { success: false, error: 'Notes directory not found' };
  }

  if (!commentId) {
    return { success: false, error: 'Comment ID is required' };
  }

  try {
    const files = getAllMarkdownFiles(notesDir);

    // Find the note file by ID
    for (const { fullPath, relativePath } of files) {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const { data, content: markdownContent } = matter(fileContent);

      if (data.id === noteId) {
        const comments = Array.isArray(data.comments) ? data.comments : [];
        const commentIndex = comments.findIndex(comment => comment && comment.id === commentId);

        if (commentIndex === -1) {
          return { success: false, error: 'Comment not found' };
        }

        comments.splice(commentIndex, 1);
        data.comments = comments;
        data.updated = new Date().toISOString();

        // Write the file back
        const updatedFile = matter.stringify(markdownContent, data);
        fs.writeFileSync(fullPath, updatedFile, 'utf-8');

        // Return the updated note
        return {
          success: true,
          note: parseNoteFile(fullPath, relativePath)
        };
      }
    }

    return { success: false, error: 'Note not found' };
  } catch (err) {
    console.error('Error deleting comment:', err);
    return { success: false, error: err.message };
  }
});
