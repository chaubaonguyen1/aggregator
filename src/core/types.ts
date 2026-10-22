import type { INPUT_COLUMNS } from '../constants.js';

export type InputColumn = (typeof INPUT_COLUMNS)[number];

/** Position of every required column within a data row. */
export type ColumnIndex = Readonly<Record<InputColumn, number>>;

export interface CampaignTotals {
  campaignId: string;
  impressions: number;
  clicks: number;
  /** Spend kept in integer cents so that summing millions of rows never accumulates float error. */
  spendCents: number;
  conversions: number;
}

/** A single CSV row carries the same figures as a running total, for one day. */
export type AdRecord = CampaignTotals;

export const SKIP_REASONS = [
  'wrong_column_count',
  'quoted_field',
  'missing_campaign_id',
  'invalid_date',
  'invalid_impressions',
  'invalid_clicks',
  'invalid_spend',
  'invalid_conversions',
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export type ParseResult = { ok: true; record: AdRecord } | { ok: false; reason: SkipReason };
