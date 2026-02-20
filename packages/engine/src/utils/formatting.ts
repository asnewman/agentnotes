const TITLE_CASE_SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'vs',
  'via',
]);

export function toTitleCase(value: string): string {
  if (!value.trim()) {
    return value;
  }

  const lowerCaseValue = value.toLocaleLowerCase();
  const matches = Array.from(lowerCaseValue.matchAll(/[a-z0-9][a-z0-9''\u2019]*/g));
  if (matches.length === 0) {
    return value;
  }

  let matchIndex = 0;
  const lastMatchIndex = matches.length - 1;
  return lowerCaseValue.replace(/[a-z0-9][a-z0-9''\u2019]*/g, (word) => {
    const isFirst = matchIndex === 0;
    const isLast = matchIndex === lastMatchIndex;
    matchIndex += 1;

    if (!isFirst && !isLast && TITLE_CASE_SMALL_WORDS.has(word)) {
      return word;
    }

    return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
  });
}
