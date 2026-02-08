export function createTagChip(tag: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.textContent = tag;
  return chip;
}

export function createPriorityBadge(priority: number): HTMLSpanElement | null {
  if (!priority || priority < 1) {
    return null;
  }

  const badge = document.createElement('span');
  badge.className = 'priority-badge';

  if (priority >= 4) {
    badge.classList.add('high');
  } else if (priority >= 2) {
    badge.classList.add('medium');
  } else {
    badge.classList.add('low');
  }

  badge.textContent = `P${priority}`;
  return badge;
}
