import { contextBridge, ipcRenderer } from 'electron';
import type {
  CommentAnchor,
  CommentMutationResult,
  DirectoryMutationResult,
  OperationResult,
  Note,
  NotesListResult,
  PreloadApi,
} from './src/types';

const api: PreloadApi = {
  listNotes: () => ipcRenderer.invoke('notes:list') as Promise<NotesListResult>,
  getNote: (noteId: string) => ipcRenderer.invoke('notes:get', noteId) as Promise<Note | null>,
  createNote: (title: string, directory: string) =>
    ipcRenderer.invoke('notes:create', { title, directory }) as Promise<CommentMutationResult>,
  deleteNote: (noteId: string) =>
    ipcRenderer.invoke('notes:delete', { noteId }) as Promise<OperationResult>,
  moveNote: (noteId: string, directory: string) =>
    ipcRenderer.invoke('notes:move', { noteId, directory }) as Promise<CommentMutationResult>,
  createDirectory: (path: string) =>
    ipcRenderer.invoke('directory:create', { path }) as Promise<DirectoryMutationResult>,
  deleteDirectory: (path: string) =>
    ipcRenderer.invoke('directory:delete', { path }) as Promise<DirectoryMutationResult>,
  updateNote: (noteId: string, content: string) =>
    ipcRenderer.invoke('notes:update', { noteId, content }) as Promise<CommentMutationResult>,
  updateNoteMetadata: (noteId: string, title: string, tags: string[]) =>
    ipcRenderer.invoke('notes:updateMetadata', {
      noteId,
      title,
      tags,
    }) as Promise<CommentMutationResult>,
  addComment: (
    noteId: string,
    content: string,
    author: string,
    anchor: CommentAnchor,
  ) =>
    ipcRenderer.invoke('notes:addComment', {
      noteId,
      content,
      author,
      anchor,
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
