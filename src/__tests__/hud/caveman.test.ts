import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Pin HOME to a tmpdir so the element under test reads our fixture flag,
// not the developer's real ~/.claude/.caveman-active. Reset every case so
// nothing leaks across tests.
let fakeHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), 'omc-hud-caveman-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  mkdirSync(join(fakeHome, '.claude'), { recursive: true });
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  rmSync(fakeHome, { recursive: true, force: true });
});

function writeFlag(value: string): void {
  writeFileSync(join(fakeHome, '.claude', '.caveman-active'), value);
}

function stripAnsi(input: string | null): string | null {
  if (input == null) return null;
  return input.replace(/\[[0-9;]*m/g, '');
}

describe('renderCaveman', () => {
  it('returns null when no flag file exists', async () => {
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(renderCaveman()).toBeNull();
  });

  it('returns [CAVEMAN:FULL] for the default full mode', async () => {
    writeFlag('full');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(stripAnsi(renderCaveman())).toBe('[CAVEMAN:FULL]');
  });

  it('returns [CAVEMAN:LITE] for lite mode', async () => {
    writeFlag('lite');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(stripAnsi(renderCaveman())).toBe('[CAVEMAN:LITE]');
  });

  it('returns [CAVEMAN:ULTRA] for ultra mode', async () => {
    writeFlag('ultra');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(stripAnsi(renderCaveman())).toBe('[CAVEMAN:ULTRA]');
  });

  it('returns [CAVEMAN:COMMIT] for commit independent mode', async () => {
    writeFlag('commit');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(stripAnsi(renderCaveman())).toBe('[CAVEMAN:COMMIT]');
  });

  it('returns null for invalid flag content (off/unknown)', async () => {
    writeFlag('off');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(renderCaveman()).toBeNull();
  });

  it('returns null for empty flag content', async () => {
    writeFlag('');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(renderCaveman()).toBeNull();
  });

  it('trims trailing whitespace/newline from the flag value', async () => {
    writeFlag('ultra\n');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    expect(stripAnsi(renderCaveman())).toBe('[CAVEMAN:ULTRA]');
  });

  it('emits ANSI bold + yellow when active', async () => {
    writeFlag('full');
    const { renderCaveman } = await import('../../hud/elements/caveman.js');
    const out = renderCaveman();
    expect(out).not.toBeNull();
    expect(out).toContain('[1m');     // bold
    expect(out).toContain('[33m');    // yellow
  });
});
