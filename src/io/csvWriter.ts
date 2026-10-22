import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { OUTPUT_COLUMNS } from '../constants.js';
import { formatCpa, formatCtr, formatSpend } from '../core/metrics.js';
import type { CampaignTotals } from '../core/types.js';
import { AppError } from '../errors.js';

export class OutputFileError extends AppError {
  override name = 'OutputFileError';
}

/**
 * Leading characters that make spreadsheet applications evaluate a cell as a formula.
 * OWASP also lists tab and carriage return, but fields are trimmed while parsing, so they can
 * never lead a value here.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@']);

/**
 * Neutralises CSV formula injection by prefixing a quote, as OWASP recommends. Note that this
 * changes the written id (`-CMP1` becomes `'-CMP1`); ids like `CMP001` are unaffected.
 * Commas and quotes cannot occur: rows containing them are rejected while parsing.
 */
export function escapeCsvField(value: string): string {
  return FORMULA_TRIGGERS.has(value.charAt(0)) ? `'${value}` : value;
}

export function toCsvRow(campaign: CampaignTotals): string {
  return [
    escapeCsvField(campaign.campaignId),
    campaign.impressions,
    campaign.clicks,
    formatSpend(campaign),
    campaign.conversions,
    formatCtr(campaign),
    formatCpa(campaign),
  ].join(',');
}

export function toCsv(campaigns: readonly CampaignTotals[]): string {
  const lines = [OUTPUT_COLUMNS.join(','), ...campaigns.map(toCsvRow)];
  return `${lines.join('\n')}\n`;
}

export interface CsvOutput {
  filePath: string;
  campaigns: readonly CampaignTotals[];
}

/** Error codes Windows reports when another program (e.g. Excel) has a file open. */
const LOCKED_FILE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

async function ensureDirectory(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    const code = errorCode(error);
    if (code === 'EEXIST' || code === 'ENOTDIR') {
      throw new OutputFileError(`Output path is not a directory: ${dir}`, { cause: error });
    }
    throw error;
  }
}

async function assertNotDirectory(path: string): Promise<void> {
  const info = await stat(path).catch(() => undefined);
  if (info?.isDirectory()) {
    throw new OutputFileError(`Cannot write ${path}: a directory with that name exists`);
  }
}

interface StagedOutput extends CsvOutput {
  tempPath: string;
  backupPath: string;
}

/** Tracks what has been changed on disk so that a failure can undo exactly that. */
interface Progress {
  backedUp: Set<StagedOutput>;
  placed: Set<StagedOutput>;
}

async function writeToTempFile(output: StagedOutput): Promise<void> {
  await ensureDirectory(dirname(output.filePath));
  await assertNotDirectory(output.filePath);
  await writeFile(output.tempPath, toCsv(output.campaigns), 'utf8');
}

async function backUpExisting(output: StagedOutput, progress: Progress): Promise<void> {
  try {
    await rename(output.filePath, output.backupPath);
    progress.backedUp.add(output);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw error;
    }
  }
}

async function moveIntoPlace(output: StagedOutput, progress: Progress): Promise<void> {
  await rename(output.tempPath, output.filePath);
  progress.placed.add(output);
}

/** Best effort: put every previous file back and remove everything this run created. */
async function rollBack(output: StagedOutput, progress: Progress): Promise<void> {
  if (progress.backedUp.has(output)) {
    await rename(output.backupPath, output.filePath);
  } else if (progress.placed.has(output)) {
    await rm(output.filePath, { force: true });
  }
  await rm(output.tempPath, { force: true });
}

/**
 * Like Promise.all, but rejects only once every task has settled, so that a rollback never
 * races a task that is still running.
 */
async function settleAll(tasks: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure !== undefined) {
    throw failure.reason;
  }
}

function describeFailure(error: unknown): unknown {
  if (!LOCKED_FILE_CODES.has(errorCode(error) ?? '')) {
    return error;
  }
  const path = (error as NodeJS.ErrnoException).path ?? 'an output file';
  return new OutputFileError(
    `Cannot replace ${path}: it may be open in another program (e.g. Excel). ` +
      'Close it and run again; the previous results were left unchanged.',
    { cause: error },
  );
}

/**
 * Replaces all output files or none of them:
 *   1. every file is written to a temporary sibling;
 *   2. existing results are moved aside to backups (a file locked by another program fails here,
 *      before any new result is in place);
 *   3. the temporary files are moved into place.
 * Any failure restores the backups and removes the temporary files, so old and new results are
 * never mixed.
 */
export async function writeCsvFiles(outputs: readonly CsvOutput[]): Promise<void> {
  const staged = outputs.map((output) => ({
    ...output,
    tempPath: `${output.filePath}.${process.pid}.tmp`,
    backupPath: `${output.filePath}.${process.pid}.bak`,
  }));
  const progress: Progress = { backedUp: new Set(), placed: new Set() };

  try {
    await settleAll(staged.map(writeToTempFile));
    await settleAll(staged.map((output) => backUpExisting(output, progress)));
    await settleAll(staged.map((output) => moveIntoPlace(output, progress)));
  } catch (error) {
    await Promise.allSettled(staged.map((output) => rollBack(output, progress)));
    throw describeFailure(error);
  }

  await Promise.all([...progress.backedUp].map((output) => rm(output.backupPath, { force: true })));
}
