/**
 * NoteList component - displays a hierarchical list of notes in the left panel
 */

/**
 * Build a tree structure from a flat list of notes
 * @param {Array} notes - Flat array of note objects with directory field
 * @returns {Array} Tree structure with directories and notes
 */
function buildNoteTree(notes) {
  const tree = [];
  const dirMap = new Map();

  // Sort notes: directories first (alphabetical), then notes by date
  const sortedNotes = [...notes].sort((a, b) => {
    // Root notes come after directory notes
    if (!a.directory && b.directory) return 1;
    if (a.directory && !b.directory) return -1;
    // Same directory level, sort by date
    return new Date(b.created) - new Date(a.created);
  });

  for (const note of sortedNotes) {
    if (!note.directory) {
      // Root-level note
      tree.push({ type: 'note', note });
    } else {
      // Note in a subdirectory - ensure all parent directories exist
      const parts = note.directory.split('/');
      let currentPath = '';
      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!dirMap.has(currentPath)) {
          const dirNode = {
            type: 'directory',
            name: part,
            path: currentPath,
            expanded: true,
            children: []
          };
          dirMap.set(currentPath, dirNode);
          currentLevel.push(dirNode);
        }

        currentLevel = dirMap.get(currentPath).children;
      }

      // Add the note to its directory
      currentLevel.push({ type: 'note', note });
    }
  }

  // Sort each level: directories first (alphabetical), then notes (by date)
  function sortLevel(items) {
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'note') return -1;
      if (a.type === 'note' && b.type === 'directory') return 1;
      if (a.type === 'directory' && b.type === 'directory') {
        return a.name.localeCompare(b.name);
      }
      // Both notes
      return new Date(b.note.created) - new Date(a.note.created);
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

/**
 * Create an SVG icon element
 * @param {string} type - Icon type: 'folder', 'document', 'chevron'
 * @returns {SVGElement}
 */
function createIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  switch (type) {
    case 'folder':
      path.setAttribute('d', 'M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 4H7.414l-1-1A2 2 0 0 0 5 2.5H1.5z');
      break;
    case 'document':
      path.setAttribute('d', 'M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5 1.5V5h3.5L9 1.5zM5 7h6v1H5V7zm0 2h6v1H5V9zm0 2h4v1H5v-1z');
      break;
    case 'chevron':
      path.setAttribute('d', 'M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z');
      break;
  }

  svg.appendChild(path);
  return svg;
}

/**
 * Create a directory item element
 * @param {Object} dir - The directory object
 * @param {number} depth - Nesting depth
 * @returns {HTMLElement}
 */
function createDirectoryItem(dir, depth) {
  const item = document.createElement('div');
  item.className = 'directory-item';
  item.dataset.path = dir.path;
  item.style.paddingLeft = `${16 + depth * 16}px`;

  const toggle = document.createElement('span');
  toggle.className = 'directory-toggle' + (dir.expanded ? ' expanded' : '');
  toggle.appendChild(createIcon('chevron'));

  const folderIcon = document.createElement('span');
  folderIcon.className = 'directory-folder-icon';
  folderIcon.appendChild(createIcon('folder'));

  const name = document.createElement('span');
  name.className = 'directory-name';
  name.textContent = dir.name;

  item.appendChild(toggle);
  item.appendChild(folderIcon);
  item.appendChild(name);

  return item;
}

/**
 * Create a note list item element
 * @param {Object} note - The note object
 * @param {boolean} isSelected - Whether this note is selected
 * @param {number} depth - Nesting depth
 * @returns {HTMLElement} The note list item element
 */
function createNoteItem(note, isSelected, depth = 0) {
  const item = document.createElement('div');
  item.className = 'note-item' + (isSelected ? ' selected' : '');
  item.dataset.noteId = note.id;
  item.style.paddingLeft = `${16 + depth * 16 + (depth > 0 ? 22 : 0)}px`;

  const docIcon = document.createElement('span');
  docIcon.className = 'note-icon';
  docIcon.appendChild(createIcon('document'));

  const title = document.createElement('span');
  title.className = 'note-item-text';
  title.textContent = note.title;

  item.appendChild(docIcon);
  item.appendChild(title);

  return item;
}

