import { describe, expect, it } from 'vitest';
import {
  compareCpa,
  compareCtr,
  formatCpa,
  formatCtr,
  formatSpend,
  hasCpa,
  hasCtr,
} from '../../../src/core/metrics.js';
import type { CampaignTotals } from '../../../src/core/types.js';

function totals(overrides: Partial<CampaignTotals> = {}): CampaignTotals {
  return {
    campaignId: 'A',
    impressions: 1000,
    clicks: 50,
    spendCents: 2000,
    conversions: 4,
    ...overrides,
  };
}

describe('CTR', () => {
  it('formats clicks / impressions with 4 decimals', () => {
    expect(formatCtr(totals())).toBe('0.0500');
  });

  it('rounds half up', () => {
    expect(formatCtr(totals({ impressions: 20000, clicks: 3 }))).toBe('0.0002');
  });

  it('is undefined without impressions', () => {
    const campaign = totals({ impressions: 0, clicks: 0 });
    expect(hasCtr(campaign)).toBe(false);
    expect(formatCtr(campaign)).toBe('');
  });

  it('compares exactly', () => {
    expect(
      compareCtr(totals({ clicks: 1, impressions: 3 }), totals({ clicks: 1, impressions: 2 })),
    ).toBe(-1);
  });
});

describe('CPA', () => {
  it('formats spend in dollars / conversions with 2 decimals', () => {
    expect(formatCpa(totals())).toBe('5.00');
  });

  it('rounds half up', () => {
    expect(formatCpa(totals({ spendCents: 203, conversions: 2 }))).toBe('1.02');
  });

  it('is null (empty) without conversions', () => {
    const campaign = totals({ conversions: 0 });
    expect(hasCpa(campaign)).toBe(false);
    expect(formatCpa(campaign)).toBe('');
  });

  it('compares exactly', () => {
    expect(compareCpa(totals({ spendCents: 900 }), totals({ spendCents: 300 }))).toBe(1);
  });
});

describe('formatSpend', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [450, '4.50'],
    [1250050, '12500.50'],
  ])('formats %d cents as %s', (spendCents, expected) => {
    expect(formatSpend(totals({ spendCents }))).toBe(expected);
  });
});
