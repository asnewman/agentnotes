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

// Parse a note file
function parseNoteFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: markdownContent } = matter(content);

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
      filename: path.basename(filePath)
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
    const files = fs.readdirSync(notesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(notesDir, f));

    const notes = files
      .map(parseNoteFile)
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
    const files = fs.readdirSync(notesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(notesDir, f));

    for (const filePath of files) {
      const note = parseNoteFile(filePath);
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
