import { AppError } from '../errors.js';
import type { AdRecord, CampaignTotals } from './types.js';

export class TotalsOverflowError extends AppError {
  override name = 'TotalsOverflowError';
}

/**
 * Totals get their own class instead of copying the record object: running sums quickly outgrow
 * V8's small-integer range, and sharing a hidden class with the per-row records would make every
 * new record pay for boxed number fields.
 */
class RunningTotals implements CampaignTotals {
  impressions = 0;
  clicks = 0;
  spendCents = 0;
  conversions = 0;

  constructor(readonly campaignId: string) {}
}

const SUMMED_FIELDS = ['impressions', 'clicks', 'spendCents', 'conversions'] as const;

/**
 * Copies a string into fresh memory. A campaign id is sliced out of a whole decoded chunk, and
 * V8 may keep that chunk alive for as long as the slice lives; map keys live for the whole run.
 */
function detach(text: string): string {
  return Buffer.from(text, 'utf8').toString('utf8');
}

/** Accumulates per-campaign totals; memory grows with the number of campaigns, not rows. */
export class CampaignAggregator {
  private readonly totalsById = new Map<string, RunningTotals>();

  add(record: AdRecord): void {
    let totals = this.totalsById.get(record.campaignId);
    if (totals === undefined) {
      const campaignId = detach(record.campaignId);
      totals = new RunningTotals(campaignId);
      this.totalsById.set(campaignId, totals);
    }
    totals.impressions += record.impressions;
    totals.clicks += record.clicks;
    totals.spendCents += record.spendCents;
    totals.conversions += record.conversions;
  }

  get campaignCount(): number {
    return this.totalsById.size;
  }

  /**
   * Returns a snapshot of every campaign's totals.
   * Sums only grow, so a total that is still a safe integer was exact at every step; checking once
   * here instead of on every row keeps the hot loop free of the check.
   */
  totals(): CampaignTotals[] {
    return [...this.totalsById.values()].map((totals) => {
      for (const field of SUMMED_FIELDS) {
        if (!Number.isSafeInteger(totals[field])) {
          throw new TotalsOverflowError(
            `Total ${field} of campaign ${totals.campaignId} exceeds ${Number.MAX_SAFE_INTEGER} ` +
              'and cannot be represented exactly',
          );
        }
      }
      return {
        campaignId: totals.campaignId,
        impressions: totals.impressions,
        clicks: totals.clicks,
        spendCents: totals.spendCents,
        conversions: totals.conversions,
      };
    });
  }
}
