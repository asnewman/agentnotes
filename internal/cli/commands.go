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
		app.commentCmd(),
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
	var showComments bool

	cmd := &cobra.Command{
		Use:   "show <id-or-title>",
		Short: "Display a note's content",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			if showComments && len(note.Comments) > 0 {
				fmt.Print(FormatNoteDetailWithComments(note))
			} else {
				fmt.Print(FormatNoteDetail(note))
			}
			return nil
		},
	}

	cmd.Flags().BoolVar(&showComments, "comments", false, "Show comments inline with content")

	return cmd
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
	var (
		title       string
		tags        string
		addTags     string
		removeTags  string
		content     string
		appendText  string
		prependText string
		insertLine  string
		replaceLine string
		deleteLine  int
		source      string
		priority    int
	)

	cmd := &cobra.Command{
		Use:   "edit <id-or-title> [flags]",
		Short: "Edit a note's metadata or content directly from the command line",
		Long: `Edit a note's metadata or content using flags.

Examples:
  agentnotes edit myNote --title "New Title"
  agentnotes edit myNote --add-tags "important,urgent"
  agentnotes edit myNote --content "Full replacement"
  agentnotes edit myNote --append "Added to end"
  agentnotes edit myNote --insert "3:New line here"
  echo "New content" | agentnotes edit myNote`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			changed := false

			// Check if stdin has data
			stat, _ := os.Stdin.Stat()
			stdinHasData := (stat.Mode() & os.ModeCharDevice) == 0

			// Count content modification flags
			contentFlagsUsed := 0
			if cmd.Flags().Changed("content") {
				contentFlagsUsed++
			}
			if cmd.Flags().Changed("append") {
				contentFlagsUsed++
			}
			if cmd.Flags().Changed("prepend") {
				contentFlagsUsed++
			}
			if cmd.Flags().Changed("insert") {
				contentFlagsUsed++
			}
			if cmd.Flags().Changed("replace-line") {
				contentFlagsUsed++
			}
			if cmd.Flags().Changed("delete-line") {
				contentFlagsUsed++
			}
			if stdinHasData {
				contentFlagsUsed++
			}

			if contentFlagsUsed > 1 {
				return fmt.Errorf("content flags are mutually exclusive: use only one of --content, --append, --prepend, --insert, --replace-line, --delete-line, or stdin")
			}

			// Check tags mutual exclusivity
			if cmd.Flags().Changed("tags") && (cmd.Flags().Changed("add-tags") || cmd.Flags().Changed("remove-tags")) {
				return fmt.Errorf("--tags is mutually exclusive with --add-tags and --remove-tags")
			}

			// Apply title change
			if cmd.Flags().Changed("title") {
				if strings.TrimSpace(title) == "" {
					return fmt.Errorf("title cannot be empty")
				}
				note.Title = title
				changed = true
			}

			// Apply tag changes
			if cmd.Flags().Changed("tags") {
				note.Tags = parseTags(tags)
				changed = true
			}
			if cmd.Flags().Changed("add-tags") {
				note.Tags = addTagsToList(note.Tags, parseTags(addTags))
				changed = true
			}
			if cmd.Flags().Changed("remove-tags") {
				note.Tags = removeTagsFromList(note.Tags, parseTags(removeTags))
				changed = true
			}

			// Apply source change
			if cmd.Flags().Changed("source") {
				note.Source = source
				changed = true
			}

			// Apply priority change
			if cmd.Flags().Changed("priority") {
				if priority < -1 || priority > 10 {
					return fmt.Errorf("priority must be between 0 and 10 (or -1 to clear)")
				}
				if priority == -1 {
					note.Priority = 0
				} else {
					note.Priority = priority
				}
				changed = true
			}

			// Apply content changes
			if stdinHasData {
				scanner := bufio.NewScanner(os.Stdin)
				var contentBuilder strings.Builder
				for scanner.Scan() {
					contentBuilder.WriteString(scanner.Text())
					contentBuilder.WriteString("\n")
				}
				note.Content = strings.TrimRight(contentBuilder.String(), "\n")
				changed = true
			} else if cmd.Flags().Changed("content") {
				note.Content = content
				changed = true
			} else if cmd.Flags().Changed("append") {
				if note.Content == "" {
					note.Content = appendText
				} else {
					note.Content = note.Content + "\n" + appendText
				}
				changed = true
			} else if cmd.Flags().Changed("prepend") {
				if note.Content == "" {
					note.Content = prependText
				} else {
					note.Content = prependText + "\n" + note.Content
				}
				changed = true
			} else if cmd.Flags().Changed("insert") {
				lineNum, text, err := parseLineEdit(insertLine)
				if err != nil {
					return fmt.Errorf("invalid --insert format: %w", err)
				}
				newContent, err := insertLineInContent(note.Content, lineNum, text)
				if err != nil {
					return err
				}
				note.Content = newContent
				changed = true
			} else if cmd.Flags().Changed("replace-line") {
				lineNum, text, err := parseLineEdit(replaceLine)
				if err != nil {
					return fmt.Errorf("invalid --replace-line format: %w", err)
				}
				newContent, err := replaceLineInContent(note.Content, lineNum, text)
				if err != nil {
					return err
				}
				note.Content = newContent
				changed = true
			} else if cmd.Flags().Changed("delete-line") {
				newContent, err := deleteLineInContent(note.Content, deleteLine)
				if err != nil {
					return err
				}
				note.Content = newContent
				changed = true
			}

			// Check if any changes were made
			if !changed {
				return fmt.Errorf("no changes specified. Use flags to modify the note.\nRun 'agentnotes edit --help' for usage")
			}

			// Update timestamp and save
			note.Updated = time.Now().UTC()
			if err := app.Store.Update(note); err != nil {
				return err
			}

			fmt.Println(Success(fmt.Sprintf("Updated note: %s", note.Title)))
			return nil
		},
	}

	// Metadata flags
	cmd.Flags().StringVarP(&title, "title", "t", "", "Set new title")
	cmd.Flags().StringVar(&tags, "tags", "", "Replace all tags (comma-separated)")
	cmd.Flags().StringVarP(&addTags, "add-tags", "a", "", "Add tags (comma-separated)")
	cmd.Flags().StringVarP(&removeTags, "remove-tags", "r", "", "Remove tags (comma-separated)")
	cmd.Flags().StringVarP(&source, "source", "s", "", "Set source field")
	cmd.Flags().IntVarP(&priority, "priority", "p", 0, "Set priority (0-10, or -1 to clear)")

	// Content flags
	cmd.Flags().StringVarP(&content, "content", "c", "", "Replace entire content")
	cmd.Flags().StringVar(&appendText, "append", "", "Append text to end of content")
	cmd.Flags().StringVar(&prependText, "prepend", "", "Prepend text to start of content")
	cmd.Flags().StringVar(&insertLine, "insert", "", "Insert text at line (format: \"LINE:text\")")
	cmd.Flags().StringVar(&replaceLine, "replace-line", "", "Replace line (format: \"LINE:text\")")
	cmd.Flags().IntVar(&deleteLine, "delete-line", 0, "Delete specific line number")

	return cmd
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

