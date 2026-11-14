import { describe, it, expect } from 'vitest';
import { formatCentiseconds } from '@/utils/nuke-casting-calculations';

describe('formatCentiseconds', () => {
  it('shows a time in centiseconds as seconds with two decimals and the unit', () => {
    expect(formatCentiseconds(150)).toBe('1.50s');
    expect(formatCentiseconds(3000)).toBe('30.00s');
    expect(formatCentiseconds(7)).toBe('0.07s');
    expect(formatCentiseconds(0)).toBe('0.00s');
  });
});
