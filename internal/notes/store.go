package notes

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Store handles file-based note storage
type Store struct {
	basePath  string
	notesPath string
}

// NewStore creates a new Store with the default base path (.agentnotes in current directory)
func NewStore() (*Store, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get current directory: %w", err)
	}

	basePath := filepath.Join(cwd, ".agentnotes")
	return NewStoreWithPath(basePath)
}

// NewStoreWithPath creates a new Store with a custom base path
func NewStoreWithPath(basePath string) (*Store, error) {
	notesPath := filepath.Join(basePath, "notes")

	// Create directories if they don't exist
	if err := os.MkdirAll(notesPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create notes directory: %w", err)
	}

	return &Store{
		basePath:  basePath,
		notesPath: notesPath,
	}, nil
}

// Create saves a new note to disk
func (s *Store) Create(note *Note) error {
	filename := note.Filename()
	path := filepath.Join(s.notesPath, filename)

	// Check if file already exists
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("note already exists: %s", filename)
	}

	return s.writeNote(path, note)
}

// Update saves changes to an existing note
func (s *Store) Update(note *Note) error {
	// Find the existing file for this note
	path, err := s.findNotePath(note.ID)
	if err != nil {
		return err
	}

	return s.writeNote(path, note)
}

// Save creates or updates a note
func (s *Store) Save(note *Note) error {
	path, err := s.findNotePath(note.ID)
	if err != nil {
		// Note doesn't exist, create it
		return s.Create(note)
	}
	return s.writeNote(path, note)
}

// Get retrieves a note by ID or title
func (s *Store) Get(idOrTitle string) (*Note, error) {
	notes, err := s.List()
	if err != nil {
		return nil, err
	}

	idOrTitle = strings.ToLower(idOrTitle)

	for _, note := range notes {
		// Match by ID (case-insensitive prefix match)
		if strings.HasPrefix(strings.ToLower(note.ID), idOrTitle) {
			return note, nil
		}

		// Match by title slug
		slug := slugify(note.Title)
		if strings.Contains(slug, idOrTitle) {
			return note, nil
		}

		// Match by title (case-insensitive)
		if strings.Contains(strings.ToLower(note.Title), idOrTitle) {
			return note, nil
		}
	}

	return nil, fmt.Errorf("note not found: %s", idOrTitle)
}

// Delete removes a note by ID or title
func (s *Store) Delete(idOrTitle string) error {
	note, err := s.Get(idOrTitle)
	if err != nil {
		return err
	}

	path, err := s.findNotePath(note.ID)
	if err != nil {
		return err
	}

	return os.Remove(path)
}

// List returns all notes
func (s *Store) List() ([]*Note, error) {
	entries, err := os.ReadDir(s.notesPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read notes directory: %w", err)
	}

	var notes []*Note
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		path := filepath.Join(s.notesPath, entry.Name())
		note, err := s.readNote(path)
		if err != nil {
			// Skip invalid notes but log the error
			fmt.Fprintf(os.Stderr, "Warning: skipping invalid note %s: %v\n", entry.Name(), err)
			continue
		}

		notes = append(notes, note)
	}

	return notes, nil
}

// GetPath returns the file path for a note
func (s *Store) GetPath(idOrTitle string) (string, error) {
	note, err := s.Get(idOrTitle)
	if err != nil {
		return "", err
	}
	return s.findNotePath(note.ID)
}

// writeNote writes a note to the specified path
func (s *Store) writeNote(path string, note *Note) error {
	data, err := note.Marshal()
	if err != nil {
		return fmt.Errorf("failed to marshal note: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write note: %w", err)
	}

	return nil
}

// readNote reads a note from the specified path
func (s *Store) readNote(path string) (*Note, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open note: %w", err)
	}
	defer file.Close()

	note, err := ParseNote(file)
	if err != nil {
		return nil, fmt.Errorf("failed to parse note: %w", err)
	}

	return note, nil
}

// findNotePath finds the file path for a note by ID
func (s *Store) findNotePath(id string) (string, error) {
	entries, err := os.ReadDir(s.notesPath)
	if err != nil {
		return "", fmt.Errorf("failed to read notes directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		path := filepath.Join(s.notesPath, entry.Name())
		note, err := s.readNote(path)
		if err != nil {
			continue
		}

		if note.ID == id {
			return path, nil
		}
	}

	return "", fmt.Errorf("note not found: %s", id)
}
