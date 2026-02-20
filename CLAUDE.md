# AgentNotes

A local-first knowledge base with TypeScript CLI and Electron GUI, storing markdown notes with sidecar JSON metadata.

## Project Structure

This is a pnpm monorepo with three packages:

```
packages/
├── engine/      # Shared TypeScript business logic
├── cli/         # TypeScript CLI
└── electron/    # Electron GUI application
```

### Engine (`@agentnotes/engine`)
Core business logic used by both CLI and Electron:
- `src/types.ts` - All shared types (Note, NoteComment, CommentAnchor, payloads, results)
- `src/comments/` - Comment anchoring, transformation during edits, resolution
- `src/storage/` - Markdown parsing, sidecar JSON read/write, filesystem operations
- `src/notes/` - NoteStore class (central API), search functionality
- `src/utils/` - Slugify, normalization, formatting (toTitleCase), validation

### CLI (`@agentnotes/cli`)
TypeScript CLI built with Commander:
- `src/cli.ts` - Commander setup, store initialization
- `src/commands/` - Individual command implementations
- `src/display/format.ts` - ANSI color formatting
- `src/utils/` - stdin, editor, note resolution utilities

### Electron (`packages/electron`)
GUI application:
- `main.ts` - Electron main process, IPC handlers (thin wrapper around NoteStore)
- `preload.ts` - Context bridge exposing APIs to renderer
- `src/renderer.ts` - Renderer entry point
- `src/types.ts` - Local type definitions for renderer (browser-compatible)
- `src/components/` - UI components (NoteList, NoteView, CommentsPanel)
- `src/lib/browser-utils.ts` - Browser-compatible utilities (toTitleCase, anchoring, highlights)
- `src/lib/noteStore.ts` - IPC caching layer

## Storage

Notes are stored as markdown files with sidecar `.json` files for metadata:
```
notes-directory/
├── 2024-01-15-my-note.md        # Note content
├── 2024-01-15-my-note.md.json   # Metadata (tags, comments, commentRev)
└── projects/
    ├── 2024-02-01-react-guide.md
    └── 2024-02-01-react-guide.md.json
```

The CLI operates in the current working directory. The Electron app lets users select any directory.

## Build & Run

### Install Dependencies
```bash
pnpm install
```

Note: You may need to run the post-install scripts for electron and esbuild:
```bash
node node_modules/.pnpm/electron@28.3.3/node_modules/electron/install.js
node node_modules/.pnpm/esbuild@0.24.2/node_modules/esbuild/install.js
```

### Build All Packages
```bash
pnpm -r build
```

### CLI
```bash
cd packages/cli
pnpm build
node dist/index.js --help
```

CLI commands:
- `agentnotes add <title>` - Create a new note
- `agentnotes list` - List notes (--tags, --limit, --sort)
- `agentnotes show <id-or-title>` - Display a note (--comments)
- `agentnotes search <query>` - Search notes
- `agentnotes edit <id-or-title>` - Edit note content/metadata
- `agentnotes delete <id-or-title>` - Delete a note
- `agentnotes tags` - List all tags with counts
- `agentnotes cat <id-or-title>` - Output raw markdown
- `agentnotes comment add|list|delete` - Manage comments

### GUI (Electron)
```bash
cd packages/electron
pnpm start
```

Development with auto-rebuild:
```bash
cd packages/electron
pnpm dev
```

### Run Tests
```bash
cd packages/engine
pnpm test
```

### Type Checking
```bash
pnpm -r typecheck
```

## Comment System

Comments use deterministic range anchors:
- `anchor.from` / `anchor.to` - Character offsets (0-based, exclusive end)
- `anchor.rev` - Note revision at time of anchoring
- `anchor.startAffinity` / `anchor.endAffinity` - Boundary mapping policy (`before` or `after`)
- `anchor.quote` / `anchor.quoteHash` - Stored quote and FNV-1a hash for integrity checks
- `status` - `attached`, `stale`, or `detached`

On save, edits are converted to text operations and comment ranges are transformed. Comments touching edited text become `stale`; collapsed ranges become `detached`.

## GUI Features

- Custom draggable title bar with macOS-style traffic light buttons
- Three-panel layout: note list, note content (TipTap editor), comments panel
- Directory hierarchy with collapsible folders
- Drag-and-drop note moving
- Text selection creates comments with anchored highlights
- Real-time markdown styling with autosave

## CLI Examples

### Create notes
```bash
echo "# My Note\n\nContent here" | agentnotes add "my-note" --tags=demo
agentnotes add "Interactive Note"  # Opens $EDITOR
```

### Edit notes
```bash
agentnotes edit "my-note" --add-tags "important"
agentnotes edit "my-note" --append "New paragraph"
```

### Comments
```bash
agentnotes comment add "my-note" "Great point!" --exact="specific text"
agentnotes comment list "my-note"
agentnotes show "my-note" --comments
```
