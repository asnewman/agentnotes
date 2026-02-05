package gui

import (
	"sort"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"github.com/ashleynewman/agentnotes/internal/notes"
)

// App represents the main GUI application
type App struct {
	fyneApp    fyne.App
	mainWindow fyne.Window
	store      *notes.Store
	notes      []*notes.Note
	noteView   *NoteView
}

// NewApp creates a new GUI application
func NewApp(store *notes.Store) *App {
	fyneApp := app.New()
	mainWindow := fyneApp.NewWindow("AgentNotes")

	return &App{
		fyneApp:    fyneApp,
		mainWindow: mainWindow,
		store:      store,
	}
}

// Run starts the GUI application
func (a *App) Run() error {
	// Load notes
	notesList, err := a.store.List()
	if err != nil {
		dialog.ShowError(err, a.mainWindow)
		notesList = []*notes.Note{}
	}

	// Sort by created date (newest first)
	sort.Slice(notesList, func(i, j int) bool {
		return notesList[i].Created.After(notesList[j].Created)
	})
	a.notes = notesList

	// Create NoteView for displaying note content with highlighting
	a.noteView = NewNoteView()

	// Create list widget
	list := widget.NewList(
		func() int {
			return len(a.notes)
		},
		func() fyne.CanvasObject {
			return widget.NewLabel("Note title")
		},
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			label := obj.(*widget.Label)
			label.SetText(a.notes[id].Title)
		},
	)

	// Handle list selection
	list.OnSelected = func(id widget.ListItemID) {
		if id >= 0 && id < len(a.notes) {
			a.noteView.SetNote(a.notes[id])
		}
	}

	// Select first note if available
	if len(a.notes) > 0 {
		a.noteView.SetNote(a.notes[0])
		list.Select(0)
	}

	// Create main layout using NoteView's container
	split := container.NewHSplit(list, a.noteView.Container())
	split.SetOffset(0.2)

	a.mainWindow.SetContent(split)
	a.mainWindow.Resize(fyne.NewSize(1000, 600))
	a.mainWindow.ShowAndRun()

	return nil
}