// commentCmd creates the comment parent command
func (app *App) commentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "comment",
		Short: "Manage comments on notes",
		Long:  "Add, list, and delete comments on notes.",
	}

	cmd.AddCommand(
		app.commentAddCmd(),
		app.commentListCmd(),
		app.commentDeleteCmd(),
	)

	return cmd
}

// commentAddCmd creates the comment add subcommand
func (app *App) commentAddCmd() *cobra.Command {
	var author string
	var line int

	cmd := &cobra.Command{
		Use:   "add <note> [comment]",
		Short: "Add a comment to a note",
		Long: `Add a comment to a note. The comment can be provided as an argument or via stdin.

Examples:
  agentnotes comment add "My Note" "This is a comment"
  agentnotes comment add "My Note" --author=claude "AI comment"
  agentnotes comment add "My Note" "Comment on line 5" --line=5
  echo "comment" | agentnotes comment add "My Note"`,
		Args: cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			noteID := args[0]

			var content string

			// Check if comment is provided as argument
			if len(args) > 1 {
				content = args[1]
			} else {
				// Check if stdin has data
				stat, _ := os.Stdin.Stat()
				if (stat.Mode() & os.ModeCharDevice) == 0 {
					// Reading from pipe/stdin
					scanner := bufio.NewScanner(os.Stdin)
					var sb strings.Builder
					for scanner.Scan() {
						if sb.Len() > 0 {
							sb.WriteString("\n")
						}
						sb.WriteString(scanner.Text())
					}
					content = sb.String()
				} else {
					return fmt.Errorf("comment text is required (provide as argument or via stdin)")
				}
			}

			if strings.TrimSpace(content) == "" {
				return fmt.Errorf("comment cannot be empty")
			}

			note, comment, err := app.Store.AddComment(noteID, content, author, line)
			if err != nil {
				return err
			}

			if line > 0 {
				fmt.Println(Success(fmt.Sprintf("Added comment [%s] to '%s' at line %d", comment.ID[:8], note.Title, line)))
			} else {
				fmt.Println(Success(fmt.Sprintf("Added comment [%s] to '%s'", comment.ID[:8], note.Title)))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&author, "author", "", "Comment author (e.g., 'user', 'claude')")
	cmd.Flags().IntVar(&line, "line", 0, "Line number this comment refers to")

	return cmd
}

// commentListCmd creates the comment list subcommand
func (app *App) commentListCmd() *cobra.Command {
	var limit int

	cmd := &cobra.Command{
		Use:   "list <note>",
		Short: "List comments on a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			note, err := app.Store.Get(args[0])
			if err != nil {
				return err
			}

			comments := note.Comments
			if limit > 0 && len(comments) > limit {
				comments = comments[:limit]
			}

			fmt.Printf(Dim+"Comments on '%s':\n\n"+Reset, note.Title)
			fmt.Print(FormatCommentList(comments))
			return nil
		},
	}

	cmd.Flags().IntVar(&limit, "limit", 0, "Maximum number of comments to show (0 = all)")

	return cmd
}

