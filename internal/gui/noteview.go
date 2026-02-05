package gui

import (
	"fmt"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// NoteView displays the content and metadata of a selected note
type NoteView struct {
	container          *fyne.Container
	inlineCommentPanel *InlineCommentPanel
	currentNote        *notes.Note

	// Header elements
	titleLabel    *widget.Label
	createdLabel  *widget.Label
	updatedLabel  *widget.Label
	tagsContainer *fyne.Container
	priorityLabel *widget.Label

	// Content area
	contentContainer *fyne.Container

	// Split container for content and inline comments
	contentSplit *container.Split
}

// NewNoteView creates a new note view widget
func NewNoteView() *NoteView {
	nv := &NoteView{}

	// Title
	nv.titleLabel = widget.NewLabel("")
	nv.titleLabel.TextStyle = fyne.TextStyle{Bold: true}
	nv.titleLabel.Wrapping = fyne.TextWrapWord

	// Dates
	nv.createdLabel = widget.NewLabel("")
	nv.updatedLabel = widget.NewLabel("")

	// Tags container
	nv.tagsContainer = container.NewHBox()

	// Priority
	nv.priorityLabel = widget.NewLabel("")

	// Content container (will hold content)
	nv.contentContainer = container.NewVBox()

	// Inline comment panel (right panel) - all comments go here now
	nv.inlineCommentPanel = NewInlineCommentPanel()

	// Build header
	metaRow := container.NewHBox(
		nv.createdLabel,
		widget.NewSeparator(),
		nv.updatedLabel,
	)

	header := container.NewVBox(
		nv.titleLabel,
		metaRow,
		nv.tagsContainer,
		nv.priorityLabel,
		widget.NewSeparator(),
	)

	// Left side: content only (all comments now go to the right panel)
	leftContent := container.NewVBox(
		nv.contentContainer,
	)

	// Scrollable left content
	leftScroll := container.NewVScroll(leftContent)

	// Horizontal split: content on left, comments on right
	nv.contentSplit = container.NewHSplit(leftScroll, nv.inlineCommentPanel.Container())
	nv.contentSplit.SetOffset(0.7) // 70% for content, 30% for comments

	// Main container
	nv.container = container.NewBorder(
		container.NewPadded(header),
		nil, nil, nil,
		container.NewPadded(nv.contentSplit),
	)

	// Show placeholder initially
	nv.SetNote(nil)

	return nv
}

// SetNote updates the view with a new note
func (nv *NoteView) SetNote(note *notes.Note) {
	nv.currentNote = note

	if note == nil {
		nv.titleLabel.SetText("No note selected")
		nv.createdLabel.SetText("")
		nv.updatedLabel.SetText("")
		nv.tagsContainer.Objects = nil
		nv.tagsContainer.Refresh()
		nv.priorityLabel.SetText("")
		placeholder := widget.NewLabel("Select a note from the list to view its contents.")
		placeholder.TextStyle = fyne.TextStyle{Italic: true}
		nv.contentContainer.Objects = []fyne.CanvasObject{placeholder}
		nv.contentContainer.Refresh()
		nv.inlineCommentPanel.SetComments(nil)
		return
	}

	// Update title
	nv.titleLabel.SetText(note.Title)

	// Update dates
	nv.createdLabel.SetText(fmt.Sprintf("Created: %s", note.Created.Format("Jan 2, 2006 3:04 PM")))
	nv.updatedLabel.SetText(fmt.Sprintf("Updated: %s", note.Updated.Format("Jan 2, 2006 3:04 PM")))

	// Update tags
	nv.updateTags(note.Tags)

	// Update priority
	if note.Priority > 0 {
		nv.priorityLabel.SetText(fmt.Sprintf("Priority: %d", note.Priority))
	} else {
		nv.priorityLabel.SetText("")
	}

	// Update comments panel (all comments now have character ranges)
	nv.inlineCommentPanel.SetComments(note.Comments)

	// Render content - use TextGrid with highlighting if there are comments,
	// otherwise use RichText with markdown rendering
	ranges := nv.inlineCommentPanel.GetCommentedRanges()
	if len(ranges) > 0 {
		// Use TextGrid for highlighting (plain text, no markdown)
		textGrid := CreateHighlightedContent(note.Content, ranges)
		nv.contentContainer.Objects = []fyne.CanvasObject{textGrid}
	} else {
		// Use RichText for markdown rendering (no comments)
		richText := widget.NewRichTextFromMarkdown(note.Content)
		richText.Wrapping = fyne.TextWrapWord
		nv.contentContainer.Objects = []fyne.CanvasObject{richText}
	}
	nv.contentContainer.Refresh()
}

// updateTags updates the tags display
func (nv *NoteView) updateTags(tags []string) {
	nv.tagsContainer.Objects = nil

	if len(tags) == 0 {
		nv.tagsContainer.Refresh()
		return
	}

	label := widget.NewLabel("Tags:")
	nv.tagsContainer.Add(label)

	for _, tag := range tags {
		chip := nv.createTagChip(tag)
		nv.tagsContainer.Add(chip)
	}

	nv.tagsContainer.Refresh()
}

// createTagChip creates a chip-style widget for a tag
func (nv *NoteView) createTagChip(tag string) fyne.CanvasObject {
	label := widget.NewLabel(fmt.Sprintf("[%s]", tag))
	label.TextStyle = fyne.TextStyle{Italic: true}
	return label
}

// Container returns the container for embedding in layouts
func (nv *NoteView) Container() *fyne.Container {
	return nv.container
}

// TagChip is a custom widget for displaying tags as chips
type TagChip struct {
	widget.BaseWidget
	text string
}

// NewTagChip creates a new tag chip
func NewTagChip(text string) *TagChip {
	tc := &TagChip{text: text}
	tc.ExtendBaseWidget(tc)
	return tc
}

// CreateRenderer creates the renderer for TagChip
func (tc *TagChip) CreateRenderer() fyne.WidgetRenderer {
	label := widget.NewLabel(tc.text)
	label.TextStyle = fyne.TextStyle{Bold: true}

	bg := &widget.Card{}

	return &tagChipRenderer{
		chip:  tc,
		label: label,
		bg:    bg,
	}
}

type tagChipRenderer struct {
	chip  *TagChip
	label *widget.Label
	bg    *widget.Card
}

func (r *tagChipRenderer) Destroy() {}

func (r *tagChipRenderer) Layout(size fyne.Size) {
	r.label.Resize(size)
}

func (r *tagChipRenderer) MinSize() fyne.Size {
	return r.label.MinSize()
}

func (r *tagChipRenderer) Objects() []fyne.CanvasObject {
	return []fyne.CanvasObject{r.label}
}

func (r *tagChipRenderer) Refresh() {
	r.label.SetText(r.chip.text)
}

// FormatContent formats note content for display
func FormatContent(content string) string {
	// For now, just return as-is (plain text)
	// Could add markdown rendering later
	return strings.TrimSpace(content)
}

// PriorityBadge creates a priority badge widget
func PriorityBadge(priority int) fyne.CanvasObject {
	if priority <= 0 {
		return widget.NewLabel("")
	}

	var icon fyne.Resource
	switch {
	case priority >= 4:
		icon = theme.ErrorIcon()
	case priority >= 2:
		icon = theme.WarningIcon()
	default:
		icon = theme.InfoIcon()
	}

	return container.NewHBox(
		widget.NewIcon(icon),
		widget.NewLabel(fmt.Sprintf("Priority %d", priority)),
	)
}
