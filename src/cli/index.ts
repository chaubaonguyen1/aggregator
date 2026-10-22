import { performance } from 'node:perf_hooks';
import { runAggregation } from '../app/runAggregation.js';
import type { AggregationReport } from '../app/runAggregation.js';
import { AppError } from '../errors.js';
import { USAGE, UsageError, parseCliArgs } from './args.js';
import { invocationDir } from './invocationDir.js';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const KILOBYTES_PER_MEGABYTE = 1024;

/** The package.json script that runs this CLI; see invocationDir. */
const NPM_SCRIPT = 'start';

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Errors caused by the input or environment, as opposed to bugs in this program. */
function isExpectedError(error: unknown): error is Error {
  const isSystemError =
    error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
  return error instanceof AppError || isSystemError;
}

function printReport(report: AggregationReport, elapsedMs: number): void {
  const skipped = Object.entries(report.skippedRows).filter(([, count]) => count > 0);
  const skippedTotal = report.dataRows - report.aggregatedRows;

  console.log(
    `Processed ${formatCount(report.dataRows)} rows ` +
      `(${formatCount(report.aggregatedRows)} aggregated, ${formatCount(skippedTotal)} skipped) ` +
      `across ${formatCount(report.campaignCount)} campaigns`,
  );
  for (const file of report.outputFiles) {
    console.log(`Wrote ${file}`);
  }
  const peakRssMb = process.resourceUsage().maxRSS / KILOBYTES_PER_MEGABYTE;
  console.log(`Elapsed: ${(elapsedMs / 1000).toFixed(2)} s | Peak RSS: ${peakRssMb.toFixed(1)} MB`);

  if (skipped.length > 0) {
    const details = skipped.map(([reason, count]) => `${reason}=${formatCount(count)}`).join(', ');
    console.error(`Warning: skipped ${formatCount(skippedTotal)} malformed row(s): ${details}`);
  }
}

async function main(argv: readonly string[]): Promise<number> {
  let command;
  try {
    command = parseCliArgs(argv, invocationDir(NPM_SCRIPT));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    throw error;
  }

  if (command.kind === 'help') {
    console.log(USAGE);
    return EXIT_OK;
  }

  const startedAt = performance.now();
  try {
    const report = await runAggregation(command);
    printReport(report, performance.now() - startedAt);
    return EXIT_OK;
  } catch (error) {
    if (isExpectedError(error)) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
    return EXIT_FAILURE;
  }
}

process.exitCode = await main(process.argv.slice(2));
