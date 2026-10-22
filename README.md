# Ad Performance Aggregator

A streaming Node.js + TypeScript CLI that aggregates a ~1GB advertising CSV by `campaign_id` and
writes the top 10 campaigns by highest CTR and by lowest CPA. It is a solution to the FV-SEC001
Software Engineer Challenge (Ad Performance Aggregator).

|                                   |                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Processing time (1GB, 26.8M rows) | **~10 s** (9.4–10.9 s over 5 logged runs)                                                          |
| Peak memory (RSS)                 | **~90 MB** (87–92 MB over 5 logged runs)                                                           |
| Runtime dependencies              | **none** (Node.js standard library only)                                                           |
| Results                           | [`results/top10_ctr.csv`](results/top10_ctr.csv), [`results/top10_cpa.csv`](results/top10_cpa.csv) |

## Setup

Requirements: **Node.js 22+** and npm. Docker is optional.

1. Clone this repository and install the dependencies:

   ```bash
   git clone <this-repo-url>
   cd <repo-folder>
   npm ci
   ```

2. Get the dataset. It is not committed because of its size (~1GB). Download `ad_data.csv.zip`
   from the challenge repository and unzip it into the repository root, next to `package.json`:

   ```bash
   unzip ad_data.csv.zip                                    # macOS / Linux
   Expand-Archive ad_data.csv.zip -DestinationPath .        # Windows PowerShell
   ```

## Running

From the repository root:

```bash
npm start -- --input ad_data.csv --output results
```

- This single command is all you need. npm automatically runs the `prestart` script
  (`npm run build`, which compiles the TypeScript into `dist/`) before `start`, so there is no
  separate build step.
- The `--` is required: it passes the options through npm to the program.
- `--input` accepts any file name or path, so the CSV can be renamed or stay elsewhere
  (e.g. `--input ../data/my_ads.csv`).

> [!IMPORTANT]
> **Where to put the CSV file**
>
> - **Recommended:** put `ad_data.csv` in the repository root (next to `package.json`) and run the
>   command from there, exactly as shown above. It is git-ignored, so it will not be committed.
> - **Anywhere else** works too: pass its path to `--input`. An absolute path
>   (e.g. `--input /data/ad_data.csv` or `--input D:\data\ad_data.csv`) works from any directory.
> - **Relative paths** for `--input` and `--output` are resolved from the directory you run the
>   command in, both with `npm start` and with `node dist/cli/index.js`.
> - If the file cannot be found, the error message shows the full path that was tried, e.g.
>   `Error: Input file not found: /home/me/repo/ad_data.csv`.

To run the compiled program directly, without npm and without rebuilding:

```bash
npm run build                                               # once
node dist/cli/index.js --input ad_data.csv --output results
```

| Option               | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `-i, --input <path>` | CSV file to process (required)                                                             |
| `-o, --output <dir>` | Directory for `top10_ctr.csv` and `top10_cpa.csv` (default: `results`, created if missing) |
| `-h, --help`         | Show usage                                                                                 |

Example output:

```
Processed 26,843,544 rows (26,843,544 aggregated, 0 skipped) across 50 campaigns
Wrote /home/me/repo/results/top10_ctr.csv
Wrote /home/me/repo/results/top10_cpa.csv
Elapsed: 9.92 s | Peak RSS: 91.2 MB
```

Malformed rows are skipped and summarised on stderr, for example
`Warning: skipped 8 malformed row(s): wrong_column_count=1, quoted_field=1, ...`.

Exit codes:

| Code | Meaning                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | Success                                                                                                                                                                                                                              |
| `1`  | Input/output error, reported as a one-line `Error: ...`. Covers a missing or unreadable file, a bad header, no valid rows, and unwritable output. An unexpected internal error also exits with `1`, but prints its full stack trace. |
| `2`  | Invalid arguments                                                                                                                                                                                                                    |

### With Docker (optional)

The image only exists so the program can run without installing Node.js 22.

```bash
docker build -t ad-aggregator .
docker run --rm -v "$(pwd):/data" ad-aggregator --input /data/ad_data.csv --output /data/results
```

On Linux, add `--user "$(id -u):$(id -g)"` so the result files are owned by you.

## Development

| Command                               | Purpose                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm test`                            | Unit and integration tests (Vitest). Builds `dist/` first, so the CLI tests run the real build. |
| `npm run typecheck`                   | Type-check sources, tests and scripts                                                           |
| `npm run lint`                        | ESLint: typescript-eslint `strictTypeChecked` + SonarJS rules                                   |
| `npm run format` / `format:check`     | Prettier                                                                                        |
| `npm run benchmark -- [input] [runs]` | Build, run the CLI `runs` times (default 3), append to `benchmarks/benchmark.log`               |

## Project structure

```
src/
  cli/          index.ts (entry, exit codes, summary), args.ts (argument parsing)
  app/          runAggregation.ts: read -> parse -> aggregate -> rank -> write
  core/         Pure logic, no file I/O:
                  fieldParsers, rowParser, aggregator, ratio (exact BigInt ratios),
                  metrics (the one definition of CTR/CPA), ranking, types
  io/           lineReader.ts (streaming), csvWriter.ts (all-or-nothing output)
  errors.ts     AppError: base class of expected, user-facing failures
  constants.ts
