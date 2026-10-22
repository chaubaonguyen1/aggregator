import { compareCpa, compareCtr, hasCpa, hasCtr } from './metrics.js';
import type { CampaignTotals } from './types.js';

function byCampaignId(a: CampaignTotals, b: CampaignTotals): number {
  if (a.campaignId < b.campaignId) {
    return -1;
  }
  return a.campaignId > b.campaignId ? 1 : 0;
}

/** Highest CTR first; campaigns without impressions have no CTR and are excluded. */
export function topByCtr(campaigns: readonly CampaignTotals[], limit: number): CampaignTotals[] {
  const byCtrDescending = (a: CampaignTotals, b: CampaignTotals): number => -compareCtr(a, b);
  return campaigns
    .filter(hasCtr)
    .sort((a, b) => byCtrDescending(a, b) || byCampaignId(a, b))
    .slice(0, limit);
}

/** Lowest CPA first; campaigns without conversions have no CPA and are excluded. */
export function topByCpa(campaigns: readonly CampaignTotals[], limit: number): CampaignTotals[] {
  return campaigns
    .filter(hasCpa)
    .sort((a, b) => compareCpa(a, b) || byCampaignId(a, b))
    .slice(0, limit);
}
