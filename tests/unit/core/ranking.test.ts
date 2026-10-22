import { describe, expect, it } from 'vitest';
import { topByCpa, topByCtr } from '../../../src/core/ranking.js';
import type { CampaignTotals } from '../../../src/core/types.js';

function campaign(
  campaignId: string,
  ctr: [clicks: number, impressions: number],
  cpa: [spendCents: number, conversions: number],
): CampaignTotals {
  const [clicks, impressions] = ctr;
  const [spendCents, conversions] = cpa;
  return { campaignId, impressions, clicks, spendCents, conversions };
}

const ids = (campaigns: CampaignTotals[]): string[] => campaigns.map((c) => c.campaignId);

describe('topByCtr', () => {
  it('orders by highest CTR and excludes campaigns without impressions', () => {
    const campaigns = [
      campaign('A', [1, 100], [1, 1]),
      campaign('B', [0, 0], [1, 1]),
      campaign('C', [3, 100], [1, 1]),
    ];
    expect(ids(topByCtr(campaigns, 10))).toEqual(['C', 'A']);
  });

  it('breaks ties by campaign id', () => {
    const campaigns = [campaign('B', [2, 100], [1, 1]), campaign('A', [1, 50], [1, 1])];
    expect(ids(topByCtr(campaigns, 10))).toEqual(['A', 'B']);
  });

  it('ranks on exact values that doubles cannot tell apart', () => {
    const n = 2 ** 52;
    const campaigns = [campaign('A', [n + 2, n + 1], [1, 1]), campaign('B', [n + 1, n], [1, 1])];
    expect(ids(topByCtr(campaigns, 10))).toEqual(['B', 'A']);
  });

  it('returns at most `limit` campaigns', () => {
    const campaigns = Array.from({ length: 15 }, (_, i) => campaign(`C${i}`, [i, 100], [1, 1]));
    expect(topByCtr(campaigns, 10)).toHaveLength(10);
  });

  it('does not reorder its input', () => {
    const campaigns = [campaign('A', [1, 100], [1, 1]), campaign('B', [2, 100], [1, 1])];
    topByCtr(campaigns, 10);
    expect(ids(campaigns)).toEqual(['A', 'B']);
  });
});

describe('topByCpa', () => {
  it('orders by lowest CPA and excludes campaigns without conversions', () => {
    const campaigns = [
      campaign('A', [1, 1], [900, 1]),
      campaign('B', [1, 1], [100, 0]),
      campaign('C', [1, 1], [300, 1]),
    ];
    expect(ids(topByCpa(campaigns, 10))).toEqual(['C', 'A']);
  });

  it('breaks ties by campaign id', () => {
    const campaigns = [campaign('B', [1, 1], [1000, 2]), campaign('A', [1, 1], [500, 1])];
    expect(ids(topByCpa(campaigns, 10))).toEqual(['A', 'B']);
  });
});
