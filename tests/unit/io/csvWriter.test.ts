import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OutputFileError,
  escapeCsvField,
  toCsv,
  toCsvRow,
  writeCsvFiles,
} from '../../../src/io/csvWriter.js';
import type { CampaignTotals } from '../../../src/core/types.js';
import { makeTempDir } from '../../helpers.js';

const HEADER = 'campaign_id,total_impressions,total_clicks,total_spend,total_conversions,CTR,CPA';

const campaign: CampaignTotals = {
  campaignId: 'CMP042',
  impressions: 125000,
  clicks: 6250,
  spendCents: 1250050,
  conversions: 625,
};

describe('escapeCsvField', () => {
  it.each(['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)'])(
    'neutralises the formula-like value %j',
    (value) => {
      expect(escapeCsvField(value)).toBe(`'${value}`);
    },
  );

  it('leaves ordinary values alone', () => {
    expect(escapeCsvField('CMP-001')).toBe('CMP-001');
  });
});

describe('toCsvRow', () => {
  it('formats spend, CTR and CPA with fixed decimals', () => {
    expect(toCsvRow(campaign)).toBe('CMP042,125000,6250,12500.50,625,0.0500,20.00');
  });

  it('rounds CTR and CPA half up', () => {
    const halfWay = { ...campaign, impressions: 20000, clicks: 3, spendCents: 203, conversions: 2 };
    expect(toCsvRow(halfWay)).toBe('CMP042,20000,3,2.03,2,0.0002,1.02');
  });

  it('leaves CPA empty without conversions and CTR empty without impressions', () => {
    expect(toCsvRow({ ...campaign, conversions: 0 })).toBe('CMP042,125000,6250,12500.50,0,0.0500,');
    expect(toCsvRow({ ...campaign, impressions: 0, clicks: 0 })).toBe(
      'CMP042,0,0,12500.50,625,,20.00',
    );
  });

  it('escapes formula-like campaign ids', () => {
    expect(toCsvRow({ ...campaign, campaignId: '=1+1' })).toMatch(/^'=1\+1,/);
  });
});

describe('toCsv', () => {
  it('writes only the header when there are no campaigns', () => {
    expect(toCsv([])).toBe(`${HEADER}\n`);
  });
});

describe('writeCsvFiles', () => {
  it('creates missing output directories and leaves no temporary files', async () => {
    const dir = join(await makeTempDir(), 'nested');
    await writeCsvFiles([
      { filePath: join(dir, 'a.csv'), campaigns: [campaign] },
      { filePath: join(dir, 'b.csv'), campaigns: [] },
    ]);

    expect(await readFile(join(dir, 'a.csv'), 'utf8')).toBe(toCsv([campaign]));
    expect(await readFile(join(dir, 'b.csv'), 'utf8')).toBe(toCsv([]));
    expect(new Set(await readdir(dir))).toEqual(new Set(['a.csv', 'b.csv']));
  });

  it('writes nothing when any file cannot be written', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'a.csv'), 'previous results', 'utf8');
    await mkdir(join(dir, 'b.csv'));

    await expect(
      writeCsvFiles([
        { filePath: join(dir, 'a.csv'), campaigns: [campaign] },
        { filePath: join(dir, 'b.csv'), campaigns: [campaign] },
      ]),
    ).rejects.toThrow(OutputFileError);
    expect(await readFile(join(dir, 'a.csv'), 'utf8')).toBe('previous results');
    expect(new Set(await readdir(dir))).toEqual(new Set(['a.csv', 'b.csv']));
  });

  it('replaces existing files and removes the backups', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'a.csv'), 'previous a', 'utf8');
    await writeFile(join(dir, 'b.csv'), 'previous b', 'utf8');

    await writeCsvFiles([
      { filePath: join(dir, 'a.csv'), campaigns: [campaign] },
      { filePath: join(dir, 'b.csv'), campaigns: [] },
    ]);

    expect(await readFile(join(dir, 'a.csv'), 'utf8')).toBe(toCsv([campaign]));
    expect(await readFile(join(dir, 'b.csv'), 'utf8')).toBe(toCsv([]));
    expect(new Set(await readdir(dir))).toEqual(new Set(['a.csv', 'b.csv']));
  });

  it('restores every previous file when one of them cannot be replaced', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'a.csv'), 'previous a', 'utf8');
    await writeFile(join(dir, 'b.csv'), 'previous b', 'utf8');
    // Occupy b.csv's backup path with a non-empty directory, so moving b.csv aside fails the way
    // a file locked by another program does.
    const blocker = `b.csv.${process.pid}.bak`;
    await mkdir(join(dir, blocker, 'occupied'), { recursive: true });

    await expect(
      writeCsvFiles([
        { filePath: join(dir, 'a.csv'), campaigns: [campaign] },
        { filePath: join(dir, 'b.csv'), campaigns: [campaign] },
      ]),
    ).rejects.toThrow();
    expect(await readFile(join(dir, 'a.csv'), 'utf8')).toBe('previous a');
    expect(await readFile(join(dir, 'b.csv'), 'utf8')).toBe('previous b');
    expect(new Set(await readdir(dir))).toEqual(new Set(['a.csv', 'b.csv', blocker]));
  });

  it('reports an output path that is a file, not a directory', async () => {
    const file = join(await makeTempDir(), 'results');
    await writeFile(file, 'not a directory', 'utf8');

    await expect(
      writeCsvFiles([{ filePath: join(file, 'a.csv'), campaigns: [campaign] }]),
    ).rejects.toThrow(new OutputFileError(`Output path is not a directory: ${file}`));
  });
});
