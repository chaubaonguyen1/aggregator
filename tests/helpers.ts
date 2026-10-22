import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tempDirs: string[] = [];

export function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

/** Creates a temporary directory that is removed after the current test (see tests/setup.ts). */
export async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ad-aggregator-'));
  tempDirs.push(dir);
  return dir;
}

export async function writeTempFile(name: string, content: string): Promise<string> {
  const path = join(await makeTempDir(), name);
  await writeFile(path, content, 'utf8');
  return path;
}

export async function removeTempDirs(): Promise<void> {
  const dirs = tempDirs.splice(0);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
}
