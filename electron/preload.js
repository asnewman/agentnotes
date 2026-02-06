const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // List all notes
  listNotes: () => ipcRenderer.invoke('notes:list'),

  // Get a single note by ID
  getNote: (noteId) => ipcRenderer.invoke('notes:get', noteId),

  // Add a comment to a note
  addComment: (noteId, content, author, startChar, endChar) =>
    ipcRenderer.invoke('notes:addComment', { noteId, content, author, startChar, endChar }),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close')
});
