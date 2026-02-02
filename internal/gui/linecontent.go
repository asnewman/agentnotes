package gui

import (
	"image/color"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)

// BuildLineNumberedContent builds a container with content where commented lines are highlighted
func BuildLineNumberedContent(content string, commentedLines map[int]bool) *fyne.Container {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		placeholder := widget.NewLabel("No content")
		placeholder.TextStyle = fyne.TextStyle{Italic: true}
		return container.NewVBox(placeholder)
	}

	rows := make([]fyne.CanvasObject, 0, len(lines))

	for i, line := range lines {
		lineNum := i + 1
		hasComment := commentedLines[lineNum]

		row := buildLineRow(line, hasComment)
		rows = append(rows, row)
	}

	return container.NewVBox(rows...)
}

// buildLineRow creates a line row with optional highlight
func buildLineRow(content string, hasComment bool) fyne.CanvasObject {
	contentLabel := widget.NewLabel(content)

	if hasComment {
		// Subtle highlight for commented lines
		highlightColor := color.NRGBA{R: 255, G: 235, B: 156, A: 40}
		bg := canvas.NewRectangle(highlightColor)

		return container.NewStack(
			bg,
			contentLabel,
		)
	}

	return contentLabel
}
