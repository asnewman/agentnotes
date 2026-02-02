package gui

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// InlineCommentPanel displays inline comments (comments with line numbers) in a right panel
type InlineCommentPanel struct {
	container *fyne.Container
	comments  []notes.Comment
	header    *widget.Label
	list      *fyne.Container
	scroll    *container.Scroll
}

// NewInlineCommentPanel creates a new inline comment panel
func NewInlineCommentPanel() *InlineCommentPanel {
	icp := &InlineCommentPanel{}

	icp.header = widget.NewLabel("Inline Comments")
	icp.header.TextStyle = fyne.TextStyle{Bold: true}

	icp.list = container.NewVBox()
	icp.scroll = container.NewVScroll(icp.list)

	icp.container = container.NewBorder(
		container.NewVBox(icp.header, widget.NewSeparator()),
		nil, nil, nil,
		icp.scroll,
	)

	return icp
}

// SetComments filters and displays only inline comments (those with line numbers)
func (icp *InlineCommentPanel) SetComments(comments []notes.Comment) {
	// Filter for inline comments only
	icp.comments = nil
	for _, c := range comments {
		if c.Line > 0 {
			icp.comments = append(icp.comments, c)
		}
	}

	icp.list.Objects = nil

	if len(icp.comments) == 0 {
		placeholder := widget.NewLabel("No inline comments")
		placeholder.TextStyle = fyne.TextStyle{Italic: true}
		icp.list.Add(placeholder)
		icp.list.Refresh()
		return
	}

	for _, comment := range icp.comments {
		commentWidget := icp.createCommentWidget(comment)
		icp.list.Add(commentWidget)
	}

	icp.list.Refresh()
}

// createCommentWidget creates a widget for displaying a single inline comment
func (icp *InlineCommentPanel) createCommentWidget(comment notes.Comment) fyne.CanvasObject {
	// Line number badge
	lineLabel := widget.NewLabel(fmt.Sprintf("Line %d", comment.Line))
	lineLabel.TextStyle = fyne.TextStyle{Bold: true, Monospace: true}

	// Author and date
	author := comment.Author
	if author == "" {
		author = "anonymous"
	}
	metaLabel := widget.NewLabel(fmt.Sprintf("%s - %s", author, comment.Created.Format("Jan 2")))
	metaLabel.TextStyle = fyne.TextStyle{Italic: true}

	// Comment content
	contentLabel := widget.NewLabel(comment.Content)
	contentLabel.Wrapping = fyne.TextWrapWord

	// Create card container
	card := widget.NewCard("", "", container.NewVBox(
		container.NewHBox(lineLabel, metaLabel),
		contentLabel,
	))

	return card
}

// Container returns the container for embedding in layouts
func (icp *InlineCommentPanel) Container() *fyne.Container {
	return icp.container
}

// GetCommentedLines returns a map of line numbers that have comments
func (icp *InlineCommentPanel) GetCommentedLines() map[int]bool {
	lines := make(map[int]bool)
	for _, c := range icp.comments {
		if c.Line > 0 {
			lines[c.Line] = true
		}
	}
	return lines
}

// HasInlineComments returns true if there are any inline comments
func (icp *InlineCommentPanel) HasInlineComments() bool {
	return len(icp.comments) > 0
}
