import { describe, expect, it } from 'vitest';
import { LineTooLongError, readLineBatches } from '../../../src/io/lineReader.js';
import type { LineReaderOptions } from '../../../src/io/lineReader.js';
import { writeTempFile } from '../../helpers.js';

async function readAllLines(content: string, options?: LineReaderOptions): Promise<string[]> {
  const path = await writeTempFile('input.csv', content);
  const lines: string[] = [];
  for await (const batch of readLineBatches(path, options)) {
    lines.push(...batch);
  }
  return lines;
}

describe('readLineBatches', () => {
  it('reads every line of a file', async () => {
    expect(await readAllLines('a\nb\nc\n')).toEqual(['a', 'b', 'c']);
  });

  it('keeps the last line when the file has no trailing newline', async () => {
    expect(await readAllLines('a\nb')).toEqual(['a', 'b']);
  });

  it('reassembles lines split across chunk boundaries', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i},value-${i * 7}`);
    expect(await readAllLines(`${lines.join('\n')}\n`, { chunkBytes: 7 })).toEqual(lines);
  });

  it('reassembles a line spanning several chunks', async () => {
    const longLine = 'x'.repeat(100);
    expect(await readAllLines(`a\n${longLine}\nb\n`, { chunkBytes: 8 })).toEqual([
      'a',
      longLine,
      'b',
    ]);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    expect(await readAllLines('café\nnaïve\n', { chunkBytes: 3 })).toEqual(['café', 'naïve']);
  });

  it('leaves the carriage return of CRLF lines to the caller', async () => {
    expect(await readAllLines('a\r\nb\r\n')).toEqual(['a\r', 'b\r']);
  });

  it('yields nothing for an empty file', async () => {
    expect(await readAllLines('')).toEqual([]);
  });

  it('fails fast on a file without newlines instead of buffering it whole', async () => {
    const crOnly = 'header\rrow1\rrow2\r'.repeat(100);
    const reading = readAllLines(`ok\n${crOnly}`, { chunkBytes: 16, maxLineLength: 64 });
    await expect(reading).rejects.toThrow(LineTooLongError);
    await expect(reading).rejects.toThrow('Line 2 is longer than 64 characters');
  });
});
