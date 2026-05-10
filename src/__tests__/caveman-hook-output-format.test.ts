import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Caveman SessionStart and UserPromptSubmit hooks must emit the same JSON
// envelope shape that sibling OMC hooks (session-start.mjs, project-memory-
// session.mjs, wiki-session-start.mjs) emit, so Claude Code can merge each
// entry's additionalContext deterministically. Plain-text stdout coexists in
// the spec but bypasses suppressOutput and other envelope semantics — we
// pinned it to the envelope path. See critic verdict in PR / repo notes.

const NODE = process.execPath;
const ACTIVATE = join(__dirname, '..', '..', 'scripts', 'caveman-activate.cjs');
const TRACKER = join(__dirname, '..', '..', 'scripts', 'caveman-mode-tracker.cjs');

type HookOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  hookSpecificOutput?: {
    hookEventName?: string;
    additionalContext?: string;
  };
};

describe('caveman-activate.cjs (SessionStart envelope)', () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'omc-caveman-activate-'));
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
  });

  function runActivate(env: Record<string, string> = {}): HookOutput {
    const raw = execFileSync(NODE, [ACTIVATE], {
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, ...env },
      encoding: 'utf-8',
      timeout: 15000,
    });
    return JSON.parse(raw) as HookOutput;
  }

  it('default mode emits SessionStart envelope with caveman ruleset', () => {
    const out = runActivate();
    expect(out.continue).toBe(true);
    expect(out.suppressOutput).toBeUndefined();
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(out.hookSpecificOutput?.additionalContext).toMatch(/CAVEMAN MODE ACTIVE/);
    expect(out.hookSpecificOutput?.additionalContext).toMatch(/level: full/);
  });

  it('off mode suppresses output and deletes flag', () => {
    const out = runActivate({ CAVEMAN_DEFAULT_MODE: 'off' });
    expect(out).toEqual({ continue: true, suppressOutput: true });
    expect(existsSync(join(fakeHome, '.claude', '.caveman-active'))).toBe(false);
  });

  it('independent mode (commit) emits short activation line in envelope', () => {
    const out = runActivate({ CAVEMAN_DEFAULT_MODE: 'commit' });
    expect(out.continue).toBe(true);
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(out.hookSpecificOutput?.additionalContext).toBe(
      'CAVEMAN MODE ACTIVE — level: commit. Behavior defined by /caveman-commit skill.',
    );
  });

  it('writes flag file with mode value when active', () => {
    runActivate({ CAVEMAN_DEFAULT_MODE: 'ultra' });
    const flag = readFileSync(join(fakeHome, '.claude', '.caveman-active'), 'utf8');
    expect(flag).toBe('ultra');
  });

  it('emits valid JSON only — no trailing plain text', () => {
    const raw = execFileSync(NODE, [ACTIVATE], {
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
      encoding: 'utf-8',
    });
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('caveman-mode-tracker.cjs (UserPromptSubmit flag write)', () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'omc-caveman-tracker-'));
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
  });

  function runTracker(prompt: string): void {
    execFileSync(NODE, [TRACKER], {
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
      input: JSON.stringify({ prompt }),
      encoding: 'utf-8',
      timeout: 15000,
    });
  }

  function flagPath() {
    return join(fakeHome, '.claude', '.caveman-active');
  }

  it('/caveman ultra writes ultra to flag file', () => {
    runTracker('/caveman ultra');
    expect(readFileSync(flagPath(), 'utf8')).toBe('ultra');
  });

  it('/caveman lite writes lite to flag file', () => {
    runTracker('/caveman lite');
    expect(readFileSync(flagPath(), 'utf8')).toBe('lite');
  });

  it('/caveman-commit writes commit to flag file', () => {
    runTracker('/caveman-commit');
    expect(readFileSync(flagPath(), 'utf8')).toBe('commit');
  });

  it('"stop caveman" deletes the flag file', () => {
    runTracker('/caveman ultra');
    expect(existsSync(flagPath())).toBe(true);
    runTracker('stop caveman');
    expect(existsSync(flagPath())).toBe(false);
  });

  it('"normal mode" deletes the flag file', () => {
    runTracker('/caveman full');
    runTracker('please switch to normal mode');
    expect(existsSync(flagPath())).toBe(false);
  });

  it('non-caveman prompt is a no-op', () => {
    runTracker('hello world');
    expect(existsSync(flagPath())).toBe(false);
  });
});
