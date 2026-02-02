package main

import (
	"fmt"
	"os"

	"github.com/ashleynewman/agentnotes/internal/gui"
	"github.com/ashleynewman/agentnotes/internal/notes"
)

func main() {
	// Initialize the notes store (relative to current directory)
	store, err := notes.NewStore()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing notes store: %v\n", err)
		os.Exit(1)
	}

	// Create and run the GUI application
	app := gui.NewApp(store)
	if err := app.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running application: %v\n", err)
		os.Exit(1)
	}
}
