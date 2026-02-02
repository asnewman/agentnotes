package notes

import (
	"sort"
	"strings"
)

// SortField represents the field to sort by
type SortField string

const (
	SortByCreated  SortField = "created"
	SortByUpdated  SortField = "updated"
	SortByPriority SortField = "priority"
	SortByTitle    SortField = "title"
)

// SearchOptions configures search behavior
type SearchOptions struct {
	Query   string
	Tags    []string
	Limit   int
	SortBy  SortField
	Reverse bool
}

// Search searches notes with the given options
func Search(notes []*Note, opts SearchOptions) []*Note {
	var results []*Note

	for _, note := range notes {
		// Filter by query
		if opts.Query != "" && !note.MatchesQuery(opts.Query) {
			continue
		}

		// Filter by tags (all tags must match)
		if len(opts.Tags) > 0 {
			allTagsMatch := true
			for _, tag := range opts.Tags {
				if !note.HasTag(tag) {
					allTagsMatch = false
					break
				}
			}
			if !allTagsMatch {
				continue
			}
		}

		results = append(results, note)
	}

	// Sort results
	sortNotes(results, opts.SortBy, opts.Reverse)

	// Apply limit
	if opts.Limit > 0 && len(results) > opts.Limit {
		results = results[:opts.Limit]
	}

	return results
}

// Filter filters notes by tags
func Filter(notes []*Note, tags []string, limit int, sortBy SortField) []*Note {
	return Search(notes, SearchOptions{
		Tags:   tags,
		Limit:  limit,
		SortBy: sortBy,
	})
}

// GetAllTags returns a map of all tags with their counts
func GetAllTags(notes []*Note) map[string]int {
	tags := make(map[string]int)

	for _, note := range notes {
		for _, tag := range note.Tags {
			tag = strings.ToLower(tag)
			tags[tag]++
		}
	}

	return tags
}

// GetSortedTags returns tags sorted by count (descending)
func GetSortedTags(notes []*Note) []TagCount {
	tagMap := GetAllTags(notes)

	var tags []TagCount
	for tag, count := range tagMap {
		tags = append(tags, TagCount{Tag: tag, Count: count})
	}

	sort.Slice(tags, func(i, j int) bool {
		if tags[i].Count == tags[j].Count {
			return tags[i].Tag < tags[j].Tag
		}
		return tags[i].Count > tags[j].Count
	})

	return tags
}

// TagCount represents a tag and its usage count
type TagCount struct {
	Tag   string
	Count int
}

// sortNotes sorts notes by the specified field
func sortNotes(notes []*Note, sortBy SortField, reverse bool) {
	sort.Slice(notes, func(i, j int) bool {
		var less bool

		switch sortBy {
		case SortByCreated:
			less = notes[i].Created.After(notes[j].Created)
		case SortByUpdated:
			less = notes[i].Updated.After(notes[j].Updated)
		case SortByPriority:
			if notes[i].Priority == notes[j].Priority {
				less = notes[i].Created.After(notes[j].Created)
			} else {
				less = notes[i].Priority > notes[j].Priority
			}
		case SortByTitle:
			less = strings.ToLower(notes[i].Title) < strings.ToLower(notes[j].Title)
		default:
			less = notes[i].Created.After(notes[j].Created)
		}

		if reverse {
			return !less
		}
		return less
	})
}
