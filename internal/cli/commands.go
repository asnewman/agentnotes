package cli

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/ashleynewman/agentnotes/internal/notes"
	"github.com/spf13/cobra"
)

// App holds the application state
type App struct {
	Store *notes.Store
}

// NewApp creates a new App instance
func NewApp() (*App, error) {
	store, err := notes.NewStore()
	if err != nil {
		return nil, err
	}

	return &App{Store: store}, nil
}

// RootCmd returns the root cobra command
func (app *App) RootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "agentnotes",
		Short: "A local-first knowledge base with CLI interface",
		Long: `AgentNotes is a local-first knowledge base with CLI interface.
All notes are stored as markdown files with YAML frontmatter for metadata.
Simple, portable, human and AI-agent readable.`,
	}

	rootCmd.AddCommand(
		app.addCmd(),
		app.listCmd(),
		app.showCmd(),
		app.searchCmd(),
		app.editCmd(),
		app.deleteCmd(),
		app.tagsCmd(),
		app.catCmd(),
	)

	return rootCmd
}

// addCmd creates the add command
func (app *App) addCmd() *cobra.Command {
	var tags string
	var priority int

	cmd := &cobra.Command{
		Use:   "add <title>",
		Short: "Create a new note",
		Long:  "Create a new note. Opens $EDITOR or accepts stdin.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			title := args[0]

			var tagList []string
			if tags != "" {
				tagList = strings.Split(tags, ",")
				for i := range tagList {
					tagList[i] = strings.TrimSpace(tagList[i])
				}
			}

			note := notes.NewNote(title, tagList, priority)

			// Check if stdin has data
			stat, _ := os.Stdin.Stat()
			if (stat.Mode() & os.ModeCharDevice) == 0 {
				// Reading from pipe/stdin
				scanner := bufio.NewScanner(os.Stdin)
				var content strings.Builder
				content.WriteString(fmt.Sprintf("# %s\n\n", title))
				for scanner.Scan() {
					content.WriteString(scanner.Text())
					content.WriteString("\n")
				}
				note.Content = strings.TrimRight(content.String(), "\n")
			} else {
				// Open editor
				content, err := openEditor(note.Content)
				if err != nil {
					return fmt.Errorf("failed to open editor: %w", err)
				}
				note.Content = content
			}

			if err := app.Store.Create(note); err != nil {
				return err
			}

			fmt.Println(Success(fmt.Sprintf("Created note: %s [%s]", note.Title, note.ID[:8])))
			return nil
		},
	}

	cmd.Flags().StringVar(&tags, "tags", "", "Comma-separated list of tags")
	cmd.Flags().IntVar(&priority, "priority", 0, "Note priority (1-10)")

	return cmd
}

// listCmd creates the list command
func (app *App) listCmd() *cobra.Command {
	var tags string
	var limit int
	var sortBy string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List notes with optional filters",
		RunE: func(cmd *cobra.Command, args []string) error {
			allNotes, err := app.Store.List()
			if err != nil {
				return err
			}

			var tagList []string
			if tags != "" {
				tagList = strings.Split(tags, ",")
				for i := range tagList {
					tagList[i] = strings.TrimSpace(tagList[i])
				}
			}

			opts := notes.SearchOptions{
				Tags:   tagList,
				Limit:  limit,
				SortBy: notes.SortField(sortBy),
			}

			filtered := notes.Search(allNotes, opts)
			fmt.Print(FormatNoteList(filtered))
			return nil
		},
	}

	cmd.Flags().StringVar(&tags, "tags", "", "Filter by tags (comma-separated)")
	cmd.Flags().IntVar(&limit, "limit", 20, "Maximum number of notes to show")
	cmd.Flags().StringVar(&sortBy, "sort", "created", "Sort by: created, updated, priority, title")

	return cmd
}

// showCmd creates the show command
func (app *App) showCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "show <id-or-title>",
		Short: "Display a note's content",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			fmt.Print(FormatNoteDetail(note))
			return nil
		},
	}
}

