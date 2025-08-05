import { describe, it, expect } from 'vitest';
import { add } from '../utils/math';

describe('smoke', () => {
  it('truthiness', () => {
    expect(true).toBe(true);
  });

  it('imports util function', () => {
    expect(add(2, 3)).toBe(5);
  });
});