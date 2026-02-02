# AgentNotes

A local-first CLI knowledge base storing markdown notes with YAML frontmatter.

## Project Structure

- `cmd/agentnotes/main.go` - CLI entrypoint
- `internal/notes/model.go` - Note struct, frontmatter parsing/marshaling
- `internal/notes/store.go` - File-based CRUD operations
- `internal/notes/search.go` - Search and filter logic
- `internal/cli/commands.go` - Cobra CLI command implementations
- `internal/cli/display.go` - Terminal formatting with ANSI colors

## Storage

Notes stored in `~/.agentnotes/notes/` as markdown files with format:
```
2024-01-15-slugified-title.md
```

Each note has YAML frontmatter with: id (ULID), title, tags, created, updated, source, priority.

## Build & Run

```bash
go build -o agentnotes ./cmd/agentnotes
./agentnotes --help
```

## Testing Notes

Create notes via stdin for non-interactive testing:
```bash
echo "content" | ./agentnotes add "Title" --tags=test
```
