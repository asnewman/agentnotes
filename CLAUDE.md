# AgentNotes

A local-first CLI knowledge base storing markdown notes with YAML frontmatter.

## Project Structure

- `cmd/agentnotes/main.go` - CLI entrypoint
- `internal/notes/model.go` - Note struct, frontmatter parsing/marshaling
- `internal/notes/store.go` - File-based CRUD operations
- `internal/notes/search.go` - Search and filter logic
- `internal/cli/commands.go` - Cobra CLI command implementations
- `internal/cli/display.go` - Terminal formatting with ANSI colors
- `electron/` - Electron-based GUI application
  - `main.ts` - Electron main process, window creation, IPC handlers
  - `preload.ts` - Context bridge exposing APIs to renderer
  - `src/renderer.ts` - Renderer entry point, component initialization
  - `src/types.ts` - Shared TypeScript interfaces for notes/comments/IPC payloads
  - `tsconfig.main.json` - TypeScript config for main/preload process build
  - `tsconfig.renderer.json` - TypeScript config for renderer type checking
  - `eslint.config.mjs` - ESLint config including strict TypeScript rules
  - `src/index.html` - Main HTML with custom title bar
  - `src/styles/main.css` - Core styles including title bar
  - `src/styles/components.css` - Component-specific styles
  - `src/components/` - UI components (NoteList, NoteView, CommentsPanel)
  - `src/lib/` - Utilities (noteStore, highlighter, positionMapper)

## Storage

Notes stored in `.agentnotes/notes/` (relative to current working directory) as markdown files with format:
```
2024-01-15-slugified-title.md
```

Notes can be organized in subdirectories:
```
.agentnotes/notes/
├── projects/
│   ├── frontend/
│   │   └── 2024-02-01-react-components.md
│   └── backend/
│       └── 2024-02-01-api-endpoints.md
├── meetings/
│   └── 2024-02-03-standup-notes.md
└── 2024-01-15-root-level-note.md
```

Each note has YAML frontmatter with: id (ULID), title, tags, created, updated, source, priority, comments.

The CLI operates relative to the current working directory - each project can have its own independent notes.

## Build & Run

### CLI
```bash
go build -o agentnotes ./cmd/agentnotes
./agentnotes --help
```

### GUI (Electron)
```bash
cd electron
npm install
npm run typecheck
npm run lint
npm start
```

The Electron app features:
- Custom draggable title bar with macOS-style traffic light buttons (close/minimize/maximize)
- Frameless window (`frame: false` in main process config)
- Three-panel layout
- SVG-based window control buttons for pixel-perfect circles
- Directory hierarchy with collapsible folders in the note list

Electron development checks:
- `npm run typecheck` validates TypeScript in main, preload, and renderer code
- `npm run lint` runs ESLint with `@typescript-eslint/no-explicit-any` set to `error`

The GUI provides a three-panel layout:
- Left: Note list with directory tree (folders are collapsible, notes show document icons)
- Center: Note content with metadata (rendered as styled markdown via TipTap)
- Right: Inline comments panel showing comments with text previews

### Creating Comments in GUI
Users can create comments by highlighting text in the note view:
1. Select text in the note content
2. A tooltip appears above the selection with a "Comment" button
3. Click the button to open a pending comment card in the comments panel
4. Type the comment and press Enter to save (Escape to cancel, Shift+Enter for newlines)

Comments are stored with required text anchors:
- `anchor.exact` - exact selected text
- `anchor.prefix` - surrounding text before the selection
- `anchor.suffix` - surrounding text after the selection

Highlights are resolved from anchors at render time. If an anchor is ambiguous or missing after edits, the comment remains visible in the panel but is not highlighted.

### Deleting Comments in GUI
Users can delete existing comments from the comments panel:
1. Open a note with comments
2. Click the `Delete` button on the comment card you want to remove
3. Confirm the deletion in the prompt

The comment is removed from YAML frontmatter and the note's `updated` timestamp is refreshed.

## Testing Notes

Create notes via stdin for non-interactive testing:
```bash
echo "content" | ./agentnotes add "Title" --tags=test
```

## Edit Command

The `edit` command modifies notes directly from the command line (no editor required).

### Metadata editing
```bash
./agentnotes edit myNote --title "New Title"
./agentnotes edit myNote --add-tags "important,urgent"
./agentnotes edit myNote --remove-tags "draft"
./agentnotes edit myNote --tags "tag1,tag2"  # replaces all tags
./agentnotes edit myNote --priority 5 --source "api"
```

### Content editing
```bash
./agentnotes edit myNote --content "Full replacement"
./agentnotes edit myNote --append "Added to end"
./agentnotes edit myNote --prepend "Added to start"
./agentnotes edit myNote --insert "3:New line here"    # insert at line 3
./agentnotes edit myNote --replace-line "5:Replaced"   # replace line 5
./agentnotes edit myNote --delete-line 4               # delete line 4
echo "New content" | ./agentnotes edit myNote          # via stdin
```

## Comment Command

The `comment` command manages comments on notes. Comments are stored in the note's YAML frontmatter.

### Add comments
```bash
./agentnotes comment add "My Note" "This is a comment"
./agentnotes comment add "My Note" --author=claude "AI comment"
./agentnotes comment add "My Note" "Comment on selected text" --exact="selected text"
echo "comment" | ./agentnotes comment add "My Note" --exact="selected text"
```

### List comments
```bash
./agentnotes comment list "My Note"
./agentnotes comment list "My Note" --limit=5
```

### Delete comments
```bash
./agentnotes comment delete "My Note" <comment-id>
./agentnotes comment delete "My Note" <comment-id> --force
```

### Show note with comments
```bash
./agentnotes show "My Note" --comments
```
