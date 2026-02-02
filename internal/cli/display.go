package cli

import (
	"fmt"
	"strings"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// ANSI color codes
const (
	Reset      = "\033[0m"
	Bold       = "\033[1m"
	Dim        = "\033[2m"
	Cyan       = "\033[36m"
	Green      = "\033[32m"
	Yellow     = "\033[33m"
	Blue       = "\033[34m"
	Magenta    = "\033[35m"
	BoldCyan   = "\033[1;36m"
	BoldGreen  = "\033[1;32m"
	BoldYellow = "\033[1;33m"
)

// FormatNoteList formats a list of notes for terminal display
func FormatNoteList(noteList []*notes.Note) string {
	if len(noteList) == 0 {
		return Dim + "No notes found." + Reset
	}

	var sb strings.Builder

	for i, note := range noteList {
		if i > 0 {
			sb.WriteString("\n")
		}

		// Title and ID
		sb.WriteString(BoldCyan + note.Title + Reset)
		sb.WriteString(Dim + " [" + note.ID[:8] + "...]" + Reset)
		sb.WriteString("\n")

		// Date and priority
		sb.WriteString(Dim + "  " + note.Created.Format("2006-01-02 15:04") + Reset)
		if note.Priority > 0 {
			sb.WriteString(Yellow + fmt.Sprintf(" (priority: %d)", note.Priority) + Reset)
		}
		sb.WriteString("\n")

		// Tags
		if len(note.Tags) > 0 {
			sb.WriteString("  ")
			for j, tag := range note.Tags {
				if j > 0 {
					sb.WriteString(" ")
				}
				sb.WriteString(Green + "#" + tag + Reset)
			}
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

// FormatNoteDetail formats a single note for detailed display
func FormatNoteDetail(note *notes.Note) string {
	var sb strings.Builder

	// Header
	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)
	sb.WriteString(BoldCyan + note.Title + Reset + "\n")
	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)

	// Metadata
	sb.WriteString(Dim + "ID:       " + Reset + note.ID + "\n")
	sb.WriteString(Dim + "Created:  " + Reset + note.Created.Format("2006-01-02 15:04:05 MST") + "\n")
	sb.WriteString(Dim + "Updated:  " + Reset + note.Updated.Format("2006-01-02 15:04:05 MST") + "\n")

	if note.Priority > 0 {
		sb.WriteString(Dim + "Priority: " + Reset + fmt.Sprintf("%d", note.Priority) + "\n")
	}

	if len(note.Tags) > 0 {
		sb.WriteString(Dim + "Tags:     " + Reset)
		for i, tag := range note.Tags {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(Green + tag + Reset)
		}
		sb.WriteString("\n")
	}

	if len(note.Comments) > 0 {
		sb.WriteString(Dim + "Comments: " + Reset + fmt.Sprintf("%d", len(note.Comments)) + "\n")
	}

	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)

	// Content
	sb.WriteString("\n")
	sb.WriteString(note.Content)
	sb.WriteString("\n")

	return sb.String()
}

// FormatNoteDetailWithComments formats a note with inline comments
func FormatNoteDetailWithComments(note *notes.Note) string {
	var sb strings.Builder

	// Header
	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)
	sb.WriteString(BoldCyan + note.Title + Reset + "\n")
	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)

	// Metadata
	sb.WriteString(Dim + "ID:       " + Reset + note.ID + "\n")
	sb.WriteString(Dim + "Created:  " + Reset + note.Created.Format("2006-01-02 15:04:05 MST") + "\n")
	sb.WriteString(Dim + "Updated:  " + Reset + note.Updated.Format("2006-01-02 15:04:05 MST") + "\n")

	if note.Priority > 0 {
		sb.WriteString(Dim + "Priority: " + Reset + fmt.Sprintf("%d", note.Priority) + "\n")
	}

	if len(note.Tags) > 0 {
		sb.WriteString(Dim + "Tags:     " + Reset)
		for i, tag := range note.Tags {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(Green + tag + Reset)
		}
		sb.WriteString("\n")
	}

	sb.WriteString(Dim + "Comments: " + Reset + fmt.Sprintf("%d", len(note.Comments)) + "\n")

	sb.WriteString(Bold + "─────────────────────────────────────────────\n" + Reset)

	// Content with inline comments
	sb.WriteString("\n")
	sb.WriteString(FormatCommentsInline(note.Content, note.Comments))
	sb.WriteString("\n")

	return sb.String()
}

