/**
 * Word-level diff of two texts, for descriptions that differ in a few words.
 *
 * The texts are split into words and the whitespace between them; a longest
 * common subsequence keeps what both share. The result reads in order:
 * joining every segment that is not 'added' gives the old text, joining every
 * segment that is not 'removed' gives the new one.
 */

export type WordDiffOp = 'same' | 'removed' | 'added';

export interface WordDiffSegment {
  op: WordDiffOp;
  text: string;
}

/** Above this many token pairs the texts are shown as one removal and one addition. */
const MAX_LCS_CELLS = 4_000_000;

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function push(segments: WordDiffSegment[], op: WordDiffOp, text: string): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.op === op) {
    last.text += text;
  } else {
    segments.push({ op, text });
  }
}

export function diffWords(
  oldText: string | null | undefined,
  newText: string | null | undefined
): WordDiffSegment[] {
  const before = tokenize(oldText ?? '');
  const after = tokenize(newText ?? '');
  const segments: WordDiffSegment[] = [];

  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start++;
  }
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--;
    endAfter--;
  }

  push(segments, 'same', before.slice(0, start).join(''));

  const a = before.slice(start, endBefore);
  const b = after.slice(start, endAfter);

  if (a.length * b.length > MAX_LCS_CELLS) {
    push(segments, 'removed', a.join(''));
    push(segments, 'added', b.join(''));
  } else if (a.length > 0 || b.length > 0) {
    // lengths[i][j]: longest common subsequence of a[i..] and b[j..]
    const width = b.length + 1;
    const lengths = new Uint32Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        lengths[i * width + j] =
          a[i] === b[j]
            ? lengths[(i + 1) * width + j + 1] + 1
            : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        push(segments, 'same', a[i]);
        i++;
        j++;
      } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
        push(segments, 'removed', a[i++]);
      } else {
        push(segments, 'added', b[j++]);
      }
    }
    while (i < a.length) push(segments, 'removed', a[i++]);
    while (j < b.length) push(segments, 'added', b[j++]);
  }

  push(segments, 'same', before.slice(endBefore).join(''));
  return regroup(segments);
}

/**
 * Whitespace between two changed words comes out of the LCS as 'same', which
 * chops a rewritten phrase into alternating single words. A lone whitespace
 * segment between two changes is folded into them, so the phrase reads as one
 * removal followed by one addition.
 */
function regroup(segments: WordDiffSegment[]): WordDiffSegment[] {
  const result: WordDiffSegment[] = [];
  let removed = '';
  let added = '';
  const flush = (): void => {
    push(result, 'removed', removed);
    push(result, 'added', added);
    removed = '';
    added = '';
  };

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.op === 'removed') {
      removed += segment.text;
    } else if (segment.op === 'added') {
      added += segment.text;
    } else {
      const next = segments[index + 1];
      const bridges =
        /^\s+$/.test(segment.text) &&
        (removed !== '' || added !== '') &&
        !!next &&
        next.op !== 'same';
      if (bridges) {
        removed += segment.text;
        added += segment.text;
      } else {
        flush();
        push(result, 'same', segment.text);
      }
    }
  }
  flush();
  return result;
}
