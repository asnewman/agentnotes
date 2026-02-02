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

	noteList *NoteList
	noteView *NoteView

	notes []*notes.Note
}

// NewApp creates a new GUI application
func NewApp(store *notes.Store) *App {
	fyneApp := app.New()
	mainWindow := fyneApp.NewWindow("AgentNotes")

	a := &App{
		fyneApp:    fyneApp,
		mainWindow: mainWindow,
		store:      store,
	}

	a.noteList = NewNoteList(a.onNoteSelected)
	a.noteView = NewNoteView()

	return a
}

// Run starts the GUI application
func (a *App) Run() error {
	// Load notes
	if err := a.loadNotes(); err != nil {
		dialog.ShowError(err, a.mainWindow)
	}

	// Create split layout
	split := container.NewHSplit(
		a.noteList.Container(),
		a.noteView.Container(),
	)
	split.SetOffset(0.25) // 25% for note list

	a.mainWindow.SetContent(split)
	a.mainWindow.Resize(fyne.NewSize(1000, 700))
	a.mainWindow.ShowAndRun()

	return nil
}

// loadNotes loads all notes from the store
func (a *App) loadNotes() error {
	notesList, err := a.store.List()
	if err != nil {
		return err
	}

	// Sort by created date (newest first)
	sort.Slice(notesList, func(i, j int) bool {
		return notesList[i].Created.After(notesList[j].Created)
	})

	a.notes = notesList
	a.noteList.SetNotes(notesList)

	// Select first note if available
	if len(notesList) > 0 {
		a.noteView.SetNote(notesList[0])
		a.noteList.Select(0)
	} else {
		a.noteView.SetNote(nil)
	}

	return nil
}

// onNoteSelected handles note selection from the list
func (a *App) onNoteSelected(index int) {
	if index >= 0 && index < len(a.notes) {
		a.noteView.SetNote(a.notes[index])
	}
}

// ShowError displays an error dialog
func (a *App) ShowError(err error) {
	dialog.ShowError(err, a.mainWindow)
}

// Placeholder creates a centered placeholder widget
func Placeholder(text string) *widget.Label {
	label := widget.NewLabel(text)
	label.Alignment = fyne.TextAlignCenter
	return label
}