// commentDeleteCmd creates the comment delete subcommand
func (app *App) commentDeleteCmd() *cobra.Command {
	var force bool

	cmd := &cobra.Command{
		Use:   "delete <note> <comment-id>",
		Short: "Delete a comment from a note",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			noteID := args[0]
			commentID := args[1]

			// Get the note to find the comment
			note, err := app.Store.Get(noteID)
			if err != nil {
				return err
			}

			// Find the comment
			var targetComment *notes.Comment
			for _, c := range note.Comments {
				if strings.HasPrefix(c.ID, commentID) {
					targetComment = &c
					break
				}
			}

			if targetComment == nil {
				return fmt.Errorf("comment not found: %s", commentID)
			}

			if !force {
				preview := targetComment.Content
				if len(preview) > 50 {
					preview = preview[:50] + "..."
				}
				fmt.Printf("Delete comment '%s' from '%s'? [y/N] ", preview, note.Title)
				reader := bufio.NewReader(os.Stdin)
				response, _ := reader.ReadString('\n')
				response = strings.TrimSpace(strings.ToLower(response))

				if response != "y" && response != "yes" {
					fmt.Println("Cancelled.")
					return nil
				}
			}

			if err := app.Store.DeleteComment(note.ID, targetComment.ID); err != nil {
				return err
			}

			fmt.Println(Success(fmt.Sprintf("Deleted comment [%s] from '%s'", targetComment.ID[:8], note.Title)))
			return nil
		},
	}

	cmd.Flags().BoolVarP(&force, "force", "f", false, "Skip confirmation prompt")

	return cmd
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

// parseTags splits a comma-separated tag string into a slice
func parseTags(tagStr string) []string {
	if tagStr == "" {
		return nil
	}
	tags := strings.Split(tagStr, ",")
	result := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t != "" {
			result = append(result, t)
		}
	}
	return result
}

// addTagsToList adds tags to an existing list without duplicates (case-insensitive)
func addTagsToList(existing, toAdd []string) []string {
	result := make([]string, len(existing))
	copy(result, existing)

	for _, newTag := range toAdd {
		found := false
		for _, existingTag := range result {
			if strings.EqualFold(existingTag, newTag) {
				found = true
				break
			}
		}
		if !found {
			result = append(result, newTag)
		}
	}
	return result
}

// removeTagsFromList removes tags from an existing list (case-insensitive)
func removeTagsFromList(existing, toRemove []string) []string {
	result := make([]string, 0, len(existing))
	for _, existingTag := range existing {
		shouldRemove := false
		for _, removeTag := range toRemove {
			if strings.EqualFold(existingTag, removeTag) {
				shouldRemove = true
				break
			}
		}
		if !shouldRemove {
			result = append(result, existingTag)
		}
	}
	return result
}

// parseLineEdit parses a "LINE:text" format string
func parseLineEdit(input string) (int, string, error) {
	parts := strings.SplitN(input, ":", 2)
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("expected format \"LINE:text\", got %q", input)
	}

	var lineNum int
	if _, err := fmt.Sscanf(parts[0], "%d", &lineNum); err != nil {
		return 0, "", fmt.Errorf("invalid line number %q", parts[0])
	}

	if lineNum < 1 {
		return 0, "", fmt.Errorf("line number must be at least 1")
	}

	return lineNum, parts[1], nil
}

// insertLineInContent inserts text at a specific line number (1-based)
func insertLineInContent(content string, lineNum int, text string) (string, error) {
	lines := strings.Split(content, "\n")

	// Allow inserting at line after the last line (appending)
	if lineNum > len(lines)+1 {
		return "", fmt.Errorf("line %d is out of range (content has %d lines)", lineNum, len(lines))
	}

	// Insert at position lineNum-1 (0-based index)
	idx := lineNum - 1
	newLines := make([]string, 0, len(lines)+1)
	newLines = append(newLines, lines[:idx]...)
	newLines = append(newLines, text)
	newLines = append(newLines, lines[idx:]...)

	return strings.Join(newLines, "\n"), nil
}

// replaceLineInContent replaces a specific line (1-based)
func replaceLineInContent(content string, lineNum int, text string) (string, error) {
	lines := strings.Split(content, "\n")

	if lineNum < 1 || lineNum > len(lines) {
		return "", fmt.Errorf("line %d is out of range (content has %d lines)", lineNum, len(lines))
	}

	lines[lineNum-1] = text
	return strings.Join(lines, "\n"), nil
}

// deleteLineInContent deletes a specific line (1-based)
func deleteLineInContent(content string, lineNum int) (string, error) {
	lines := strings.Split(content, "\n")

	if lineNum < 1 || lineNum > len(lines) {
		return "", fmt.Errorf("line %d is out of range (content has %d lines)", lineNum, len(lines))
	}

	newLines := make([]string, 0, len(lines)-1)
	newLines = append(newLines, lines[:lineNum-1]...)
	newLines = append(newLines, lines[lineNum:]...)

	return strings.Join(newLines, "\n"), nil
}