// searchCmd creates the search command
func (app *App) searchCmd() *cobra.Command {
	var tags string
	var limit int

	cmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Full-text search across all notes",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			allNotes, err := app.Store.List()
			if err != nil {
				return err
			}

			var tagList []string
			if tags != "" {
				tagList = strings.Split(tags, ",")
				for i := range tagList {
					tagList[i] = strings.TrimSpace(tagList[i])
				}
			}

			opts := notes.SearchOptions{
				Query:  args[0],
				Tags:   tagList,
				Limit:  limit,
				SortBy: notes.SortByUpdated,
			}

			results := notes.Search(allNotes, opts)

			if len(results) == 0 {
				fmt.Println(Info(fmt.Sprintf("No notes found matching '%s'", args[0])))
				return nil
			}

			fmt.Printf(Dim+"Found %d note(s):\n\n"+Reset, len(results))
			fmt.Print(FormatNoteList(results))
			return nil
		},
	}

	cmd.Flags().StringVar(&tags, "tags", "", "Filter by tags (comma-separated)")
	cmd.Flags().IntVar(&limit, "limit", 10, "Maximum number of results")

	return cmd
}

// editCmd creates the edit command
func (app *App) editCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "edit <id-or-title>",
		Short: "Edit a note in $EDITOR",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			// Get the file path
			path, err := app.Store.GetPath(args[0])
			if err != nil {
				return err
			}

			// Open in editor
			editor := os.Getenv("EDITOR")
			if editor == "" {
				editor = "vi"
			}

			editorCmd := exec.Command(editor, path)
			editorCmd.Stdin = os.Stdin
			editorCmd.Stdout = os.Stdout
			editorCmd.Stderr = os.Stderr

			if err := editorCmd.Run(); err != nil {
				return fmt.Errorf("editor failed: %w", err)
			}

			// Re-read the note to get updated content
			updatedNote, err := app.Store.Get(note.ID)
			if err != nil {
				return err
			}

			// Update the updated timestamp
			updatedNote.Updated = time.Now().UTC()
			if err := app.Store.Update(updatedNote); err != nil {
				return err
			}

			fmt.Println(Success(fmt.Sprintf("Updated note: %s", note.Title)))
			return nil
		},
	}
}

// deleteCmd creates the delete command
func (app *App) deleteCmd() *cobra.Command {
	var force bool

	cmd := &cobra.Command{
		Use:   "delete <id-or-title>",
		Short: "Delete a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			if !force {
				fmt.Printf("Are you sure you want to delete '%s'? [y/N] ", note.Title)
				reader := bufio.NewReader(os.Stdin)
				response, _ := reader.ReadString('\n')
				response = strings.TrimSpace(strings.ToLower(response))

				if response != "y" && response != "yes" {
					fmt.Println("Cancelled.")
					return nil
				}
			}

			if err := app.Store.Delete(note.ID); err != nil {
				return err
			}

			fmt.Println(Success(fmt.Sprintf("Deleted note: %s", note.Title)))
			return nil
		},
	}

	cmd.Flags().BoolVarP(&force, "force", "f", false, "Skip confirmation prompt")

	return cmd
}

// tagsCmd creates the tags command
func (app *App) tagsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tags",
		Short: "List all tags with counts",
		RunE: func(cmd *cobra.Command, args []string) error {
			allNotes, err := app.Store.List()
			if err != nil {
				return err
			}

			tags := notes.GetSortedTags(allNotes)
			fmt.Print(FormatTags(tags))
			return nil
		},
	}
}

// catCmd creates the cat command
func (app *App) catCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "cat <id-or-title>",
		Short: "Output raw markdown (for piping to other tools/agents)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			data, err := note.Marshal()
			if err != nil {
				return err
			}

			fmt.Print(string(data))
			return nil
		},
	}
}

// openEditor opens the user's preferred editor with the given content
func openEditor(initialContent string) (string, error) {
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "vi"
	}

	// Create a temporary file
	tmpfile, err := os.CreateTemp("", "agentnotes-*.md")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmpfile.Name())

	// Write initial content
	if _, err := tmpfile.WriteString(initialContent); err != nil {
		return "", err
	}
	if err := tmpfile.Close(); err != nil {
		return "", err
	}

	// Open editor
	cmd := exec.Command(editor, tmpfile.Name())
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return "", err
	}

	// Read the edited content
	content, err := os.ReadFile(tmpfile.Name())
	if err != nil {
		return "", err
	}

	return strings.TrimRight(string(content), "\n"), nil
}