/**
 * NoteList class - manages the note list panel with directory hierarchy
 */
export class NoteList {
  /**
   * @param {HTMLElement} container - The container element for the note list
   * @param {Function} onSelectNote - Callback when a note is selected
   */
  constructor(container, onSelectNote) {
    this.container = container;
    this.onSelectNote = onSelectNote;
    this.notes = [];
    this.selectedNoteId = null;
    this.expandedDirs = new Set(); // Track expanded directories
  }

  /**
   * Render the note list
   * @param {Array} notes - Array of note objects
   */
  render(notes) {
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

    // Build tree structure and render
    const tree = buildNoteTree(notes);

    // Initialize expanded state - all expanded by default
    this.initExpandedState(tree);

    this.renderTree(tree, this.container, 0);
  }

  /**
   * Initialize expanded state for all directories (expanded by default)
   * @param {Array} items - Tree items
   */
  initExpandedState(items) {
    for (const item of items) {
      if (item.type === 'directory') {
        // Only add to expandedDirs if not already tracked (preserve user's toggle state)
        if (!this.expandedDirs.has(item.path) && !this._initialized) {
          this.expandedDirs.add(item.path);
        }
        item.expanded = this.expandedDirs.has(item.path);
        this.initExpandedState(item.children);
      }
    }
    this._initialized = true;
  }

  /**
   * Render tree items recursively
   * @param {Array} items - Tree items to render
   * @param {HTMLElement} container - Container element
   * @param {number} depth - Current depth
   */
  renderTree(items, container, depth) {
    for (const item of items) {
      if (item.type === 'directory') {
        const dirElement = createDirectoryItem(item, depth);

        // Add click handler for toggle
        dirElement.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDirectory(item.path);
        });

        container.appendChild(dirElement);

        // Create children container
        const childContainer = document.createElement('div');
        childContainer.className = 'directory-children';
        childContainer.dataset.path = item.path;

        if (!this.expandedDirs.has(item.path)) {
          childContainer.style.display = 'none';
        }

        // Render children
        this.renderTree(item.children, childContainer, depth + 1);

        container.appendChild(childContainer);
      } else {
        // Regular note item
        const noteElement = createNoteItem(
          item.note,
          item.note.id === this.selectedNoteId,
          depth
        );

        noteElement.addEventListener('click', () => {
          this.selectNote(item.note.id);
        });

        container.appendChild(noteElement);
      }
    }
  }

  /**
   * Toggle a directory's expanded state
   * @param {string} dirPath - The directory path to toggle
   */
  toggleDirectory(dirPath) {
    if (this.expandedDirs.has(dirPath)) {
      this.expandedDirs.delete(dirPath);
    } else {
      this.expandedDirs.add(dirPath);
    }

    // Update the UI
    const toggle = this.container.querySelector(`.directory-item[data-path="${dirPath}"] .directory-toggle`);
    const children = this.container.querySelector(`.directory-children[data-path="${dirPath}"]`);

    if (toggle) {
      toggle.classList.toggle('expanded', this.expandedDirs.has(dirPath));
    }

    if (children) {
      children.style.display = this.expandedDirs.has(dirPath) ? '' : 'none';
    }
  }

  /**
   * Select a note by ID
   * @param {string} noteId - The note ID to select
   */
  selectNote(noteId) {
    this.selectedNoteId = noteId;

    // Update selection visual
    this.container.querySelectorAll('.note-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.noteId === noteId);
    });

    // Find the note and call the callback
    const note = this.notes.find(n => n.id === noteId);
    if (note && this.onSelectNote) {
      this.onSelectNote(note);
    }
  }

  /**
   * Get the currently selected note
   * @returns {Object|null} The selected note or null
   */
  getSelectedNote() {
    return this.notes.find(n => n.id === this.selectedNoteId) || null;
  }
}
