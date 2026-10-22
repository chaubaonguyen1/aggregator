export const INPUT_COLUMNS = [
  'campaign_id',
  'date',
  'impressions',
  'clicks',
  'spend',
  'conversions',
] as const;

export const OUTPUT_COLUMNS = [
  'campaign_id',
  'total_impressions',
  'total_clicks',
  'total_spend',
  'total_conversions',
  'CTR',
  'CPA',
] as const;

export const TOP_N = 10;

export const OUTPUT_FILES = {
  topByCtr: 'top10_ctr.csv',
  topByCpa: 'top10_cpa.csv',
} as const;

export const DEFAULT_OUTPUT_DIR = 'results';

export const DECIMALS = {
  spend: 2,
  ctr: 4,
  cpa: 2,
} as const;

export const CENTS_PER_DOLLAR = 100;

/**
 * Read chunk size. Measured on the 1GB dataset: 64KB was both faster and leaner than 256KB-4MB,
 * because each chunk's batch of lines stays small enough to die young in the GC.
 */
export const READ_CHUNK_BYTES = 64 * 1024;

/**
 * Longest accepted line. Real rows are ~40 characters; anything near this limit means the file
 * is not newline-delimited (e.g. CR-only line endings) and would otherwise be buffered whole.
 */
export const MAX_LINE_LENGTH = 1024 * 1024;
