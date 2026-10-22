import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Builds dist/ once, so the CLI tests exercise the same JavaScript that users run. */
export default function setup(): void {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}
