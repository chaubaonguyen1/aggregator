import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { writeTempFile } from '../helpers.js';

const PROBE = fileURLToPath(new URL('../support/retentionProbe.ts', import.meta.url));

const CHUNK_BYTES = 4096;
const CAMPAIGNS = 2000;
const FILLER_ROW = 'X,2025-01-01,1,1,1.00,1\n';

/**
 * Every campaign first appears in its own chunk, with an id long enough for V8 to slice it out
 * of the chunk instead of copying it. If the aggregator kept such slices as map keys, each
 * campaign would pin a whole chunk: ~8MB here.
 */
function buildInput(): string {
  const fillerPerChunk = FILLER_ROW.repeat(Math.ceil(CHUNK_BYTES / FILLER_ROW.length));
  const rows = Array.from(
    { length: CAMPAIGNS },
    (_, i) => `campaign-${String(i).padStart(6, '0')}-with-a-long-id,2025-01-01,1,1,1.00,1\n`,
  );
  return `campaign_id,date,impressions,clicks,spend,conversions\n${rows
    .map((row) => row + fillerPerChunk)
    .join('')}`;
}

describe('memory retention', () => {
  it('does not keep input chunks alive through long campaign ids', async () => {
    const inputPath = await writeTempFile('long-ids.csv', buildInput());
    const result = spawnSync(
      process.execPath,
      ['--expose-gc', '--import', 'tsx', PROBE, inputPath, String(CHUNK_BYTES)],
      { encoding: 'utf8' },
    );
    expect(result.stderr).toBe('');

    const { retainedBytes, campaigns } = JSON.parse(result.stdout) as {
      retainedBytes: number;
      campaigns: number;
    };
    expect(campaigns).toBe(CAMPAIGNS + 1);
    expect(retainedBytes).toBeLessThan(2 * 1024 * 1024);
  });
});
