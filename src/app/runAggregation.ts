import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { OUTPUT_FILES, TOP_N } from '../constants.js';
import { CampaignAggregator } from '../core/aggregator.js';
import { topByCpa, topByCtr } from '../core/ranking.js';
import { RowParser, isBlankLine } from '../core/rowParser.js';
import { SKIP_REASONS } from '../core/types.js';
import type { ParseResult, SkipReason } from '../core/types.js';
import { AppError } from '../errors.js';
import { writeCsvFiles } from '../io/csvWriter.js';
import { readLineBatches } from '../io/lineReader.js';

export class InputFileError extends AppError {
  override name = 'InputFileError';
}

export interface AggregationOptions {
  inputPath: string;
  outputDir: string;
}

export interface AggregationReport {
  /** Non-blank lines after the header. */
  dataRows: number;
  aggregatedRows: number;
  skippedRows: Record<SkipReason, number>;
  blankLines: number;
  campaignCount: number;
  outputFiles: string[];
}

/** Everything learned from one pass over the input file. */
class InputScan {
  readonly aggregator = new CampaignAggregator();
  readonly skippedRows = Object.fromEntries(SKIP_REASONS.map((reason) => [reason, 0])) as Record<
    SkipReason,
    number
  >;
  hasHeader = false;
  dataRows = 0;
  aggregatedRows = 0;
  blankLines = 0;

  record(result: ParseResult | null): void {
    if (result === null) {
      this.blankLines++;
      return;
    }
    this.dataRows++;
    if (result.ok) {
      this.aggregator.add(result.record);
      this.aggregatedRows++;
    } else {
      this.skippedRows[result.reason]++;
    }
  }
}

async function assertReadableFile(path: string): Promise<void> {
  const info = await stat(path).catch((error: unknown) => {
    const isMissing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    throw new InputFileError(
      isMissing
        ? `Input file not found: ${path}`
        : `Cannot access input file ${path}: ${String(error)}`,
      { cause: error },
    );
  });
  if (!info.isFile()) {
    throw new InputFileError(`Input path is not a file: ${path}`);
  }
}

async function scanInput(inputPath: string): Promise<InputScan> {
  const scan = new InputScan();
  let rowParser: RowParser | undefined;
  for await (const lines of readLineBatches(inputPath)) {
    for (const line of lines) {
      if (rowParser !== undefined) {
        scan.record(rowParser.parse(line));
      } else if (isBlankLine(line)) {
        scan.record(null);
      } else {
        rowParser = RowParser.fromHeader(line);
      }
    }
  }
  scan.hasHeader = rowParser !== undefined;
  return scan;
}

function assertHasResults(scan: InputScan, inputPath: string): void {
  if (!scan.hasHeader) {
    throw new InputFileError(`Input file is empty: ${inputPath}`);
  }
  if (scan.dataRows === 0) {
    throw new InputFileError(`Input file has a header but no data rows: ${inputPath}`);
  }
  if (scan.aggregatedRows === 0) {
    throw new InputFileError(
      `None of the ${scan.dataRows} data rows in ${inputPath} are valid; no results written`,
    );
  }
}

export async function runAggregation(options: AggregationOptions): Promise<AggregationReport> {
  await assertReadableFile(options.inputPath);
  const scan = await scanInput(options.inputPath);
  assertHasResults(scan, options.inputPath);

  const campaigns = scan.aggregator.totals();
  const ctrFile = join(options.outputDir, OUTPUT_FILES.topByCtr);
  const cpaFile = join(options.outputDir, OUTPUT_FILES.topByCpa);
  await writeCsvFiles([
    { filePath: ctrFile, campaigns: topByCtr(campaigns, TOP_N) },
    { filePath: cpaFile, campaigns: topByCpa(campaigns, TOP_N) },
  ]);

  return {
    dataRows: scan.dataRows,
    aggregatedRows: scan.aggregatedRows,
    skippedRows: scan.skippedRows,
    blankLines: scan.blankLines,
    campaignCount: scan.aggregator.campaignCount,
    outputFiles: [ctrFile, cpaFile],
  };
}
