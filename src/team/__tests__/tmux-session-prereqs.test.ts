import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
    execFileSync: vi.fn(),
  };
});

import { execFileSync, execSync } from 'child_process';
import { validateTmux } from '../tmux-session.js';

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedExecSync = vi.mocked(execSync);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateTmux', () => {
  it('skips probing when tmux context is already active', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('should not probe');
    });

    expect(() => validateTmux(true)).not.toThrow();
    expect(mockedExecFileSync).not.toHaveBeenCalled();
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('probes tmux when context is absent', () => {
    mockedExecFileSync.mockReturnValue('tmux 3.4' as any);

    expect(() => validateTmux(false)).not.toThrow();
    expect(mockedExecFileSync).toHaveBeenCalledWith('tmux', ['-V'], expect.objectContaining({
      encoding: 'utf-8',
      timeout: 5000,
      stdio: 'pipe',
    }));
  });

  it('throws install guidance when tmux is unavailable outside context', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('tmux missing');
    });

    expect(() => validateTmux(false)).toThrow(/tmux is not available/i);
  });
});
