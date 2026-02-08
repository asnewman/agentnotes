package notes

import (
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"strings"

	"gopkg.in/yaml.v3"
)

type TextEditOp struct {
	At        int
	DeleteLen int
	InsertLen int
}

func HashQuote(text string) string {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(text))
	return hex.EncodeToString(hasher.Sum(nil))
}

func BuildAnchorFromRange(noteContent string, from, to, rev int) (CommentAnchor, error) {
	if from < 0 || to < 0 {
		return CommentAnchor{}, fmt.Errorf("anchor range must be non-negative")
	}
	if to <= from {
		return CommentAnchor{}, fmt.Errorf("anchor range must have positive length")
	}
	if to > len(noteContent) {
		return CommentAnchor{}, fmt.Errorf("anchor range [%d,%d) out of bounds for content length %d", from, to, len(noteContent))
	}

	quote := noteContent[from:to]

	return CommentAnchor{
		From:          from,
		To:            to,
		Rev:           rev,
		StartAffinity: AffinityAfter,
		EndAffinity:   AffinityBefore,
		Quote:         quote,
		QuoteHash:     HashQuote(quote),
	}, nil
}

func BuildAnchor(noteContent, exact string, rev int) (CommentAnchor, error) {
	exact = strings.TrimSpace(exact)
	if exact == "" {
		return CommentAnchor{}, fmt.Errorf("anchor exact text cannot be empty")
	}

	matches := 0
	start := -1
	offset := 0

	for offset <= len(noteContent)-len(exact) {
		index := strings.Index(noteContent[offset:], exact)
		if index < 0 {
			break
		}

		absolute := offset + index
		start = absolute
		matches++

		if matches > 1 {
			return CommentAnchor{}, fmt.Errorf("anchor text is ambiguous; provide --from and --to for deterministic placement")
		}

		offset = absolute + len(exact)
	}

	if matches == 0 || start < 0 {
		return CommentAnchor{}, fmt.Errorf("anchor text not found in note content")
	}

	return BuildAnchorFromRange(noteContent, start, start+len(exact), rev)
}

func DeriveTextEditOps(before, after string) []TextEditOp {
	if before == after {
		return nil
	}

	prefix := commonPrefixLen(before, after)
	beforeTail := before[prefix:]
	afterTail := after[prefix:]
	suffix := commonSuffixLen(beforeTail, afterTail)

	deleteLen := len(before) - prefix - suffix
	insertLen := len(after) - prefix - suffix

	if deleteLen == 0 && insertLen == 0 {
		return nil
	}

	return []TextEditOp{
		{
			At:        prefix,
			DeleteLen: deleteLen,
			InsertLen: insertLen,
		},
	}
}

func TransformCommentsForContentChange(
	comments []Comment,
	oldContent string,
	newContent string,
	currentRev int,
) ([]Comment, int) {
	if len(comments) == 0 {
		if currentRev < 0 {
			return comments, 0
		}
		return comments, currentRev
	}

	ops := DeriveTextEditOps(oldContent, newContent)
	if len(ops) == 0 {
		normalized := cloneComments(comments)
		for index := range normalized {
			normalizeComment(&normalized[index], len(newContent), currentRev)
		}
		return normalized, currentRev
	}

	nextRev := currentRev + 1
	if nextRev < 1 {
		nextRev = 1
	}

	transformed := cloneComments(comments)
	for index := range transformed {
		transformed[index] = transformComment(transformed[index], ops, newContent, nextRev)
	}

	return transformed, nextRev
}

func NormalizeNoteComments(note *Note) {
	if note.CommentRev < 0 {
		note.CommentRev = 0
	}

	for index := range note.Comments {
		normalizeComment(&note.Comments[index], len(note.Content), note.CommentRev)
	}
}

func cloneComments(source []Comment) []Comment {
	cloned := make([]Comment, len(source))
	copy(cloned, source)
	return cloned
}

func transformComment(comment Comment, ops []TextEditOp, newContent string, nextRev int) Comment {
	normalizeComment(&comment, len(newContent), nextRev)

	from := comment.Anchor.From
	to := comment.Anchor.To
	touched := false

	for _, op := range ops {
		if op.DeleteLen > 0 && rangesOverlap(from, to, op.At, op.At+op.DeleteLen) {
			touched = true
		}
		if op.DeleteLen == 0 && op.At > from && op.At < to {
			touched = true
		}

		from = transformOffset(from, comment.Anchor.StartAffinity, op)
		to = transformOffset(to, comment.Anchor.EndAffinity, op)
	}

	from = clamp(from, 0, len(newContent))
	to = clamp(to, 0, len(newContent))

	comment.Anchor.From = from
	comment.Anchor.To = to
	comment.Anchor.Rev = nextRev

	if to <= from {
		comment.Status = CommentDetached
		return comment
	}

	if touched {
		comment.Status = CommentStale
		return comment
	}

	if comment.Anchor.QuoteHash != "" {
		currentQuote := newContent[from:to]
		if HashQuote(currentQuote) != comment.Anchor.QuoteHash {
			comment.Status = CommentStale
			return comment
		}
	}

	comment.Status = CommentAttached
	return comment
}

