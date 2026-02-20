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
