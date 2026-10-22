import { CENTS_PER_DOLLAR, DECIMALS } from '../constants.js';
import { compareRatios, formatRatio } from './ratio.js';
import type { CampaignTotals } from './types.js';

/*
 * The single definition of CTR and CPA. Both are kept as exact integer ratios: ranking compares
 * them exactly and output rounds them once, half up, so no float error can reorder or misprint.
 *
 *   CTR = clicks / impressions          (undefined without impressions)
 *   CPA = spend / conversions, in USD   (undefined without conversions)
 */

export function hasCtr(campaign: CampaignTotals): boolean {
  return campaign.impressions > 0;
}

export function hasCpa(campaign: CampaignTotals): boolean {
  return campaign.conversions > 0;
}

export function compareCtr(a: CampaignTotals, b: CampaignTotals): number {
  return compareRatios(a.clicks, a.impressions, b.clicks, b.impressions);
}

export function compareCpa(a: CampaignTotals, b: CampaignTotals): number {
  return compareRatios(a.spendCents, a.conversions, b.spendCents, b.conversions);
}

export function formatSpend(campaign: CampaignTotals): string {
  return formatRatio(campaign.spendCents, CENTS_PER_DOLLAR, DECIMALS.spend);
}

/** Empty when the campaign has no impressions. */
export function formatCtr(campaign: CampaignTotals): string {
  return hasCtr(campaign) ? formatRatio(campaign.clicks, campaign.impressions, DECIMALS.ctr) : '';
}

/** Empty (null CPA) when the campaign has no conversions. */
export function formatCpa(campaign: CampaignTotals): string {
  if (!hasCpa(campaign)) {
    return '';
  }
  const centsPerConversion = BigInt(campaign.conversions) * BigInt(CENTS_PER_DOLLAR);
  return formatRatio(campaign.spendCents, centsPerConversion, DECIMALS.cpa);
}