func transformOffset(offset int, affinity CommentAffinity, op TextEditOp) int {
	if offset < op.At {
		return offset
	}

	opEnd := op.At + op.DeleteLen
	delta := op.InsertLen - op.DeleteLen

	if offset > opEnd {
		return offset + delta
	}

	if offset == op.At {
		if op.DeleteLen == 0 {
			if affinity == AffinityAfter {
				return offset + op.InsertLen
			}
			return offset
		}
		return op.At
	}

	if offset == opEnd {
		if affinity == AffinityAfter {
			return op.At + op.InsertLen
		}
		return op.At
	}

	return op.At
}

func normalizeComment(comment *Comment, contentLen int, fallbackRev int) {
	if comment.Anchor.StartAffinity == "" {
		comment.Anchor.StartAffinity = AffinityAfter
	}
	if comment.Anchor.EndAffinity == "" {
		comment.Anchor.EndAffinity = AffinityBefore
	}

	if comment.Anchor.Rev < 0 {
		comment.Anchor.Rev = 0
	}
	if comment.Anchor.Rev == 0 {
		comment.Anchor.Rev = fallbackRev
	}

	if comment.Anchor.From < 0 {
		comment.Anchor.From = 0
	}
	if comment.Anchor.To < 0 {
		comment.Anchor.To = 0
	}
	if comment.Anchor.From > contentLen {
		comment.Anchor.From = contentLen
	}
	if comment.Anchor.To > contentLen {
		comment.Anchor.To = contentLen
	}

	if comment.Anchor.Quote != "" && comment.Anchor.QuoteHash == "" {
		comment.Anchor.QuoteHash = HashQuote(comment.Anchor.Quote)
	}

	switch comment.Status {
	case CommentAttached, CommentStale, CommentDetached:
		return
	default:
		if comment.Anchor.To > comment.Anchor.From {
			comment.Status = CommentAttached
		} else {
			comment.Status = CommentDetached
		}
	}
}

func rangesOverlap(aStart, aEnd, bStart, bEnd int) bool {
	return aStart < bEnd && bStart < aEnd
}

func commonPrefixLen(a, b string) int {
	limit := len(a)
	if len(b) < limit {
		limit = len(b)
	}

	index := 0
	for index < limit {
		if a[index] != b[index] {
			break
		}
		index++
	}

	return index
}

func commonSuffixLen(a, b string) int {
	limit := len(a)
	if len(b) < limit {
		limit = len(b)
	}

	index := 0
	for index < limit {
		if a[len(a)-1-index] != b[len(b)-1-index] {
			break
		}
		index++
	}

	return index
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func (anchor *CommentAnchor) UnmarshalYAML(value *yaml.Node) error {
	type commentAnchorWire struct {
		From          *int            `yaml:"from"`
		To            *int            `yaml:"to"`
		Rev           *int            `yaml:"rev"`
		StartAffinity CommentAffinity `yaml:"start_affinity"`
		EndAffinity   CommentAffinity `yaml:"end_affinity"`
		Quote         string          `yaml:"quote"`
		QuoteHash     string          `yaml:"quote_hash"`
		Start         *int            `yaml:"start"`
		End           *int            `yaml:"end"`
		Exact         string          `yaml:"exact"`
	}

	var wire commentAnchorWire
	if err := value.Decode(&wire); err != nil {
		return err
	}

	from := -1
	to := -1

	if wire.From != nil && wire.To != nil {
		from = *wire.From
		to = *wire.To
	} else if wire.Start != nil && wire.End != nil {
		from = *wire.Start
		to = *wire.End
	}

	if from < 0 || to < from {
		from = 0
		to = 0
	}

	anchor.From = from
	anchor.To = to

	if wire.Rev != nil && *wire.Rev > 0 {
		anchor.Rev = *wire.Rev
	} else {
		anchor.Rev = 0
	}

	if wire.StartAffinity != "" {
		anchor.StartAffinity = wire.StartAffinity
	} else {
		anchor.StartAffinity = AffinityAfter
	}

	if wire.EndAffinity != "" {
		anchor.EndAffinity = wire.EndAffinity
	} else {
		anchor.EndAffinity = AffinityBefore
	}

	if wire.Quote != "" {
		anchor.Quote = wire.Quote
	} else {
		anchor.Quote = wire.Exact
	}

	anchor.QuoteHash = wire.QuoteHash
	if anchor.Quote != "" && anchor.QuoteHash == "" {
		anchor.QuoteHash = HashQuote(anchor.Quote)
	}

	return nil
}
