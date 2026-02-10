import type { Note } from '../types';

interface DirectoryNode {
  type: 'directory';
  name: string;
  path: string;
  expanded: boolean;
  children: TreeNode[];
}

interface NoteNode {
  type: 'note';
  note: Note;
}

type TreeNode = DirectoryNode | NoteNode;

interface NoteListCallbacks {
  onSelectNote: (note: Note) => void;
  onMoveNote: (note: Note, targetDirectory: string) => void | Promise<void>;
  onCreateNote: (targetDirectory: string) => void | Promise<void>;
  onCreateDirectory: (targetDirectory: string) => void | Promise<void>;
}

function parseDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareNotesByCreated(a: Note, b: Note): number {
  const createdDiff = parseDate(b.created) - parseDate(a.created);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  const pathDiff = a.relativePath.localeCompare(b.relativePath);
  if (pathDiff !== 0) {
    return pathDiff;
  }

  const titleDiff = a.title.localeCompare(b.title);
  if (titleDiff !== 0) {
    return titleDiff;
  }

  return a.id.localeCompare(b.id);
}

function buildNoteTree(notes: Note[]): TreeNode[] {
  const tree: TreeNode[] = [];
  const dirMap = new Map<string, DirectoryNode>();

  const sortedNotes = [...notes].sort((a, b) => {
    if (!a.directory && b.directory) {
      return 1;
    }

    if (a.directory && !b.directory) {
      return -1;
    }

    return compareNotesByCreated(a, b);
  });

  for (const note of sortedNotes) {
    if (!note.directory) {
      tree.push({ type: 'note', note });
      continue;
    }

    const parts = note.directory.split('/');
    let currentPath = '';
    let currentLevel = tree;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const dirNode: DirectoryNode = {
          type: 'directory',
          name: part,
          path: currentPath,
          expanded: true,
          children: [],
        };

        dirMap.set(currentPath, dirNode);
        currentLevel.push(dirNode);
      }

      currentLevel = dirMap.get(currentPath)?.children ?? currentLevel;
    }

    currentLevel.push({ type: 'note', note });
  }

  function sortLevel(items: TreeNode[]): void {
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'note') {
        return -1;
      }

      if (a.type === 'note' && b.type === 'directory') {
        return 1;
      }

      if (a.type === 'directory' && b.type === 'directory') {
        return a.name.localeCompare(b.name);
      }

      if (a.type === 'note' && b.type === 'note') {
        return compareNotesByCreated(a.note, b.note);
      }

      return 0;
    });

    for (const item of items) {
      if (item.type === 'directory') {
        sortLevel(item.children);
      }
    }
  }

  sortLevel(tree);
  return tree;
}

function createIcon(type: 'folder' | 'document' | 'chevron'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  if (type === 'folder') {
    path.setAttribute(
      'd',
      'M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 4H7.414l-1-1A2 2 0 0 0 5 2.5H1.5z',
    );
  } else if (type === 'document') {
    path.setAttribute(
      'd',
      'M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5 1.5V5h3.5L9 1.5zM5 7h6v1H5V7zm0 2h6v1H5V9zm0 2h4v1H5v-1z',
    );
  } else {
    path.setAttribute(
      'd',
      'M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z',
    );
  }

  svg.appendChild(path);
  return svg;
}

function createDirectoryItem(dir: DirectoryNode, depth: number): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'directory-item';
  item.dataset.path = dir.path;
  item.style.paddingLeft = `${16 + depth * 16}px`;

  const toggle = document.createElement('span');
  toggle.className = `directory-toggle${dir.expanded ? ' expanded' : ''}`;
  toggle.appendChild(createIcon('chevron'));

  const folderIcon = document.createElement('span');
  folderIcon.className = 'directory-folder-icon';
  folderIcon.appendChild(createIcon('folder'));

  const name = document.createElement('span');
  name.className = 'directory-name';
  name.textContent = dir.name;

  item.append(toggle, folderIcon, name);
  return item;
}

function createNoteItem(note: Note, isSelected: boolean, depth = 0): HTMLDivElement {
  const item = document.createElement('div');
  item.className = `note-item${isSelected ? ' selected' : ''}`;
  item.dataset.noteId = note.id;
  item.style.paddingLeft = `${16 + depth * 16 + (depth > 0 ? 22 : 0)}px`;
  item.draggable = true;

  const docIcon = document.createElement('span');
  docIcon.className = 'note-icon';
  docIcon.appendChild(createIcon('document'));

  const title = document.createElement('span');
  title.className = 'note-item-text';
  title.textContent = note.title;

  item.append(docIcon, title);
  return item;
}

