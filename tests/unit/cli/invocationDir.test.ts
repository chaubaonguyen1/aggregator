import { describe, expect, it } from 'vitest';
import { invocationDir } from '../../../src/cli/invocationDir.js';

const CWD = '/package/root';

describe('invocationDir', () => {
  it('uses INIT_CWD when running as the given npm script', () => {
    const env = { npm_lifecycle_event: 'start', INIT_CWD: '/user/dir' };
    expect(invocationDir('start', env, CWD)).toBe('/user/dir');
  });

  it('ignores an INIT_CWD inherited from another npm script', () => {
    const env = { npm_lifecycle_event: 'test', INIT_CWD: '/user/dir' };
    expect(invocationDir('start', env, CWD)).toBe(CWD);
  });

  it('falls back to the working directory outside npm', () => {
    expect(invocationDir('start', {}, CWD)).toBe(CWD);
  });

  it('falls back to the working directory when INIT_CWD is empty', () => {
    expect(invocationDir('start', { npm_lifecycle_event: 'start', INIT_CWD: '' }, CWD)).toBe(CWD);
  });
});
