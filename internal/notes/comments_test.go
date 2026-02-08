package notes

import "testing"

func TestBuildAnchorRejectsAmbiguousExact(t *testing.T) {
	_, err := BuildAnchor("foo bar foo", "foo", 1)
	if err == nil {
		t.Fatalf("expected ambiguous anchor error, got nil")
	}
}

func TestTransformCommentsForContentChangeShiftOnInsertBefore(t *testing.T) {
	anchor, err := BuildAnchorFromRange("hello world", 6, 11, 1)
	if err != nil {
		t.Fatalf("build anchor: %v", err)
	}

	comments := []Comment{
		{
			ID:      "c1",
			Status:  CommentAttached,
			Content: "watch world",
			Anchor:  anchor,
		},
	}

	next, rev := TransformCommentsForContentChange(comments, "hello world", "well hello world", 1)
	if rev != 2 {
		t.Fatalf("expected rev 2, got %d", rev)
	}

	got := next[0]
	if got.Anchor.From != 11 || got.Anchor.To != 16 {
		t.Fatalf("expected shifted range [11,16), got [%d,%d)", got.Anchor.From, got.Anchor.To)
	}
	if got.Status != CommentAttached {
		t.Fatalf("expected attached status, got %s", got.Status)
	}
}

func TestTransformCommentsForContentChangeMarksStaleOnOverlap(t *testing.T) {
	anchor, err := BuildAnchorFromRange("hello world", 6, 11, 1)
	if err != nil {
		t.Fatalf("build anchor: %v", err)
	}

	comments := []Comment{
		{
			ID:      "c1",
			Status:  CommentAttached,
			Content: "watch world",
			Anchor:  anchor,
		},
	}

	next, _ := TransformCommentsForContentChange(comments, "hello world", "hello worLd", 1)
	if next[0].Status != CommentStale {
		t.Fatalf("expected stale status, got %s", next[0].Status)
	}
}

func TestTransformCommentsForContentChangeMarksDetachedWhenDeleted(t *testing.T) {
	anchor, err := BuildAnchorFromRange("hello world", 6, 11, 1)
	if err != nil {
		t.Fatalf("build anchor: %v", err)
	}

	comments := []Comment{
		{
			ID:      "c1",
			Status:  CommentAttached,
			Content: "watch world",
			Anchor:  anchor,
		},
	}

	next, _ := TransformCommentsForContentChange(comments, "hello world", "hello ", 1)
	if next[0].Status != CommentDetached {
		t.Fatalf("expected detached status, got %s", next[0].Status)
	}
	if next[0].Anchor.From != 6 || next[0].Anchor.To != 6 {
		t.Fatalf("expected collapsed range [6,6), got [%d,%d)", next[0].Anchor.From, next[0].Anchor.To)
	}
}