export class NoteList {
  private container: HTMLElement;
  private callbacks: NoteListCallbacks;
  private notes: Note[];
  private selectedNoteId: string | null;
  private expandedDirs: Set<string>;
  private initialized: boolean;
  private draggingNoteId: string | null;
  private contextMenu: HTMLDivElement | null;

  constructor(container: HTMLElement, callbacks: NoteListCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.notes = [];
    this.selectedNoteId = null;
    this.expandedDirs = new Set<string>();
    this.initialized = false;
    this.draggingNoteId = null;
    this.contextMenu = null;

    this.bindInteractions();
  }

  private bindInteractions(): void {
    this.container.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const targetDirectory = this.resolveTargetDirectory(event.target);
      this.showContextMenu(event.clientX, event.clientY, targetDirectory);
    });

    this.container.addEventListener('dragover', (event) => {
      if (!this.draggingNoteId) {
        return;
      }

      const targetElement = event.target;
      if (
        targetElement instanceof Element &&
        targetElement.closest('.directory-item[data-path]')
      ) {
        return;
      }

      event.preventDefault();
      const targetDirectory = this.resolveTargetDirectory(event.target);
      this.container.classList.toggle('note-list-drop-root', targetDirectory === '');
    });

    this.container.addEventListener('drop', (event) => {
      if (!this.draggingNoteId) {
        return;
      }

      const targetElement = event.target;
      if (
        targetElement instanceof Element &&
        targetElement.closest('.directory-item[data-path]')
      ) {
        return;
      }

      event.preventDefault();
      const targetDirectory = this.resolveTargetDirectory(event.target);
      this.moveDraggingNote(targetDirectory);
      this.clearDragIndicators();
    });

    this.container.addEventListener('dragleave', (event) => {
      const relatedTarget = event.relatedTarget;
      if (!(relatedTarget instanceof Node) || !this.container.contains(relatedTarget)) {
        this.container.classList.remove('note-list-drop-root');
      }
    });

    document.addEventListener('click', () => this.hideContextMenu());
    window.addEventListener('blur', () => this.hideContextMenu());
    window.addEventListener('resize', () => this.hideContextMenu());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hideContextMenu();
      }
    });
  }

  private resolveTargetDirectory(target: EventTarget | null): string {
    if (!(target instanceof Element)) {
      return '';
    }

    const directoryItem = target.closest<HTMLElement>('.directory-item[data-path]');
    if (directoryItem?.dataset.path) {
      return directoryItem.dataset.path;
    }

    const directoryChildren = target.closest<HTMLElement>('.directory-children[data-path]');
    if (directoryChildren?.dataset.path) {
      return directoryChildren.dataset.path;
    }

    const noteItem = target.closest<HTMLElement>('.note-item[data-note-id]');
    if (noteItem?.dataset.noteId) {
      const note = this.notes.find((entry) => entry.id === noteItem.dataset.noteId);
      if (note) {
        return note.directory;
      }
    }

    return '';
  }

  private showContextMenu(x: number, y: number, targetDirectory: string): void {
    this.hideContextMenu();

    const menu = document.createElement('div');
    menu.className = 'note-list-context-menu';

    const addAction = (label: string, onClick: () => void | Promise<void>): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'note-list-context-menu-item';
      button.textContent = label;
      button.addEventListener('click', () => {
        this.hideContextMenu();
        void onClick();
      });
      menu.appendChild(button);
    };

    addAction('New Note', () => this.callbacks.onCreateNote(targetDirectory));
    addAction('New Folder', () => this.callbacks.onCreateDirectory(targetDirectory));

    document.body.appendChild(menu);
    this.contextMenu = menu;

    const rect = menu.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
  }

  private hideContextMenu(): void {
    if (!this.contextMenu) {
      return;
    }

    this.contextMenu.remove();
    this.contextMenu = null;
  }

  private clearDragIndicators(): void {
    this.container.classList.remove('note-list-drop-root');
    this.container.querySelectorAll<HTMLElement>('.directory-item.drag-over').forEach((item) => {
      item.classList.remove('drag-over');
    });
    this.container.querySelectorAll<HTMLElement>('.note-item.dragging').forEach((item) => {
      item.classList.remove('dragging');
    });
    this.draggingNoteId = null;
  }

  private moveDraggingNote(targetDirectory: string): void {
    if (!this.draggingNoteId) {
      return;
    }

    const note = this.notes.find((entry) => entry.id === this.draggingNoteId);
    if (!note) {
      return;
    }

    if (note.directory === targetDirectory) {
      return;
    }

    void this.callbacks.onMoveNote(note, targetDirectory);
  }

  render(notes: Note[]): void {
    if (!Array.isArray(notes)) {
      console.error('NoteList.render expected an array of notes, received:', notes);
      this.notes = [];
      this.container.innerHTML = '<p class="empty-state">No notes found</p>';
      return;
    }

    this.notes = notes;
    this.container.innerHTML = '';

    if (notes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No notes found';
      this.container.appendChild(empty);
      return;
    }

    const tree = buildNoteTree(notes);
    this.initExpandedState(tree);
    this.renderTree(tree, this.container, 0);
  }

  private initExpandedState(items: TreeNode[]): void {
    for (const item of items) {
      if (item.type !== 'directory') {
        continue;
      }

      if (!this.expandedDirs.has(item.path) && !this.initialized) {
        this.expandedDirs.add(item.path);
      }

      item.expanded = this.expandedDirs.has(item.path);
      this.initExpandedState(item.children);
    }

    this.initialized = true;
  }

  private renderTree(items: TreeNode[], container: HTMLElement, depth: number): void {
    for (const item of items) {
      if (item.type === 'directory') {
        const dirElement = createDirectoryItem(item, depth);
        dirElement.addEventListener('click', (event) => {
          event.stopPropagation();
          this.toggleDirectory(item.path);
        });

        dirElement.addEventListener('dragover', (event) => {
          if (!this.draggingNoteId) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          dirElement.classList.add('drag-over');
        });

        dirElement.addEventListener('dragleave', (event) => {
          const relatedTarget = event.relatedTarget;
          if (!(relatedTarget instanceof Node) || !dirElement.contains(relatedTarget)) {
            dirElement.classList.remove('drag-over');
          }
        });

        dirElement.addEventListener('drop', (event) => {
          if (!this.draggingNoteId) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          dirElement.classList.remove('drag-over');
          this.moveDraggingNote(item.path);
          this.clearDragIndicators();
        });

        container.appendChild(dirElement);

        const childContainer = document.createElement('div');
        childContainer.className = 'directory-children';
        childContainer.dataset.path = item.path;

        if (!this.expandedDirs.has(item.path)) {
          childContainer.style.display = 'none';
        }

        this.renderTree(item.children, childContainer, depth + 1);
        container.appendChild(childContainer);
        continue;
      }

      const noteElement = createNoteItem(item.note, item.note.id === this.selectedNoteId, depth);
      noteElement.addEventListener('click', () => {
        this.selectNote(item.note.id);
      });
      noteElement.addEventListener('dragstart', (event) => {
        this.hideContextMenu();
        this.draggingNoteId = item.note.id;
        noteElement.classList.add('dragging');
        if (event.dataTransfer) {
          event.dataTransfer.setData('text/plain', item.note.id);
          event.dataTransfer.effectAllowed = 'move';
        }
      });
      noteElement.addEventListener('dragend', () => {
        this.clearDragIndicators();
      });
      container.appendChild(noteElement);
    }
  }

  toggleDirectory(dirPath: string): void {
    if (this.expandedDirs.has(dirPath)) {
      this.expandedDirs.delete(dirPath);
    } else {
      this.expandedDirs.add(dirPath);
    }

    const escapedPath = CSS.escape(dirPath);
    const toggle = this.container.querySelector<HTMLElement>(
      `.directory-item[data-path="${escapedPath}"] .directory-toggle`,
    );
    const children = this.container.querySelector<HTMLElement>(
      `.directory-children[data-path="${escapedPath}"]`,
    );

    if (toggle) {
      toggle.classList.toggle('expanded', this.expandedDirs.has(dirPath));
    }

    if (children) {
      children.style.display = this.expandedDirs.has(dirPath) ? '' : 'none';
    }
  }

  selectNote(noteId: string): void {
    this.selectedNoteId = noteId;

    this.container.querySelectorAll<HTMLElement>('.note-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.noteId === noteId);
    });

    const note = this.notes.find((entry) => entry.id === noteId);
    if (note) {
      this.callbacks.onSelectNote(note);
    }
  }

  getSelectedNote(): Note | null {
    return this.notes.find((note) => note.id === this.selectedNoteId) ?? null;
  }
}
