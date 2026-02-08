import { contextBridge, ipcRenderer } from 'electron';
import type { CommentMutationResult, Note, NotesListResult, PreloadApi } from './src/types';

const api: PreloadApi = {
  listNotes: () => ipcRenderer.invoke('notes:list') as Promise<NotesListResult>,
  getNote: (noteId: string) => ipcRenderer.invoke('notes:get', noteId) as Promise<Note | null>,
  addComment: (
    noteId: string,
    content: string,
    author: string,
    startChar: number,
    endChar: number,
  ) =>
    ipcRenderer.invoke('notes:addComment', {
      noteId,
      content,
      author,
      startChar,
      endChar,
    }) as Promise<CommentMutationResult>,
  deleteComment: (noteId: string, commentId: string) =>
    ipcRenderer.invoke('notes:deleteComment', { noteId, commentId }) as Promise<CommentMutationResult>,
  getDirectory: () => ipcRenderer.invoke('directory:get') as Promise<string | null>,
  selectDirectory: () => ipcRenderer.invoke('directory:select') as Promise<string | null>,
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('api', api);