tests/
  unit/         Mirrors src/ (core, io, cli)
  integration/  runAggregation, the built CLI, and a heap-retention check
  support/      Helper process used by the heap-retention check
  fixtures/     Small input files and their expected outputs
scripts/benchmark.ts
benchmarks/benchmark.log
results/        Output for the provided dataset
PROMPTS.md      Prompts used with the AI coding assistant
```

Dependencies only point inwards: `cli -> app -> core, io`. `core` never touches the file system, so
nearly all logic is unit-tested without I/O.

## Libraries

- **Runtime:** none. Only Node.js built-ins (`fs`, `string_decoder`, `util.parseArgs`, `perf_hooks`).
- **Development:** TypeScript, Vitest, ESLint + typescript-eslint + eslint-plugin-sonarjs (the SonarQube rule set), Prettier, @types/node, and tsx.
  tsx runs TypeScript directly for the benchmark script and the heap-retention test helper.

## Performance

Measured on Windows 11, Intel Core i9-14900HX, 32GB RAM, Node.js 22.22.2. The full log is in
[benchmarks/benchmark.log](benchmarks/benchmark.log).

| Run | Processing time | Peak RSS |
| --- | --------------- | -------- |
| 1   | 9.44 s          | 87.1 MB  |
| 2   | 9.36 s          | 87.1 MB  |
| 3   | 10.48 s         | 88.0 MB  |
| 4   | 10.87 s         | 91.7 MB  |
| 5   | 10.80 s         | 92.0 MB  |

Run-to-run variation (about ±1 s) comes from background load on the machine, not from the input.

Peak RSS includes the Node.js runtime itself: the same CLI on a 7-row file peaks at ~52MB. Memory
does not grow with file size: only one 64KB chunk of lines and one entry per campaign are held at a
time. An integration test guards this; see the decision on campaign ids below.

How the numbers were reached, each step measured with a CPU profile on the full file:

| Step                                                                         | Time   | Peak RSS |
| ---------------------------------------------------------------------------- | ------ | -------- |
| First working version (`split(',')` per row, 4MB chunks)                     | 19.0 s | 195 MB   |
| Parse fields by offset instead of `split`                                    | 16.7 s | 195 MB   |
| Give running totals their own class (see below)                              | 10.3 s | 199 MB   |
| 64KB read chunks instead of 4MB                                              | 9.0 s  | 84 MB    |
| Hardening after code review (whitespace trimming, quote check, exact ratios) | ~10 s  | ~90 MB   |

Reading and splitting the file into lines alone takes ~1.8 s, so the rest is parsing and summing
26.8M rows.

## Design decisions

### Performance

- **Streaming in batches.** `readLineBatches` yields one array of lines per chunk read instead of
  one line at a time. An async generator per line would cost a promise round-trip per row, and that
  dominates at 26.8M rows. A `StringDecoder` keeps multi-byte characters intact across chunk
  boundaries.
- **64KB chunks.** Smaller chunks were both faster and leaner than 256KB–4MB. Each batch of lines
  stays small enough to be freed by the young-generation GC.
- **No `split` per row.** `RowParser` finds field offsets with `indexOf` and parses numbers directly
  from character codes. A row allocates only its line, its `campaign_id` slice, the record and the
  result wrapper; the numeric fields never become strings.
- **A separate class for running totals.** Copying the first parsed row (`{ ...record }`) as the
  totals object made it share V8's hidden class with every per-row record. Once the sums outgrew
  V8's small-integer range, that shared shape switched its number fields to boxed doubles, and every
  new record paid for it. A dedicated `RunningTotals` class cut the run time from 16.7 s to 10.3 s.
- **Campaign ids are copied once.** A `campaign_id` sliced from a line can keep the whole decoded
  chunk alive. V8 does this for slices of 13+ characters; `CMP001` is shorter, so the dataset never
  showed it. With 2,000 long ids this pinned ~8.7MB, and it grows with the file. The aggregator
  copies an id into fresh memory when it first sees the campaign, which is off the hot path. A test
  measures the retained heap under `--expose-gc` and fails without the copy.

### Correctness

- **Money in integer cents.** `spend` is parsed into integer cents without going through floating
  point and summed exactly. Spend values with more than two decimals are treated as malformed rather
  than silently rounded.
- **No silent precision loss.** An amount too large to hold exactly in cents is rejected as
  malformed. Every total is checked against `Number.MAX_SAFE_INTEGER` once at the end. Sums only
  grow, so a final total that is still safe was exact at every step. An unsafe total fails the run
  with a clear error instead of printing a wrong number. The provided data peaks at
  ~3.9 × 10¹⁰ cents, far below the limit.
- **Exact CTR/CPA, rounded half up.** CTR and CPA are never stored as floats. Ranking compares the
  ratios exactly by cross-multiplying in BigInt. CTRs are all around 0.0275, so float ranking would
  be fragile. Output divides with BigInt and rounds **half up** (`0.00015` → `0.0002`,
  `1.015` → `1.02`), where `Number#toFixed` would give `0.0001` and `1.01`. BigInt is only used for
  the ~50 campaigns at the end, so it costs nothing.
