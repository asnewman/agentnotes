export { hashQuote, buildAnchorFromRange, getUniqueMatchRange } from './anchoring.js';
export {
  deriveTextEditOps,
  remapCommentsForEdit,
  normalizeComment,
  transformOffset,
  commonPrefixLen,
  commonSuffixLen,
  clamp,
} from './transformation.js';
export type { TextEditOp } from './transformation.js';
export { resolveCommentRange, getAllHighlightRanges } from './resolution.js';
export type { CharRange } from './resolution.js';
