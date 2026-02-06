const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');

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

// Get the notes directory path (in parent directory of electron app)
function getNotesDir() {
  // Look in the parent directory of the electron folder
  const parentDir = path.dirname(__dirname);
  return path.join(parentDir, '.agentnotes', 'notes');
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

  if (!fs.existsSync(notesDir)) {
    return [];
  }

  try {
    const files = getAllMarkdownFiles(notesDir);

    const notes = files
      .map(({ fullPath, relativePath }) => parseNoteFile(fullPath, relativePath))
      .filter(n => n !== null)
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return notes;
  } catch (err) {
    console.error('Error listing notes:', err);
    return [];
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
