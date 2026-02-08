type TagRemoveHandler = (tag: string) => void;

export function createTagChip(tag: string, onRemove?: TagRemoveHandler): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'tag-chip';

  const label = document.createElement('span');
  label.className = 'tag-chip-label';
  label.textContent = tag;
  chip.appendChild(label);

  if (onRemove) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'tag-chip-remove';
    removeButton.setAttribute('aria-label', `Remove tag ${tag}`);
    removeButton.textContent = 'x';
    removeButton.addEventListener('click', () => onRemove(tag));
    chip.appendChild(removeButton);
  }

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