- **Deterministic ties.** Ties are broken by `campaign_id` ascending, so the output never depends on
  input order.
- **CTR/CPA edge cases.** CPA is empty (`null`) when conversions are 0, and such campaigns are
  excluded from the CPA ranking. In the same way, campaigns with 0 impressions have an empty CTR and
  are excluded from the CTR ranking.
- **Output format.** `total_spend` and `CPA` use 2 decimals and `CTR` uses 4, as in the challenge
  examples.

### Input handling and errors

- **Header-driven parsing.** Columns are located by name, case-insensitively, so column order does
  not matter and extra columns are ignored. A UTF-8 BOM, CRLF line endings and blank lines before
  the header are handled. Spaces, tabs and carriage returns around a field are ignored, with the
  same rule for header names and data fields. A missing required column is a fatal error. A file
  with CR-only line endings is reported as such instead of as a header with missing columns.
- **Malformed rows are skipped, not fatal.** Rows are skipped for:
  - a wrong column count
  - a quoted field
  - an empty `campaign_id`
  - a date that is not `YYYY-MM-DD`
  - non-integer or negative counts
  - a spend that is not a valid amount

  Each skip is counted by reason and reported on stderr. Blank lines carry no data and are ignored
  silently.

- **No results from no data.** If the file has only a header, or if every data row is malformed,
  the run fails with exit code 1 instead of writing two empty result files.
- **All-or-nothing output.** Both result files are written to temporary files first. The existing
  results are then moved aside to backups, and only then are the new files moved into place. Any
  failure restores the backups and removes the temporary files, so old and new results are never
  mixed. A common case on Windows is a result file still open in Excel, which locks it. The run
  then stops with `Cannot replace …: it may be open in another program (e.g. Excel)` and leaves both
  previous files untouched. This was verified with a real exclusive file lock.
- **Clear output errors.** `--output` pointing at an existing file reports
  `Output path is not a directory`.
- **Bounded line length.** A line longer than 1MB stops the run with a message that points at the
  likely cause, for example CR-only line endings. Without the limit, a file with no `\n` would be
  buffered whole.
- **Spreadsheet-safe output.** A `campaign_id` starting with `=`, `+`, `-` or `@` is prefixed with
  `'` in the output, so spreadsheet apps do not evaluate it as a formula (OWASP CSV injection). This
  deliberately changes such ids in the output: `-CMP1` is written as `'-CMP1`. Ids like `CMP001`,
  including every id in the provided dataset, are written unchanged.
- **Relative paths follow the user, not npm.** `npm start` runs from the package root, so the CLI
  resolves relative paths against npm's `INIT_CWD`, the directory the command was typed in. Every
  process started under any npm script inherits that variable, so it is trusted only when the
  process is the `start` script itself (`npm_lifecycle_event`). A direct `node` run always uses its
  own working directory.
- **Expected vs unexpected errors.** Input and environment problems throw an `AppError` subclass,
  or are Node system errors. The CLI prints those as one line. Anything else is a bug and is printed
  with its stack trace.

### Assumptions and limitations

- Fields are not quoted. The schema has no free-text columns, so a full RFC 4180 parser would only
  slow down the hot path. A row containing `"` is rejected (`quoted_field`) rather than misread as a
  different campaign.
- Dates are checked for shape and plausible month/day only; they are not used in the aggregation.
- `clicks > impressions` is not rejected because the challenge does not define it as invalid.
- Processing is single-threaded. Splitting the file by byte ranges across worker threads could cut
  the time further, but it would add noticeable complexity for a job that already finishes in ~10 s.
- Output replacement is all-or-nothing for errors, but not for a hard crash or power loss in the
  few milliseconds between moving the old files aside and moving the new ones in. Covering that
  would need a journal on the next start, which is out of scope for a CLI.

## Verification

Besides the test suite (`npm test`), both result files were compared against an independent reference
implementation: a short Python script using `csv` and `Decimal`, not part of the repository. The
results matched exactly, values and order. A separate code review recomputed them with exact
`Fraction` ranking and half-up rounding and also found an exact match. The Docker image produces
byte-identical files.
