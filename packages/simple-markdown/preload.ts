import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content: string, filePath: string) =>
    ipcRenderer.invoke('file:save', { content, filePath }),
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('file:saveAs', { content }),
  setTitle: (title: string) => ipcRenderer.send('window:setTitle', title),
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on('menu:open', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', callback);
  },
};

contextBridge.exposeInMainWorld('api', api);
