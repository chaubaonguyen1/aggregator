import { INPUT_COLUMNS } from '../constants.js';
import { AppError } from '../errors.js';
import { isIsoDate, parseAmountToCents, parseNonNegativeInteger } from './fieldParsers.js';
import type { ColumnIndex, InputColumn, ParseResult } from './types.js';

const DELIMITER = ',';
const QUOTE = '"';
const CARRIAGE_RETURN = '\r';
const CHAR_BYTE_ORDER_MARK = 0xfeff;
const CHAR_TAB = 9;
const CHAR_CR = 13;
const CHAR_SPACE = 32;

export class HeaderError extends AppError {
  override name = 'HeaderError';
}

function isWhitespace(code: number): boolean {
  return code === CHAR_SPACE || code === CHAR_TAB || code === CHAR_CR;
}

/** Stops at the first visible character, so it is O(1) for every real data row. */
export function isBlankLine(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    if (!isWhitespace(line.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}

/** Trims exactly the characters that data fields are trimmed of. */
function trimField(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isWhitespace(text.charCodeAt(start))) {
    start++;
  }
  while (end > start && isWhitespace(text.charCodeAt(end - 1))) {
    end--;
  }
  return text.slice(start, end);
}

/**
 * Parses data rows for the column layout declared by a CSV header.
 *
 * Fields are located by offset rather than with `split`, so a row allocates only its campaign id
 * and the result objects; this matters at tens of millions of rows. Surrounding whitespace is
 * ignored in data fields exactly as in header names.
 */
export class RowParser {
  /** Trimmed [start, end) offsets of every field in the current row; reused across rows. */
  private readonly fieldStarts: Int32Array;
  private readonly fieldEnds: Int32Array;

  private constructor(
    private readonly columns: ColumnIndex,
    private readonly columnCount: number,
  ) {
    this.fieldStarts = new Int32Array(columnCount);
    this.fieldEnds = new Int32Array(columnCount);
  }

  /** Locates the required columns by name, so their order in the file does not matter. */
  static fromHeader(headerLine: string): RowParser {
    const header =
      headerLine.charCodeAt(0) === CHAR_BYTE_ORDER_MARK ? headerLine.slice(1) : headerLine;
    if (trimField(header).includes(CARRIAGE_RETURN)) {
      throw new HeaderError(
        'The first line contains a carriage return in the middle: the file seems to use ' +
          'CR-only line endings, which are not supported. Convert it to LF or CRLF.',
      );
    }
    const names = header.split(DELIMITER).map((name) => trimField(name).toLowerCase());

    const missing = INPUT_COLUMNS.filter((column) => !names.includes(column));
    if (missing.length > 0) {
      throw new HeaderError(`CSV header is missing required column(s): ${missing.join(', ')}`);
    }

    const columns = Object.fromEntries(
      INPUT_COLUMNS.map((column) => [column, names.indexOf(column)]),
    ) as Record<InputColumn, number>;
    return new RowParser(columns, names.length);
  }

  /** Returns null for a blank line, which carries no data and is not counted as malformed. */
  parse(line: string): ParseResult | null {
    if (isBlankLine(line)) {
      return null;
    }
    if (!this.locateFields(line)) {
      return { ok: false, reason: 'wrong_column_count' };
    }
    if (line.includes(QUOTE)) {
      return { ok: false, reason: 'quoted_field' };
    }

    const campaignId = line.slice(this.start('campaign_id'), this.end('campaign_id'));
    if (campaignId.length === 0) {
      return { ok: false, reason: 'missing_campaign_id' };
    }
    if (!isIsoDate(line, this.start('date'), this.end('date'))) {
      return { ok: false, reason: 'invalid_date' };
    }
    const impressions = parseNonNegativeInteger(
      line,
      this.start('impressions'),
      this.end('impressions'),
    );
    if (impressions === null) {
      return { ok: false, reason: 'invalid_impressions' };
    }
    const clicks = parseNonNegativeInteger(line, this.start('clicks'), this.end('clicks'));
    if (clicks === null) {
      return { ok: false, reason: 'invalid_clicks' };
    }
    const spendCents = parseAmountToCents(line, this.start('spend'), this.end('spend'));
    if (spendCents === null) {
      return { ok: false, reason: 'invalid_spend' };
    }
    const conversions = parseNonNegativeInteger(
      line,
      this.start('conversions'),
      this.end('conversions'),
    );
    if (conversions === null) {
      return { ok: false, reason: 'invalid_conversions' };
    }

    return { ok: true, record: { campaignId, impressions, clicks, spendCents, conversions } };
  }

  /** Records the trimmed bounds of each field; false unless the row has exactly `columnCount` fields. */
  private locateFields(line: string): boolean {
    let fieldStart = 0;
    for (let field = 0; field < this.columnCount; field++) {
      const delimiter = line.indexOf(DELIMITER, fieldStart);
      const isLastField = field === this.columnCount - 1;
      if ((delimiter === -1) !== isLastField) {
        return false;
      }
      const fieldEnd = isLastField ? line.length : delimiter;
      this.recordTrimmedBounds(field, line, fieldStart, fieldEnd);
      fieldStart = fieldEnd + 1;
    }
    return true;
  }

  private recordTrimmedBounds(field: number, line: string, start: number, end: number): void {
    while (start < end && isWhitespace(line.charCodeAt(start))) {
      start++;
    }
    while (end > start && isWhitespace(line.charCodeAt(end - 1))) {
      end--;
    }
    this.fieldStarts[field] = start;
    this.fieldEnds[field] = end;
  }

  private start(column: InputColumn): number {
    return this.fieldStarts[this.columns[column]];
  }

  private end(column: InputColumn): number {
    return this.fieldEnds[this.columns[column]];
  }
}
