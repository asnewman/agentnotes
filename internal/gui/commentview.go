package gui

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// CommentView displays comments for a note
type CommentView struct {
	container *fyne.Container
	comments  []notes.Comment
	header    *widget.Label
	list      *fyne.Container
}

// NewCommentView creates a new comment view widget
func NewCommentView() *CommentView {
	cv := &CommentView{}

	cv.header = widget.NewLabel("Comments (0)")
	cv.header.TextStyle = fyne.TextStyle{Bold: true}

	cv.list = container.NewVBox()

	cv.container = container.NewVBox(
		cv.header,
		cv.list,
	)

	return cv
}

// SetComments updates the view with new comments
func (cv *CommentView) SetComments(comments []notes.Comment) {
	cv.comments = comments
	cv.list.Objects = nil

	if len(comments) == 0 {
		cv.header.SetText("Comments (0)")
		placeholder := widget.NewLabel("No comments")
		placeholder.TextStyle = fyne.TextStyle{Italic: true}
		cv.list.Add(placeholder)
		cv.list.Refresh()
		return
	}

	cv.header.SetText(fmt.Sprintf("Comments (%d)", len(comments)))

	for _, comment := range comments {
		commentWidget := cv.createCommentWidget(comment)
		cv.list.Add(commentWidget)
	}

	cv.list.Refresh()
}

// createCommentWidget creates a widget for displaying a single comment
func (cv *CommentView) createCommentWidget(comment notes.Comment) fyne.CanvasObject {
	// Author and date line
	author := comment.Author
	if author == "" {
		author = "anonymous"
	}

	headerText := fmt.Sprintf("%s - %s", author, comment.Created.Format("Jan 2, 2006 3:04 PM"))
	if comment.Line > 0 {
		headerText += fmt.Sprintf(" (line %d)", comment.Line)
	}

	headerLabel := widget.NewLabel(headerText)
	headerLabel.TextStyle = fyne.TextStyle{Bold: true}

	// Comment content
	contentLabel := widget.NewLabel(comment.Content)
	contentLabel.Wrapping = fyne.TextWrapWord

	// Style based on author
	if author == "claude" || author == "ai" {
		headerLabel.TextStyle.Italic = true
	}

	// Create card-like container
	card := widget.NewCard("", "", container.NewVBox(
		headerLabel,
		contentLabel,
	))

	return card
}

// Container returns the container for embedding in layouts
func (cv *CommentView) Container() *fyne.Container {
	return cv.container
}

// CommentCount returns the number of comments
func (cv *CommentView) CommentCount() int {
	return len(cv.comments)
}
