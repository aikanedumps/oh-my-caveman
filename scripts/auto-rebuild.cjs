#!/usr/bin/env node
'use strict';
/**
 * OMC plugin auto-rebuild helper (SessionStart hook).
 *
 * Detects when the installed plugin dist/ is out of sync with src/ and kicks
 * off a background rebuild. Idempotent via build stamp + lockfile.
 *
 * Detection: `.omc-build-stamp.json` carries `{ version, gitCommitSha }`.
 * Mismatch against current plugin package.json + installed_plugins.json record
 * triggers a rebuild. Stamp absent ⇒ rebuild.
 *
 * Build: `npm install --silent && npm run build`. Runs detached so SessionStart
 * returns immediately. Stamp written and lock removed on success; on failure
 * the lock ages out after 15 minutes so the next session retries.
 *
 * Visibility: one stdout line when a rebuild starts or when a stale lock is
 * observed — picked up by Claude Code as SessionStart additional context.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const LOCK_STALE_MS = 15 * 60 * 1000;

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function configDir() {
  if (process.env.CLAUDE_CONFIG_DIR && process.env.CLAUDE_CONFIG_DIR.trim()) {
    return process.env.CLAUDE_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.claude');
}

function findInstalledRecord(pluginRoot) {
  const installed = readJsonSafe(path.join(configDir(), 'plugins', 'installed_plugins.json'));
  if (!installed || !installed.plugins) return null;
  const target = path.resolve(pluginRoot);
  for (const entries of Object.values(installed.plugins)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry.installPath === 'string') {
        try {
          if (path.resolve(entry.installPath) === target) return entry;
        } catch { /* ignore bad paths */ }
      }
    }
  }
  return null;
}

function needsRebuild(pluginRoot) {
  const pkg = readJsonSafe(path.join(pluginRoot, 'package.json'));
  if (!pkg || !pkg.version) return null;
  if (!fs.existsSync(path.join(pluginRoot, 'tsconfig.json'))) return null;

  const stamp = readJsonSafe(path.join(pluginRoot, '.omc-build-stamp.json'));
  const installed = findInstalledRecord(pluginRoot);
  const pkgVersion = String(pkg.version);
  const installedSha = installed && installed.gitCommitSha ? String(installed.gitCommitSha) : null;

  if (!stamp) return { reason: 'no build stamp', pkgVersion, installedSha };
  if (stamp.version !== pkgVersion) {
    return { reason: `stamp v${stamp.version} != pkg v${pkgVersion}`, pkgVersion, installedSha };
  }
  if (installedSha && stamp.gitCommitSha && stamp.gitCommitSha !== installedSha) {
    return {
      reason: `stamp sha ${String(stamp.gitCommitSha).slice(0, 7)} != installed ${installedSha.slice(0, 7)}`,
      pkgVersion,
      installedSha,
    };
  }
  return null;
}

function lockBusy(pluginRoot) {
  const lock = path.join(pluginRoot, '.omc-build.lock');
  if (!fs.existsSync(lock)) return false;
  try {
    const { mtimeMs } = fs.statSync(lock);
    if (Date.now() - mtimeMs > LOCK_STALE_MS) {
      try { fs.unlinkSync(lock); } catch { /* ignore */ }
      return false;
    }
    return true;
  } catch { return false; }
}

function startBuild(pluginRoot, info) {
  const lock = path.join(pluginRoot, '.omc-build.lock');
  const log = path.join(pluginRoot, '.omc-build.log');
  const stampTmp = path.join(pluginRoot, '.omc-build-stamp.json.tmp');
  const stampPayload = {
    version: info.pkgVersion,
    gitCommitSha: info.installedSha || null,
    builtAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(lock, `${process.pid}\n${new Date().toISOString()}\n`);
    // Stage the success stamp now; the shell command promotes it via `mv`
    // only after build success. Sidesteps shell-quoting hazards entirely.
    fs.writeFileSync(stampTmp, JSON.stringify(stampPayload));
  } catch (err) {
    return { ok: false, error: `lock/stamp write failed: ${err && err.message}` };
  }

  try {
    fs.appendFileSync(log, `[${new Date().toISOString()}] rebuild trigger: ${info.reason}\n`);
  } catch { /* ignore */ }

  const isWin = process.platform === 'win32';
  const promoteStamp = isWin
    ? `move /Y ".omc-build-stamp.json.tmp" ".omc-build-stamp.json"`
    : `mv -f .omc-build-stamp.json.tmp .omc-build-stamp.json`;
  const rmLock = isWin ? `del /Q ".omc-build.lock"` : `rm -f .omc-build.lock`;
  const shellCmd = `npm install --silent --no-audit --no-fund && npm run build && ${promoteStamp} && ${rmLock}`;

  let outFd;
  try {
    outFd = fs.openSync(log, 'a');
  } catch (err) {
    try { fs.unlinkSync(lock); } catch { /* ignore */ }
    return { ok: false, error: `log open failed: ${err && err.message}` };
  }

  try {
    const child = spawn(isWin ? 'cmd.exe' : 'sh', isWin ? ['/d', '/c', shellCmd] : ['-c', shellCmd], {
      cwd: pluginRoot,
      detached: true,
      stdio: ['ignore', outFd, outFd],
      windowsHide: true,
    });
    child.on('error', () => { /* detached: swallow */ });
    child.unref();
    return { ok: true };
  } catch (err) {
    try { fs.unlinkSync(lock); } catch { /* ignore */ }
    return { ok: false, error: `spawn failed: ${err && err.message}` };
  }
}

(function main() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) return;
  if (!fs.existsSync(path.join(pluginRoot, 'package.json'))) return;

  const info = needsRebuild(pluginRoot);
  if (!info) return;

  if (lockBusy(pluginRoot)) {
    process.stdout.write('[OMC] Plugin rebuild already in progress; HUD elements may stay stale until it finishes.\n');
    return;
  }

  const result = startBuild(pluginRoot, info);
  if (result.ok) {
    process.stdout.write(`[OMC] Rebuilding plugin dist (${info.reason}) — runs once in background (~1–2 min). HUD refreshes on next session.\n`);
  } else {
    process.stdout.write(`[OMC] Plugin rebuild needed but failed to start: ${result.error}. Run: cd "${pluginRoot}" && npm install && npm run build\n`);
  }
})();
