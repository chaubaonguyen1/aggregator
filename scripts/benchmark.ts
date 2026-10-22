/**
 * Runs the built CLI several times on a dataset and appends the results to benchmarks/benchmark.log.
 *
 * Usage: npm run benchmark -- [inputPath] [runs]
 */
import { spawnSync } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { invocationDir } from '../src/cli/invocationDir.js';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const CLI_ENTRY = fileURLToPath(new URL('../dist/cli/index.js', import.meta.url));
const LOG_FILE = join(REPO_ROOT, 'benchmarks', 'benchmark.log');
const DEFAULT_RUNS = 3;
const BYTES_PER_MEGABYTE = 1024 * 1024;

// Relative paths follow the same rule as the CLI: from where `npm run benchmark` was run.
const inputPath = process.argv[2]
  ? resolve(invocationDir('benchmark'), process.argv[2])
  : join(REPO_ROOT, 'ad_data.csv');
const runs = Number(process.argv[3] ?? DEFAULT_RUNS);
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error(`Number of runs must be a positive integer, got: ${process.argv[3] ?? ''}`);
}

function describeEnvironment(inputBytes: number): string[] {
  const cpus = os.cpus();
  return [
    `Date:    ${new Date().toISOString()}`,
    `Node:    ${process.version}`,
    `OS:      ${os.type()} ${os.release()} (${os.arch()})`,
    `CPU:     ${cpus[0]?.model.trim() ?? 'unknown'} x ${cpus.length}`,
    `Memory:  ${(os.totalmem() / BYTES_PER_MEGABYTE / 1024).toFixed(1)} GB`,
    `Input:   ${basename(inputPath)} (${(inputBytes / BYTES_PER_MEGABYTE).toFixed(1)} MB)`,
  ];
}

async function main(): Promise<void> {
  const inputBytes = (await stat(inputPath)).size;
  const outputDir = await mkdtemp(join(os.tmpdir(), 'ad-aggregator-bench-'));
  const lines = ['='.repeat(72), ...describeEnvironment(inputBytes), ''];

  try {
    for (let run = 1; run <= runs; run++) {
      const startedAt = performance.now();
      const result = spawnSync(
        process.execPath,
        [CLI_ENTRY, '--input', inputPath, '--output', outputDir],
        { encoding: 'utf8' },
      );
      const wallSeconds = ((performance.now() - startedAt) / 1000).toFixed(2);
      if (result.status !== 0) {
        throw new Error(`Run ${run} failed:\n${result.stderr}`);
      }
      const summary = result.stdout.trim().split('\n').at(-1) ?? '';
      lines.push(`Run ${run}: ${summary} | Wall (incl. startup): ${wallSeconds} s`);
      console.log(lines.at(-1));
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }

  await mkdir(join(REPO_ROOT, 'benchmarks'), { recursive: true });
  await appendFile(LOG_FILE, `${lines.join('\n')}\n\n`, 'utf8');
  console.log(`Appended results to ${relative(process.cwd(), LOG_FILE)}`);
}

await main();
