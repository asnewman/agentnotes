/**
 * TagChip component - renders a tag as a styled chip
 */

/**
 * Create a tag chip element
 * @param {string} tag - The tag text
 * @returns {HTMLElement} The tag chip element
 */
export function createTagChip(tag) {
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.textContent = tag;
  return chip;
}

/**
 * Create a priority badge element
 * @param {number} priority - Priority level (1-5)
 * @returns {HTMLElement|null} The priority badge element or null
 */
export function createPriorityBadge(priority) {
  if (!priority || priority < 1) {
    return null;
  }

  const badge = document.createElement('span');
  badge.className = 'priority-badge';

  if (priority >= 4) {
    badge.classList.add('high');
    badge.textContent = 'P' + priority;
  } else if (priority >= 2) {
    badge.classList.add('medium');
    badge.textContent = 'P' + priority;
  } else {
    badge.classList.add('low');
    badge.textContent = 'P' + priority;
  }

  return badge;
}
