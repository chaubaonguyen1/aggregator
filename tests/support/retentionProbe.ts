/**
 * Aggregates a CSV and prints how much heap is still retained afterwards.
 * Run with: node --expose-gc --import tsx retentionProbe.ts <csvPath> <chunkBytes>
 */
import { CampaignAggregator } from '../../src/core/aggregator.js';
import { RowParser } from '../../src/core/rowParser.js';
import { readLineBatches } from '../../src/io/lineReader.js';

const [csvPath = '', chunkBytes = ''] = process.argv.slice(2);
const { gc } = globalThis;
if (csvPath === '' || chunkBytes === '' || gc === undefined) {
  throw new Error('Usage: node --expose-gc --import tsx retentionProbe.ts <csvPath> <chunkBytes>');
}

gc();
const heapBefore = process.memoryUsage().heapUsed;

const aggregator = new CampaignAggregator();
let parser: RowParser | undefined;
for await (const lines of readLineBatches(csvPath, { chunkBytes: Number(chunkBytes) })) {
  for (const line of lines) {
    if (parser === undefined) {
      parser = RowParser.fromHeader(line);
      continue;
    }
    const result = parser.parse(line);
    if (result?.ok) {
      aggregator.add(result.record);
    }
  }
}

gc();
gc();
const retainedBytes = process.memoryUsage().heapUsed - heapBefore;
console.log(JSON.stringify({ retainedBytes, campaigns: aggregator.campaignCount }));
