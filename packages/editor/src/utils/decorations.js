/**
 * Collects all unique boundary points from decorations.
 */
function collectBoundaries(decorations, textLength) {
    const boundaries = new Set();
    boundaries.add(0);
    boundaries.add(textLength);
    for (const dec of decorations) {
        if (dec.from >= 0 && dec.from <= textLength) {
            boundaries.add(dec.from);
        }
        if (dec.to >= 0 && dec.to <= textLength) {
            boundaries.add(dec.to);
        }
    }
    return Array.from(boundaries).sort((a, b) => a - b);
}
/**
 * Gets all decorations that overlap with a given range.
 */
function getDecorationsInRange(decorations, from, to) {
    return decorations.filter(dec => dec.from < to && dec.to > from);
}
/**
 * Splits text into styled spans based on decoration boundaries.
 *
 * Example:
 * "Hello world" with bold(0-5) and italic(3-8) becomes:
 * [0-3: bold] [3-5: bold+italic] [5-8: italic] [8-11: plain]
 */
export function splitTextIntoSpans(text, decorations) {
    if (text.length === 0) {
        return [];
    }
    const boundaries = collectBoundaries(decorations, text.length);
    const spans = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
        const from = boundaries[i];
        const to = boundaries[i + 1];
        if (from >= to)
            continue;
        const spanDecorations = getDecorationsInRange(decorations, from, to);
        spans.push({
            from,
            to,
            text: text.slice(from, to),
            decorations: spanDecorations,
        });
    }
    return spans;
}
/**
 * Merges overlapping decorations of the same type.
 * This is useful for normalizing decoration lists.
 */
export function mergeDecorations(decorations) {
    if (decorations.length === 0)
        return [];
    // Group by type
    const byType = new Map();
    for (const dec of decorations) {
        const key = dec.type + JSON.stringify(dec.attributes || {});
        if (!byType.has(key)) {
            byType.set(key, []);
        }
        byType.get(key).push(dec);
    }
    const merged = [];
    for (const group of byType.values()) {
        // Sort by start position
        const sorted = [...group].sort((a, b) => a.from - b.from);
        let current = { ...sorted[0] };
        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            // If overlapping or adjacent, merge
            if (next.from <= current.to) {
                current.to = Math.max(current.to, next.to);
            }
            else {
                merged.push(current);
                current = { ...next };
            }
        }
        merged.push(current);
    }
    return merged;
}
/**
 * Checks if a position is within a decoration range.
 */
export function isPositionDecorated(position, decorations, type) {
    return decorations.some(dec => dec.from <= position &&
        dec.to > position &&
        (type === undefined || dec.type === type));
}
/**
 * Gets decorations at a specific position.
 */
export function getDecorationsAtPosition(position, decorations) {
    return decorations.filter(dec => dec.from <= position && dec.to > position);
}
