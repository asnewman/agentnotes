package gui

import (
	"image/color"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/widget"
)

// charPosToRowCol converts a character position to row and column for TextGrid
// Returns (row, col) where row is 0-indexed line number and col is 0-indexed column
func charPosToRowCol(content string, charPos int) (row, col int) {
	if charPos <= 0 {
		return 0, 0
	}

	lines := strings.Split(content, "\n")
	currentPos := 0

	for i, line := range lines {
		lineLen := len(line)
		lineEnd := currentPos + lineLen

		// Check if charPos is within this line (not including newline)
		if charPos <= lineEnd {
			col = charPos - currentPos
			return i, col
		}

		// Move past the newline character (except for last line)
		if i < len(lines)-1 {
			currentPos = lineEnd + 1 // +1 for newline
		} else {
			currentPos = lineEnd
		}
	}

	// If charPos is beyond content, return last position
	lastLine := len(lines) - 1
	if lastLine < 0 {
		return 0, 0
	}
	return lastLine, len(lines[lastLine])
}

// CreateHighlightedContent creates a TextGrid with highlighted character ranges
func CreateHighlightedContent(content string, ranges [][2]int) *widget.TextGrid {
	textGrid := widget.NewTextGridFromString(content)

	// Create highlight style with yellow background
	highlightStyle := &widget.CustomTextGridStyle{
		FGColor: color.Black,
		BGColor: color.RGBA{R: 255, G: 255, B: 0, A: 200}, // Yellow with good opacity
	}

	for _, rng := range ranges {
		startChar := rng[0]
		endChar := rng[1]

		// Clamp to content bounds
		if startChar < 0 {
			startChar = 0
		}
		if endChar > len(content) {
			endChar = len(content)
		}
		if startChar >= endChar {
			continue
		}

		startRow, startCol := charPosToRowCol(content, startChar)
		endRow, endCol := charPosToRowCol(content, endChar-1)

		// Apply style directly to cells
		for row := startRow; row <= endRow; row++ {
			if row >= len(textGrid.Rows) {
				continue
			}

			colStart := 0
			colEnd := len(textGrid.Rows[row].Cells) - 1

			if row == startRow {
				colStart = startCol
			}
			if row == endRow {
				colEnd = endCol
			}

			for col := colStart; col <= colEnd && col < len(textGrid.Rows[row].Cells); col++ {
				textGrid.Rows[row].Cells[col].Style = highlightStyle
			}
		}
	}

	textGrid.Refresh()
	return textGrid
}

// TextGridScroller wraps a TextGrid to make it scrollable and word-wrap friendly
type TextGridScroller struct {
	widget.BaseWidget
	textGrid *widget.TextGrid
}

// NewTextGridScroller creates a new scrollable text grid wrapper
func NewTextGridScroller(tg *widget.TextGrid) *TextGridScroller {
	tgs := &TextGridScroller{textGrid: tg}
	tgs.ExtendBaseWidget(tgs)
	return tgs
}

// CreateRenderer implements fyne.Widget
func (tgs *TextGridScroller) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(tgs.textGrid)
}

// MinSize returns the minimum size
func (tgs *TextGridScroller) MinSize() fyne.Size {
	return tgs.textGrid.MinSize()
}
