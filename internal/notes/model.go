package notes

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
	"gopkg.in/yaml.v3"
)

// Comment represents a comment on a note
type Comment struct {
	ID      string    `yaml:"id"`
	Author  string    `yaml:"author,omitempty"`
	Line    int       `yaml:"line,omitempty"` // Optional: reference a specific line
	Created time.Time `yaml:"created"`
	Content string    `yaml:"content"`
}

// NewComment creates a new comment with generated ID and timestamp
func NewComment(author, content string, line int) *Comment {
	c := &Comment{
		ID:      ulid.Make().String(),
		Author:  author,
		Created: time.Now().UTC(),
		Content: content,
	}
	if line > 0 {
		c.Line = line
	}
	return c
}

// Note represents a markdown note with metadata
type Note struct {
	ID       string    `yaml:"id"`
	Title    string    `yaml:"title"`
	Tags     []string  `yaml:"tags,omitempty"`
	Created  time.Time `yaml:"created"`
	Updated  time.Time `yaml:"updated"`
	Source   string    `yaml:"source,omitempty"`
	Priority int       `yaml:"priority,omitempty"`
	Comments []Comment `yaml:"comments,omitempty"`
	Content  string    `yaml:"-"` // Not part of frontmatter
}

// NewNote creates a new note with generated ID and timestamps
func NewNote(title string, tags []string, priority int) *Note {
	now := time.Now().UTC()
	return &Note{
		ID:       ulid.Make().String(),
		Title:    title,
		Tags:     tags,
		Created:  now,
		Updated:  now,
		Source:   "user",
		Priority: priority,
		Content:  fmt.Sprintf("# %s\n\n", title),
	}
}

// ParseNote parses a markdown file with YAML frontmatter into a Note
func ParseNote(r io.Reader) (*Note, error) {
	scanner := bufio.NewScanner(r)

	// Check for frontmatter delimiter
	if !scanner.Scan() {
		return nil, fmt.Errorf("empty file")
	}

	firstLine := scanner.Text()
	if firstLine != "---" {
		return nil, fmt.Errorf("missing frontmatter: expected '---', got %q", firstLine)
	}

	// Read frontmatter until closing delimiter
	var frontmatter bytes.Buffer
	for scanner.Scan() {
		line := scanner.Text()
		if line == "---" {
			break
		}
		frontmatter.WriteString(line)
		frontmatter.WriteString("\n")
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading frontmatter: %w", err)
	}

	// Parse YAML frontmatter
	var note Note
	if err := yaml.Unmarshal(frontmatter.Bytes(), &note); err != nil {
		return nil, fmt.Errorf("error parsing frontmatter: %w", err)
	}

	// Read the rest as content
	var content bytes.Buffer
	for scanner.Scan() {
		content.WriteString(scanner.Text())
		content.WriteString("\n")
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading content: %w", err)
	}

	note.Content = strings.TrimRight(content.String(), "\n")

	return &note, nil
}

// Marshal converts a Note to markdown with YAML frontmatter
func (n *Note) Marshal() ([]byte, error) {
	var buf bytes.Buffer

	// Write frontmatter
	buf.WriteString("---\n")

	frontmatter, err := yaml.Marshal(n)
	if err != nil {
		return nil, fmt.Errorf("error marshaling frontmatter: %w", err)
	}
	buf.Write(frontmatter)

	buf.WriteString("---\n\n")

	// Write content
	buf.WriteString(n.Content)
	buf.WriteString("\n")

	return buf.Bytes(), nil
}

// Filename returns the filename for this note based on date and title
func (n *Note) Filename() string {
	date := n.Created.Format("2006-01-02")
	slug := slugify(n.Title)
	return fmt.Sprintf("%s-%s.md", date, slug)
}

// HasTag checks if the note has a specific tag (case-insensitive)
func (n *Note) HasTag(tag string) bool {
	tag = strings.ToLower(tag)
	for _, t := range n.Tags {
		if strings.ToLower(t) == tag {
			return true
		}
	}
	return false
}

// MatchesQuery checks if the note matches a search query (case-insensitive)
func (n *Note) MatchesQuery(query string) bool {
	query = strings.ToLower(query)

	// Check title
	if strings.Contains(strings.ToLower(n.Title), query) {
		return true
	}

	// Check content
	if strings.Contains(strings.ToLower(n.Content), query) {
		return true
	}

	// Check tags
	for _, tag := range n.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return true
		}
	}

	return false
}

// slugify converts a title to a URL-friendly slug
func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.TrimSpace(s)

	var result strings.Builder
	prevDash := false

	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			result.WriteRune(r)
			prevDash = false
		} else if r == ' ' || r == '-' || r == '_' {
			if !prevDash && result.Len() > 0 {
				result.WriteRune('-')
				prevDash = true
			}
		}
	}

	slug := result.String()
	slug = strings.TrimSuffix(slug, "-")

	return slug
}
