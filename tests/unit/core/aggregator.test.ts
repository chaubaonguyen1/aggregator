import { describe, expect, it } from 'vitest';
import { CampaignAggregator, TotalsOverflowError } from '../../../src/core/aggregator.js';
import type { AdRecord } from '../../../src/core/types.js';

function record(campaignId: string, overrides: Partial<AdRecord> = {}): AdRecord {
  return { campaignId, impressions: 0, clicks: 0, spendCents: 0, conversions: 0, ...overrides };
}

describe('CampaignAggregator', () => {
  it('sums every metric per campaign', () => {
    const aggregator = new CampaignAggregator();
    aggregator.add(record('A', { impressions: 100, clicks: 10, spendCents: 150, conversions: 1 }));
    aggregator.add(record('B', { impressions: 50, clicks: 5, spendCents: 99, conversions: 0 }));
    aggregator.add(record('A', { impressions: 200, clicks: 20, spendCents: 250, conversions: 3 }));

    expect(aggregator.campaignCount).toBe(2);
    expect(aggregator.totals()).toEqual([
      { campaignId: 'A', impressions: 300, clicks: 30, spendCents: 400, conversions: 4 },
      { campaignId: 'B', impressions: 50, clicks: 5, spendCents: 99, conversions: 0 },
    ]);
  });

  it('returns no totals when nothing was added', () => {
    expect(new CampaignAggregator().totals()).toEqual([]);
  });

  it('fails loudly instead of losing precision past MAX_SAFE_INTEGER', () => {
    const aggregator = new CampaignAggregator();
    for (let i = 0; i < 10; i++) {
      aggregator.add(record('A', { impressions: 999_999_999_999_999 }));
    }
    expect(() => aggregator.totals()).toThrow(TotalsOverflowError);
    expect(() => aggregator.totals()).toThrow('Total impressions of campaign A');
  });
});
