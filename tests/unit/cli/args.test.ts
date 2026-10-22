import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UsageError, parseCliArgs } from '../../../src/cli/args.js';

const BASE_DIR = resolve('/work/project');

describe('parseCliArgs', () => {
  it('resolves input and output paths against the base directory', () => {
    expect(parseCliArgs(['--input', 'data.csv', '--output', 'out/'], BASE_DIR)).toEqual({
      kind: 'run',
      inputPath: resolve(BASE_DIR, 'data.csv'),
      outputDir: resolve(BASE_DIR, 'out'),
    });
  });

  it('supports short flags and defaults the output directory', () => {
    expect(parseCliArgs(['-i', '../data.csv'], BASE_DIR)).toEqual({
      kind: 'run',
      inputPath: resolve(BASE_DIR, '../data.csv'),
      outputDir: resolve(BASE_DIR, 'results'),
    });
  });

  it('keeps absolute paths as they are', () => {
    const input = resolve('/elsewhere/ad_data.csv');
    expect(parseCliArgs(['-i', input], BASE_DIR)).toMatchObject({ inputPath: input });
  });

  it('defaults the base directory to the current working directory', () => {
    expect(parseCliArgs(['-i', 'data.csv'])).toMatchObject({
      inputPath: resolve(process.cwd(), 'data.csv'),
    });
  });

  it('returns help when requested', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
  });

  it.each([
    [[]],
    [['--input']],
    [['--input', '']],
    [['--input', 'data.csv', '--output', '']],
    [['--unknown']],
    [['data.csv']],
  ])('rejects %j', (argv) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
  });
});
