import { spawnSync } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixturePath, makeTempDir } from '../helpers.js';

/** The built entry point; tests/globalSetup.ts compiles it before the suite runs. */
const CLI_ENTRY = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));

const NPM_VARIABLES = /^(init_cwd|npm_lifecycle_event)$/i;

interface RunOptions {
  /** Working directory of the process; defaults to the test runner's. */
  cwd?: string;
  /** npm variables to set, e.g. to simulate `npm start` run from some directory. */
  npmEnv?: { INIT_CWD: string; npm_lifecycle_event: string };
}

function runCli(
  args: string[],
  { cwd, npmEnv }: RunOptions = {},
): { status: number | null; stdout: string; stderr: string } {
  // npm and npx set these for the test run itself; drop them so every test controls its own
  // values. Matched case-insensitively: Windows may report them as e.g. NPM_LIFECYCLE_EVENT, and a
  // leftover upper-case copy would shadow the value set below.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !NPM_VARIABLES.test(key)),
  );
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: 'utf8',
    cwd,
    env: { ...env, ...npmEnv },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI', () => {
  it('aggregates the input, writes both files and reports a summary', async () => {
    const outputDir = await makeTempDir();
    const { status, stdout, stderr } = runCli([
      '--input',
      fixturePath('sample.csv'),
      '--output',
      outputDir,
    ]);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Processed 7 rows (7 aggregated, 0 skipped) across 5 campaigns');
    expect(stdout).toMatch(/Elapsed: [\d.]+ s \| Peak RSS: [\d.]+ MB/);
    const files = ['top10_ctr.csv', 'top10_cpa.csv'];
    const [actual, expected] = await Promise.all([
      Promise.all(files.map((file) => readFile(join(outputDir, file), 'utf8'))),
      Promise.all(files.map((file) => readFile(fixturePath(`expected_${file}`), 'utf8'))),
    ]);
    expect(actual).toEqual(expected);
  });

  it('warns about skipped rows on stderr', async () => {
    const { status, stderr } = runCli([
      '-i',
      fixturePath('with_malformed_rows.csv'),
      '-o',
      await makeTempDir(),
    ]);

    expect(status).toBe(0);
    expect(stderr).toContain('Warning: skipped 8 malformed row(s)');
    expect(stderr).toContain('quoted_field=1');
  });

  it('exits with 1 and names the resolved path when the input is missing', async () => {
    const dir = await makeTempDir();
    const { status, stderr } = runCli(['--input', 'missing.csv'], { cwd: dir });

    expect(status).toBe(1);
    expect(stderr.trim()).toBe(`Error: Input file not found: ${join(dir, 'missing.csv')}`);
  });

  it('resolves relative paths from the working directory when run directly', async () => {
    const dir = await makeTempDir();
    await copyFile(fixturePath('sample.csv'), join(dir, 'my ads.csv'));
    const { status } = runCli(['--input', 'my ads.csv', '--output', 'out'], { cwd: dir });

    expect(status).toBe(0);
    expect(await readFile(join(dir, 'out', 'top10_ctr.csv'), 'utf8')).toBe(
      await readFile(fixturePath('expected_top10_ctr.csv'), 'utf8'),
    );
  });

  it('resolves relative paths from where `npm start` was run, not from the package root', async () => {
    const userDir = await makeTempDir();
    const packageRoot = await makeTempDir();
    await copyFile(fixturePath('sample.csv'), join(userDir, 'ad_data.csv'));
    const { status } = runCli(['--input', 'ad_data.csv', '--output', 'results'], {
      cwd: packageRoot,
      npmEnv: { INIT_CWD: userDir, npm_lifecycle_event: 'start' },
    });

    expect(status).toBe(0);
    expect(await readFile(join(userDir, 'results', 'top10_cpa.csv'), 'utf8')).toBe(
      await readFile(fixturePath('expected_top10_cpa.csv'), 'utf8'),
    );
  });

  it('ignores an INIT_CWD inherited from another npm script when run directly', async () => {
    const dir = await makeTempDir();
    await copyFile(fixturePath('sample.csv'), join(dir, 'ad_data.csv'));
    const { status } = runCli(['--input', 'ad_data.csv', '--output', 'out'], {
      cwd: dir,
      npmEnv: { INIT_CWD: await makeTempDir(), npm_lifecycle_event: 'test' },
    });

    expect(status).toBe(0);
  });

  it('exits with 1 and a one-line message when the header is invalid', async () => {
    const { status, stderr } = runCli([
      '--input',
      fixturePath('missing_column.csv'),
      '--output',
      await makeTempDir(),
    ]);

    expect(status).toBe(1);
    expect(stderr.trim()).toBe('Error: CSV header is missing required column(s): spend');
  });

  it('exits with 2 and prints usage on invalid arguments', () => {
    const { status, stderr } = runCli([]);

    expect(status).toBe(2);
    expect(stderr).toContain('Missing required option --input');
    expect(stderr).toContain('Usage:');
  });

  it('prints usage with --help', () => {
    const { status, stdout } = runCli(['--help']);

    expect(status).toBe(0);
    expect(stdout).toContain('Usage:');
  });
});
