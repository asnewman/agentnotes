package gui

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// NoteList displays a scrollable list of notes in the sidebar
type NoteList struct {
	list       *widget.List
	notes      []*notes.Note
	onSelected func(index int)
	container  *fyne.Container
}

// NewNoteList creates a new note list widget
func NewNoteList(onSelected func(index int)) *NoteList {
	nl := &NoteList{
		onSelected: onSelected,
	}

	nl.list = widget.NewList(
		func() int {
			return len(nl.notes)
		},
		func() fyne.CanvasObject {
			return nl.createListItem()
		},
		func(id widget.ListItemID, item fyne.CanvasObject) {
			nl.updateListItem(id, item)
		},
	)

	nl.list.OnSelected = func(id widget.ListItemID) {
		if nl.onSelected != nil {
			nl.onSelected(int(id))
		}
	}

	header := widget.NewLabel("Notes")
	header.TextStyle = fyne.TextStyle{Bold: true}

	nl.container = container.NewBorder(
		container.NewPadded(header),
		nil, nil, nil,
		nl.list,
	)

	return nl
}

// SetNotes updates the list with new notes
func (nl *NoteList) SetNotes(notesList []*notes.Note) {
	nl.notes = notesList
	nl.list.Refresh()
}

// Select selects a note at the given index
func (nl *NoteList) Select(index int) {
	nl.list.Select(widget.ListItemID(index))
}

// Container returns the container for embedding in layouts
func (nl *NoteList) Container() *fyne.Container {
	return nl.container
}

// createListItem creates a template for list items
func (nl *NoteList) createListItem() fyne.CanvasObject {
	title := widget.NewLabel("Title")
	title.TextStyle = fyne.TextStyle{Bold: true}
	title.Truncation = fyne.TextTruncateEllipsis

	date := widget.NewLabel("Date")
	date.TextStyle = fyne.TextStyle{Italic: true}

	info := widget.NewLabel("Info")

	return container.NewVBox(
		title,
		date,
		info,
	)
}

// updateListItem updates a list item with note data
func (nl *NoteList) updateListItem(id widget.ListItemID, item fyne.CanvasObject) {
	if int(id) >= len(nl.notes) {
		return
	}

	note := nl.notes[id]
	box := item.(*fyne.Container)
	objects := box.Objects

	// Title
	title := objects[0].(*widget.Label)
	title.SetText(note.Title)

	// Date
	date := objects[1].(*widget.Label)
	date.SetText(note.Created.Format("Jan 2, 2006"))

	// Info (tags and comments count)
	info := objects[2].(*widget.Label)
	tagCount := len(note.Tags)
	commentCount := len(note.Comments)

	infoText := ""
	if tagCount > 0 {
		infoText = fmt.Sprintf("%d tags", tagCount)
	}
	if commentCount > 0 {
		if infoText != "" {
			infoText += " • "
		}
		infoText += fmt.Sprintf("%d comments", commentCount)
	}
	if infoText == "" {
		infoText = "No tags or comments"
	}
	info.SetText(infoText)
}
