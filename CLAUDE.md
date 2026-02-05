# AgentNotes

A local-first CLI knowledge base storing markdown notes with YAML frontmatter.

## Project Structure

- `cmd/agentnotes/main.go` - CLI entrypoint
- `cmd/agentnotes-gui/main.go` - GUI entrypoint (Fyne)
- `internal/notes/model.go` - Note struct, frontmatter parsing/marshaling
- `internal/notes/store.go` - File-based CRUD operations
- `internal/notes/search.go` - Search and filter logic
- `internal/cli/commands.go` - Cobra CLI command implementations
- `internal/cli/display.go` - Terminal formatting with ANSI colors
- `internal/gui/app.go` - Fyne app setup and main window
- `internal/gui/notelist.go` - Left sidebar with scrollable note list
- `internal/gui/noteview.go` - Main panel with content and inline comments split
- `internal/gui/commentview.go` - General comment display (non-inline comments)
- `internal/gui/inlinecomments.go` - Right panel for inline comments (with line numbers)
- `internal/gui/linecontent.go` - Line content utilities (legacy, unused)
- `electron/` - Electron-based GUI application
  - `main.js` - Electron main process, window creation, IPC handlers
  - `preload.js` - Context bridge exposing APIs to renderer
  - `src/renderer.js` - Renderer entry point, component initialization
  - `src/index.html` - Main HTML with custom title bar
  - `src/styles/main.css` - Core styles including title bar
  - `src/styles/components.css` - Component-specific styles
  - `src/components/` - UI components (NoteList, NoteView, CommentsPanel)
  - `src/lib/` - Utilities (noteStore, markdown renderer)

## Storage

Notes stored in `.agentnotes/notes/` (relative to current working directory) as markdown files with format:
```
2024-01-15-slugified-title.md
```

Each note has YAML frontmatter with: id (ULID), title, tags, created, updated, source, priority, comments.

The CLI operates relative to the current working directory - each project can have its own independent notes.

## Build & Run

### CLI
```bash
go build -o agentnotes ./cmd/agentnotes
./agentnotes --help
```

### GUI (Fyne)
```bash
go build -o agentnotes-gui ./cmd/agentnotes-gui
./agentnotes-gui
```

### GUI (Electron)
```bash
cd electron
npm install
npm start
```

The Electron app features:
- Custom draggable title bar with macOS-style traffic light buttons (close/minimize/maximize)
- Frameless window (`frame: false` in main.js)
- Three-panel layout matching the Fyne GUI
- SVG-based window control buttons for pixel-perfect circles

Both GUIs provide a read-only view of notes with a three-panel layout:
- Left: Note list
- Center: Note content with metadata (rendered as styled markdown)
- Right: Inline comments panel showing comments with line references

General comments (without line numbers) appear below the note content.

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
./agentnotes comment add "My Note" "Comment on line 5" --line=5
echo "comment" | ./agentnotes comment add "My Note"
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
