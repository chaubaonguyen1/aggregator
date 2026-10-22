import { describe, expect, it } from 'vitest';
import { compareRatios, formatRatio } from '../../../src/core/ratio.js';

describe('compareRatios', () => {
  it('orders ratios', () => {
    expect(compareRatios(1, 3, 1, 2)).toBe(-1);
    expect(compareRatios(1, 2, 1, 3)).toBe(1);
    expect(compareRatios(2, 4, 1, 2)).toBe(0);
  });

  it('distinguishes ratios that are equal as doubles', () => {
    const n = 2 ** 52;
    const asDouble = (numerator: number, denominator: number): number => numerator / denominator;
    expect(asDouble(n + 1, n)).toBe(asDouble(n + 2, n + 1));
    expect(compareRatios(n + 1, n, n + 2, n + 1)).toBe(1);
  });
});

describe('formatRatio', () => {
  it.each([
    [1, 2, 2, '0.50'],
    [0, 7, 4, '0.0000'],
    [123456, 100, 2, '1234.56'],
    [39_478_033_396, 100, 2, '394780333.96'],
    [2, 3, 4, '0.6667'],
  ])('formats %d / %d with %d decimals as %s', (numerator, denominator, decimals, expected) => {
    expect(formatRatio(numerator, denominator, decimals)).toBe(expected);
  });

  it('rounds exact half-way values up, unlike toFixed on doubles', () => {
    expect((1.015).toFixed(2)).toBe('1.01');
    expect(formatRatio(1015, 1000, 2)).toBe('1.02');
    expect(formatRatio(3, 20000, 4)).toBe('0.0002');
  });

  it('formats without decimals', () => {
    expect(formatRatio(5, 2, 0)).toBe('3');
  });

  it('stays exact beyond the safe integer range', () => {
    expect(formatRatio(10n ** 20n + 1n, 1n, 0)).toBe('100000000000000000001');
  });
});
