/**
 * Word diff of two texts: what a reworded description shows.
 */

import { describe, it, expect } from 'vitest';
import { diffWords, type WordDiffSegment } from '@/utils/word-diff';

function oldText(segments: WordDiffSegment[]): string {
  return segments
    .filter((segment) => segment.op !== 'added')
    .map((segment) => segment.text)
    .join('');
}

function newText(segments: WordDiffSegment[]): string {
  return segments
    .filter((segment) => segment.op !== 'removed')
    .map((segment) => segment.text)
    .join('');
}

describe('diffWords', () => {
  it('marks only the word that changed', () => {
    expect(
      diffWords('locks Sensory Impr for 30 minutes', 'locks Psycho Modi for 30 minutes')
    ).toEqual([
      { op: 'same', text: 'locks ' },
      { op: 'removed', text: 'Sensory Impr' },
      { op: 'added', text: 'Psycho Modi' },
      { op: 'same', text: ' for 30 minutes' },
    ]);
  });

  it('reports words inserted in the middle as one addition', () => {
    expect(diffWords('can execute (Increases', 'can execute the nano formula (Increases')).toEqual([
      { op: 'same', text: 'can execute ' },
      { op: 'added', text: 'the nano formula ' },
      { op: 'same', text: '(Increases' },
    ]);
  });

  it('reports removed words', () => {
    expect(diffWords('a very long sword', 'a sword')).toEqual([
      { op: 'same', text: 'a ' },
      { op: 'removed', text: 'very long ' },
      { op: 'same', text: 'sword' },
    ]);
  });

  it('returns one unchanged segment for equal texts', () => {
    expect(diffWords('same text', 'same text')).toEqual([{ op: 'same', text: 'same text' }]);
  });

  it('treats an absent side as empty text', () => {
    expect(diffWords(null, 'New name')).toEqual([{ op: 'added', text: 'New name' }]);
    expect(diffWords('Old name', undefined)).toEqual([{ op: 'removed', text: 'Old name' }]);
    expect(diffWords('', '')).toEqual([]);
  });

  it('is case sensitive: a recapitalised word is a change', () => {
    expect(diffWords('Health pill', 'Health Pill')).toEqual([
      { op: 'same', text: 'Health ' },
      { op: 'removed', text: 'pill' },
      { op: 'added', text: 'Pill' },
    ]);
  });

  it('always reads back as the old and the new text, line breaks included', () => {
    const cases: Array<[string, string]> = [
      ['one two  three\nfour', 'one 2 three\nfour five'],
      ['  leading and trailing  ', 'leading  and trailing'],
      ['a b c d e f', 'f e d c b a'],
      ['completely different', 'nothing in common here'],
      ['repeat repeat repeat', 'repeat repeat'],
    ];
    for (const [before, after] of cases) {
      const segments = diffWords(before, after);
      expect(oldText(segments)).toBe(before);
      expect(newText(segments)).toBe(after);
    }
  });

  it('never leaves two neighbouring segments of the same kind', () => {
    const segments = diffWords(
      'Use. Far this Item has Contruction Notum Enriched Nano Paste',
      'use. far these items have Construction notum-enriched nano paste'
    );
    for (let index = 1; index < segments.length; index++) {
      expect(segments[index].op).not.toBe(segments[index - 1].op);
    }
  });

  it('copes with texts too long to align word by word', () => {
    const before = Array.from({ length: 2500 }, (_, index) => `old${index}`).join(' ');
    const after = Array.from({ length: 2500 }, (_, index) => `new${index}`).join(' ');
    const segments = diffWords(before, after);
    expect(oldText(segments)).toBe(before);
    expect(newText(segments)).toBe(after);
  });
});
