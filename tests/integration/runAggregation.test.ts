import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InputFileError, runAggregation } from '../../src/app/runAggregation.js';
import { HeaderError } from '../../src/core/rowParser.js';
import { fixturePath, makeTempDir, writeTempFile } from '../helpers.js';

const HEADER = 'campaign_id,date,impressions,clicks,spend,conversions';

async function readOutputs(outputDir: string): Promise<[string, string]> {
  return Promise.all([
    readFile(join(outputDir, 'top10_ctr.csv'), 'utf8'),
    readFile(join(outputDir, 'top10_cpa.csv'), 'utf8'),
  ]);
}

async function readExpected(): Promise<[string, string]> {
  return Promise.all([
    readFile(fixturePath('expected_top10_ctr.csv'), 'utf8'),
    readFile(fixturePath('expected_top10_cpa.csv'), 'utf8'),
  ]);
}

async function runOn(content: string): Promise<ReturnType<typeof runAggregation>> {
  const inputPath = await writeTempFile('input.csv', content);
  return runAggregation({ inputPath, outputDir: await makeTempDir() });
}

describe('runAggregation', () => {
  it('writes the expected top-10 files', async () => {
    const outputDir = await makeTempDir();
    const report = await runAggregation({ inputPath: fixturePath('sample.csv'), outputDir });

    expect(await readOutputs(outputDir)).toEqual(await readExpected());
    expect(report).toMatchObject({ dataRows: 7, aggregatedRows: 7, campaignCount: 5 });
  });

  it('skips malformed rows, counts them by reason and still produces correct output', async () => {
    const outputDir = await makeTempDir();
    const report = await runAggregation({
      inputPath: fixturePath('with_malformed_rows.csv'),
      outputDir,
    });

    expect(await readOutputs(outputDir)).toEqual(await readExpected());
    expect(report).toMatchObject({ dataRows: 15, aggregatedRows: 7, blankLines: 1 });
    expect(report.skippedRows).toEqual({
      wrong_column_count: 1,
      quoted_field: 1,
      missing_campaign_id: 1,
      invalid_date: 1,
      invalid_impressions: 1,
      invalid_clicks: 1,
      invalid_spend: 1,
      invalid_conversions: 1,
    });
  });

  it('produces the same output for CRLF line endings', async () => {
    const content = await readFile(fixturePath('sample.csv'), 'utf8');
    const inputPath = await writeTempFile('crlf.csv', content.replaceAll('\n', '\r\n'));
    const outputDir = await makeTempDir();
    await runAggregation({ inputPath, outputDir });

    expect(await readOutputs(outputDir)).toEqual(await readExpected());
  });

  it('fails when the input file does not exist', async () => {
    await expect(
      runAggregation({ inputPath: 'does-not-exist.csv', outputDir: await makeTempDir() }),
    ).rejects.toThrow(new InputFileError('Input file not found: does-not-exist.csv'));
  });

  it('fails when the input path is a directory', async () => {
    const dir = await makeTempDir();
    await expect(runAggregation({ inputPath: dir, outputDir: dir })).rejects.toThrow('not a file');
  });

  it('skips blank lines before the header', async () => {
    const content = await readFile(fixturePath('sample.csv'), 'utf8');
    const report = await runOn(`\n  \n${content}`);

    expect(report).toMatchObject({ dataRows: 7, aggregatedRows: 7, blankLines: 2 });
  });

  it('fails when the input file is empty', async () => {
    await expect(runOn('')).rejects.toThrow('Input file is empty');
  });

  it('fails when the input has a header but no data rows', async () => {
    await expect(runOn(`${HEADER}\n\n`)).rejects.toThrow('has a header but no data rows');
  });

  it('fails without writing results when every data row is malformed', async () => {
    const outputDir = await makeTempDir();
    const inputPath = await writeTempFile('bad.csv', `${HEADER}\nA,bad-date,1,1,1.00,1\n`);

    await expect(runAggregation({ inputPath, outputDir })).rejects.toThrow(
      'None of the 1 data rows',
    );
    await expect(readFile(join(outputDir, 'top10_ctr.csv'))).rejects.toThrow('ENOENT');
  });

  it('fails when the header lacks a required column', async () => {
    await expect(
      runAggregation({
        inputPath: fixturePath('missing_column.csv'),
        outputDir: await makeTempDir(),
      }),
    ).rejects.toThrow(HeaderError);
  });
});
