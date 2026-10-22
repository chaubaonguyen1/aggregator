import { CENTS_PER_DOLLAR } from '../constants.js';

/*
 * Parsers work on a [start, end) range of a line instead of a substring, so the hot loop
 * does not allocate a new string for every numeric field of every row.
 */

const CHAR_0 = 48;
const CHAR_9 = 57;
const CHAR_DASH = 45;

/** Longest digit string whose integer value is guaranteed to be a safe integer. */
const MAX_SAFE_DIGITS = 15;
const MAX_FRACTION_DIGITS = 2;

const ISO_DATE_LENGTH = 10;

/**
 * Parses a plain non-negative integer ("0", "12000").
 * Returns null for anything else: empty, signs, decimals, whitespace, or unsafe magnitudes.
 */
export function parseNonNegativeInteger(text: string, start = 0, end = text.length): number | null {
  const length = end - start;
  if (length <= 0 || length > MAX_SAFE_DIGITS) {
    return null;
  }
  let value = 0;
  for (let i = start; i < end; i++) {
    const digit = text.charCodeAt(i) - CHAR_0;
    if (digit < 0 || digit > CHAR_9 - CHAR_0) {
      return null;
    }
    value = value * 10 + digit;
  }
  return value;
}

function toSafeCents(dollars: number, cents: number): number | null {
  const total = dollars * CENTS_PER_DOLLAR + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Parses a non-negative USD amount with at most two decimals ("45", "45.5", "45.50")
 * into integer cents, without going through floating point.
 * Returns null for malformed amounts and for amounts too large to hold exactly in cents.
 */
export function parseAmountToCents(text: string, start = 0, end = text.length): number | null {
  const dotIndex = text.indexOf('.', start);
  if (dotIndex === -1 || dotIndex >= end) {
    const dollars = parseNonNegativeInteger(text, start, end);
    return dollars === null ? null : toSafeCents(dollars, 0);
  }

  const fractionDigits = end - dotIndex - 1;
  if (fractionDigits === 0 || fractionDigits > MAX_FRACTION_DIGITS) {
    return null;
  }
  const dollars = parseNonNegativeInteger(text, start, dotIndex);
  const fraction = parseNonNegativeInteger(text, dotIndex + 1, end);
  if (dollars === null || fraction === null) {
    return null;
  }
  return toSafeCents(dollars, fractionDigits === 1 ? fraction * 10 : fraction);
}

/** Checks the YYYY-MM-DD shape with a plausible month and day; calendar validity is not checked. */
export function isIsoDate(text: string, start = 0, end = text.length): boolean {
  if (
    end - start !== ISO_DATE_LENGTH ||
    text.charCodeAt(start + 4) !== CHAR_DASH ||
    text.charCodeAt(start + 7) !== CHAR_DASH
  ) {
    return false;
  }
  const year = parseNonNegativeInteger(text, start, start + 4);
  const month = parseNonNegativeInteger(text, start + 5, start + 7);
  const day = parseNonNegativeInteger(text, start + 8, end);
  return (
    year !== null &&
    month !== null &&
    day !== null &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  );
}
