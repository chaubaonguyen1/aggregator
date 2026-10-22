/**
 * Base class for expected failures caused by the input or environment (bad file, bad header, ...).
 * The CLI prints only their message; any other error is treated as a bug and printed with its stack.
 */
export class AppError extends Error {
  override name = 'AppError';
}
