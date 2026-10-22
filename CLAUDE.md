# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A zero-runtime-dependency Node.js 22+ / TypeScript (ESM, `NodeNext`) CLI that streams a ~1GB ad
CSV (26.8M rows), aggregates by `campaign_id`, and writes `top10_ctr.csv` and `top10_cpa.csv`.
Solution to the FV-SEC001 challenge. The README is the authoritative write-up of design decisions
and measured performance (~10 s, ~90 MB RSS); keep it in sync when behavior or numbers change.

## Commands

```bash
npm ci
npm start -- --input ad_data.csv --output results   # prestart builds dist/ first
npm test                                             # vitest run (globalSetup builds dist/ first)
npx vitest run tests/unit/core/ratio.test.ts         # single file
npx vitest run -t "name of test"                     # single test by name
npm run typecheck                                    # tsc --noEmit over src, tests, scripts
npm run lint                                         # typescript-eslint strictTypeChecked + sonarjs
npm run format:check                                 # prettier
npm run benchmark -- [input] [runs]                  # appends to benchmarks/benchmark.log
```

- `tsconfig.json` is no-emit and covers everything; `tsconfig.build.json` emits only `src/` to `dist/`.
- `tests/globalSetup.ts` runs `tsc -p tsconfig.build.json` before every test run, because
  `tests/integration/cli.test.ts` executes the built `dist/cli/index.js`. A build error fails the
  whole test run.
- Relative imports must use the `.js` extension (`verbatimModuleSyntax`, `import type` for types).
- `ad_data.csv` (the real dataset) is git-ignored and lives in the repo root when present.

## Architecture

Layered, dependencies point inward only: `cli -> app -> core, io`. `core` never touches the file
system.

- `cli/index.ts` — entry point; maps errors to exit codes (0 ok, 1 input/output error, 2 usage).
  `AppError` subclasses and Node system errors (have `.code`) are "expected" and printed as one
  line; anything else is treated as a bug and printed with a stack.
- `cli/invocationDir.ts` — relative paths resolve against npm's `INIT_CWD`, but only when
  `npm_lifecycle_event === 'start'`; otherwise `process.cwd()`.
- `app/runAggregation.ts` — the pipeline: `readLineBatches` -> `RowParser.fromHeader` (first
  non-blank line) -> `RowParser.parse` per line -> `CampaignAggregator.add` -> `topByCtr`/`topByCpa`
  -> `writeCsvFiles`. Fails (no output written) on empty file, header-only, or zero valid rows.
- `core/` — `rowParser`/`fieldParsers` (offset-based parsing, no `split`), `aggregator`
  (`RunningTotals` class per campaign), `ratio` (exact BigInt ratio compare + half-up rounding),
  `metrics` (the single definition of CTR/CPA), `ranking`, `types` (`SKIP_REASONS`, `ParseResult`).
- `io/lineReader.ts` — async generator yielding an _array of lines per 64KB chunk_;
  `io/csvWriter.ts` — all-or-nothing replace of both output files (temp files, back up old, swap,
  restore on failure).

## Invariants that are easy to break

These were each measured or reviewed; see README "Design decisions" for the reasoning.

- **Hot path performance.** Don't introduce per-line promises/generators, `split(',')` per row,
  or per-row string creation for numeric fields. Don't build running totals by spreading a parsed
  record (`{ ...record }`) — the dedicated totals class avoids a V8 hidden-class deopt that cost ~6 s.
  `READ_CHUNK_BYTES` (64KB) was chosen by measurement.
- **Campaign id copy.** The aggregator copies a `campaign_id` into fresh memory on first sight so
  the slice doesn't pin the whole decoded chunk. `tests/integration/memoryRetention.test.ts`
  (via `tests/support/retentionProbe.ts`, run with tsx and `--expose-gc`) fails without it.
- **Exact numbers.** Spend is integer cents (parsed without floats; >2 decimals is malformed).
  CTR/CPA are never stored as floats: ranking cross-multiplies in BigInt, output rounds half up.
  Totals are checked against `Number.MAX_SAFE_INTEGER` at the end.
- **Ranking rules.** Ties break by `campaign_id` ascending. Zero impressions -> empty CTR, excluded
  from CTR ranking; zero conversions -> empty CPA, excluded from CPA ranking.
- **Input handling.** Columns located by header name (case-insensitive, any order, extras ignored);
  BOM, CRLF, surrounding whitespace handled. Malformed rows are skipped and counted per
  `SkipReason` (add new reasons to `SKIP_REASONS`). Quoted fields are rejected, not parsed. Lines
  over `MAX_LINE_LENGTH` (1MB) are fatal.
- **Output.** `total_spend`/`CPA` 2 decimals, `CTR` 4 (`DECIMALS` in `constants.ts`). Ids starting
  with `= + - @` are prefixed with `'` (CSV-injection guard).
- `results/` holds the committed outputs for the real dataset; they were verified against an
  independent reference implementation, so changes to them need justification.

## Tests

`tests/unit/` mirrors `src/`; `tests/integration/` covers `runAggregation`, the built CLI, and heap
retention. Fixtures with expected outputs are in `tests/fixtures/`. `tests/setup.ts` cleans temp
dirs created via `tests/helpers.ts` after each test.

`PROMPTS.md` is a log of the user's prompts for the challenge submission — don't rewrite it.
