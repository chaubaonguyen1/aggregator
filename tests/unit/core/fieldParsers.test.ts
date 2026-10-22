import { describe, expect, it } from 'vitest';
import {
  isIsoDate,
  parseAmountToCents,
  parseNonNegativeInteger,
} from '../../../src/core/fieldParsers.js';

describe('parseNonNegativeInteger', () => {
  it.each([
    ['0', 0],
    ['12000', 12000],
    ['007', 7],
    ['999999999999999', 999_999_999_999_999],
  ])('parses %s', (text, expected) => {
    expect(parseNonNegativeInteger(text)).toBe(expected);
  });

  it.each(['', '-1', '+1', '1.5', '1e3', ' 1', '1 ', 'abc', '1234567890123456'])(
    'rejects %j',
    (text) => {
      expect(parseNonNegativeInteger(text)).toBeNull();
    },
  );

  it('parses only the requested range', () => {
    expect(parseNonNegativeInteger('ab123cd', 2, 5)).toBe(123);
  });
});

describe('parseAmountToCents', () => {
  it.each([
    ['45.50', 4550],
    ['45.5', 4550],
    ['45', 4500],
    ['0.01', 1],
    ['0', 0],
    ['64.29', 6429],
  ])('parses %s to cents', (text, expected) => {
    expect(parseAmountToCents(text)).toBe(expected);
  });

  it.each(['', '.', '1.', '.5', '1.005', '-1.00', '1,00', 'abc', '1.0a', '1.2.3'])(
    'rejects %j',
    (text) => {
      expect(parseAmountToCents(text)).toBeNull();
    },
  );

  it('parses only the requested range', () => {
    expect(parseAmountToCents('x,12.34,y', 2, 7)).toBe(1234);
  });

  it('accepts the largest amount that is exact in cents', () => {
    expect(parseAmountToCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(['90071992547409.92', '999999999999999.99', '999999999999999'])(
    'rejects %s, which cannot be held exactly in cents',
    (text) => {
      expect(parseAmountToCents(text)).toBeNull();
    },
  );
});

describe('isIsoDate', () => {
  it.each(['2025-01-01', '2025-12-31'])('accepts %s', (text) => {
    expect(isIsoDate(text)).toBe(true);
  });

  it.each(['', '2025/01/01', '2025-1-01', '2025-13-01', '2025-00-10', '2025-01-32', '25-01-01xx'])(
    'rejects %j',
    (text) => {
      expect(isIsoDate(text)).toBe(false);
    },
  );
});
