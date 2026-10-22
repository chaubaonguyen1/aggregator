import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_OUTPUT_DIR } from '../constants.js';

export const USAGE = `Usage: npm start -- --input <file.csv> [--output <dir>]
   or: node dist/cli/index.js --input <file.csv> [--output <dir>]

Options:
  -i, --input <path>   CSV file with ad performance records (required)
  -o, --output <dir>   Directory for top10_ctr.csv and top10_cpa.csv (default: ${DEFAULT_OUTPUT_DIR})
  -h, --help           Show this help

Relative paths are resolved from the directory the command is run in.`;

export class UsageError extends Error {
  override name = 'UsageError';
}

export type CliCommand = { kind: 'help' } | { kind: 'run'; inputPath: string; outputDir: string };

/** Parses the arguments; relative paths are resolved against `baseDir`, so the result is absolute. */
export function parseCliArgs(argv: readonly string[], baseDir: string = process.cwd()): CliCommand {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        input: { type: 'string', short: 'i' },
        output: { type: 'string', short: 'o', default: DEFAULT_OUTPUT_DIR },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new UsageError((error as Error).message);
  }

  if (values.help) {
    return { kind: 'help' };
  }
  if (values.input === undefined || values.input.length === 0) {
    throw new UsageError('Missing required option --input');
  }
  if (values.output.length === 0) {
    throw new UsageError('Option --output must not be empty');
  }
  return {
    kind: 'run',
    inputPath: resolve(baseDir, values.input),
    outputDir: resolve(baseDir, values.output),
  };
}
