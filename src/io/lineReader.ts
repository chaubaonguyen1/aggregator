import { createReadStream } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { MAX_LINE_LENGTH, READ_CHUNK_BYTES } from '../constants.js';
import { AppError } from '../errors.js';

const NEWLINE = '\n';

export class LineTooLongError extends AppError {
  override name = 'LineTooLongError';

  constructor(lineNumber: number, maxLineLength: number) {
    super(
      `Line ${lineNumber} is longer than ${maxLineLength} characters; ` +
        'the input does not look like a newline-delimited CSV (CR-only line endings?)',
    );
  }
}

export interface LineReaderOptions {
  chunkBytes?: number;
  maxLineLength?: number;
}

/**
 * Streams a text file and yields its lines in batches, one batch per chunk read.
 *
 * Yielding batches instead of single lines avoids one promise round-trip per line,
 * which dominates the run time on files with tens of millions of rows.
 * Lines keep a trailing "\r" if the file uses CRLF; callers decide how to handle it.
 */
export async function* readLineBatches(
  filePath: string,
  { chunkBytes = READ_CHUNK_BYTES, maxLineLength = MAX_LINE_LENGTH }: LineReaderOptions = {},
): AsyncGenerator<string[]> {
  const stream = createReadStream(filePath, { highWaterMark: chunkBytes });
  const decoder = new StringDecoder('utf8');
  let partialLine = '';
  let linesRead = 0;

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const text = decoder.write(chunk);
    const lastNewline = text.lastIndexOf(NEWLINE);
    if (lastNewline === -1) {
      partialLine += text;
      if (partialLine.length > maxLineLength) {
        stream.destroy();
        throw new LineTooLongError(linesRead + 1, maxLineLength);
      }
      continue;
    }
    const lines = (partialLine + text.slice(0, lastNewline)).split(NEWLINE);
    partialLine = text.slice(lastNewline + 1);
    linesRead += lines.length;
    yield lines;
  }

  const lastLine = partialLine + decoder.end();
  if (lastLine.length > 0) {
    yield [lastLine];
  }
}
