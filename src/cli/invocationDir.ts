/**
 * Returns the directory the user ran the command from, for resolving relative paths.
 *
 * npm runs package scripts from the package root, so process.cwd() is wrong under `npm start`;
 * npm keeps the user's directory in INIT_CWD. INIT_CWD is inherited by every process started
 * below any npm script, though, so it is only trusted when this process is the npm script itself.
 */
export function invocationDir(
  npmScript: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const initCwd = env.INIT_CWD;
  return env.npm_lifecycle_event === npmScript && initCwd !== undefined && initCwd !== ''
    ? initCwd
    : cwd;
}