// FormatTags formats a list of tags with counts
func FormatTags(tags []notes.TagCount) string {
	if len(tags) == 0 {
		return Dim + "No tags found." + Reset
	}

	var sb strings.Builder

	sb.WriteString(Bold + "Tags:\n" + Reset)

	for _, tc := range tags {
		sb.WriteString(fmt.Sprintf("  %s%-20s%s %s(%d)%s\n",
			Green, "#"+tc.Tag, Reset,
			Dim, tc.Count, Reset))
	}

	return sb.String()
}

// Success prints a success message
func Success(msg string) string {
	return BoldGreen + "✓ " + Reset + msg
}

// Error prints an error message
func Error(msg string) string {
	return "\033[1;31m✗ " + Reset + msg
}

// Info prints an info message
func Info(msg string) string {
	return Cyan + "ℹ " + Reset + msg
}

// FormatCommentList formats a list of comments for terminal display
func FormatCommentList(comments []notes.Comment) string {
	if len(comments) == 0 {
		return Dim + "No comments." + Reset
	}

	var sb strings.Builder

	for i, c := range comments {
		if i > 0 {
			sb.WriteString("\n")
		}

		// Comment ID and author
		sb.WriteString(BoldYellow + "[" + c.ID[:8] + "...]" + Reset)
		if c.Author != "" {
			sb.WriteString(Dim + " by " + Reset + Magenta + c.Author + Reset)
		}
		if c.Line > 0 {
			sb.WriteString(Dim + fmt.Sprintf(" (line %d)", c.Line) + Reset)
		}
		sb.WriteString("\n")

		// Date
		sb.WriteString(Dim + "  " + c.Created.Format("2006-01-02 15:04") + Reset)
		sb.WriteString("\n")

		// Content
		sb.WriteString("  " + c.Content + "\n")
	}

	return sb.String()
}

// FormatCommentsInline formats comments inline with note content for show --comments
func FormatCommentsInline(content string, comments []notes.Comment) string {
	if len(comments) == 0 {
		return content
	}

	// Build a map of line numbers to comments
	lineComments := make(map[int][]notes.Comment)
	var generalComments []notes.Comment

	for _, c := range comments {
		if c.Line > 0 {
			lineComments[c.Line] = append(lineComments[c.Line], c)
		} else {
			generalComments = append(generalComments, c)
		}
	}

	lines := strings.Split(content, "\n")
	var sb strings.Builder

	// Add each line with any inline comments
	for i, line := range lines {
		lineNum := i + 1
		sb.WriteString(line)
		sb.WriteString("\n")

		// Check for comments on this line
		if commentsOnLine, ok := lineComments[lineNum]; ok {
			for _, c := range commentsOnLine {
				sb.WriteString(Yellow + "  ┃ " + Reset)
				if c.Author != "" {
					sb.WriteString(Magenta + c.Author + Reset + ": ")
				}
				sb.WriteString(Dim + c.Content + Reset)
				sb.WriteString(Dim + " [" + c.ID[:8] + "]" + Reset)
				sb.WriteString("\n")
			}
		}
	}

	// Add general comments at the end
	if len(generalComments) > 0 {
		sb.WriteString("\n" + Bold + "─────────────────────────────────────────────\n" + Reset)
		sb.WriteString(Bold + "Comments:\n" + Reset)
		for _, c := range generalComments {
			sb.WriteString(Yellow + "• " + Reset)
			if c.Author != "" {
				sb.WriteString(Magenta + c.Author + Reset + ": ")
			}
			sb.WriteString(c.Content)
			sb.WriteString(Dim + " [" + c.ID[:8] + "]" + Reset)
			sb.WriteString("\n")
		}
	}

	return strings.TrimRight(sb.String(), "\n")
}
