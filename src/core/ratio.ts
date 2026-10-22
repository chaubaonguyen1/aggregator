/*
 * Exact arithmetic on non-negative integer ratios. Ranking and output only ever touch a few
 * dozen campaigns, so BigInt costs nothing here and removes every float rounding question.
 */

type Integer = number | bigint;

/** Compares a/b with c/d exactly (all denominators must be positive). */
export function compareRatios(a: Integer, b: Integer, c: Integer, d: Integer): number {
  const left = BigInt(a) * BigInt(d);
  const right = BigInt(c) * BigInt(b);
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/** Formats numerator / denominator with `decimals` places, rounding half up. */
export function formatRatio(numerator: Integer, denominator: Integer, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const doubled = 2n * BigInt(denominator);
  const scaled = (2n * BigInt(numerator) * scale + BigInt(denominator)) / doubled;
  if (decimals === 0) {
    return scaled.toString();
  }
  const fraction = (scaled % scale).toString().padStart(decimals, '0');
  return `${scaled / scale}.${fraction}`;
}
