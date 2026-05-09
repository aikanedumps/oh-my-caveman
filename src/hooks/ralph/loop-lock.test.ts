/**
 * US-103: Ralph iteration race fix — file-lock tests
 *
 * Tests that incrementRalphIteration:
 *   1. Returns RALPH_LOCK_BUSY and logs a warning when the lock cannot be
 *      acquired (mock scenario).
 *   2. Serialises concurrent increments so no updates are lost
 *      (child_process workers against compiled dist).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ralph-lock-test-"));
}

function writeRalphStateFile(
  dir: string,
  sessionId: string,
  iteration: number,
): void {
  const stateDir = join(dir, ".omc", "state", "sessions", sessionId);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, "ralph-state.json"),
    JSON.stringify({
      active: true,
      iteration,
      max_iterations: 50,
      started_at: new Date().toISOString(),
      prompt: "test",
      session_id: sessionId,
      project_path: dir,
    }),
  );
}

function readIteration(dir: string, sessionId: string): number {
  const stateFile = join(
    dir,
    ".omc",
    "state",
    "sessions",
    sessionId,
    "ralph-state.json",
  );
  const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as {
    iteration: number;
  };
  return raw.iteration;
}

// Resolve the dist worker path relative to this test file's source location
const __filename = fileURLToPath(import.meta.url);
const srcDir = resolve(__filename, "..");
// dist is at the same relative path from project root
const projectRoot = resolve(srcDir, "../../..");
const workerScript = join(
  projectRoot,
  "dist",
  "hooks",
  "ralph",
  "loop-lock-worker.js",
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("incrementRalphIteration — file-lock (US-103)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns RALPH_LOCK_BUSY and logs a warning when lock cannot be acquired", async () => {
    const { incrementRalphIteration, RALPH_LOCK_BUSY } = await import(
      "./loop.js"
    );
    const fileLock = await import("../../lib/file-lock.js");

    const dir = makeTempDir();
    const sessionId = "session-lock-busy-test";
    writeRalphStateFile(dir, sessionId, 0);

    // Mock acquireFileLockSync to return null (simulates lock held by another process)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(fileLock, "acquireFileLockSync").mockReturnValue(null);

    try {
      const result = incrementRalphIteration(dir, sessionId);

      expect(result).toBe(RALPH_LOCK_BUSY);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toMatch(/lock-busy/i);

      // State file should not have been modified
      expect(readIteration(dir, sessionId)).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serialises 5 concurrent increments — no lost updates", () => {
    const dir = makeTempDir();
    const sessionId = "session-concurrent-test";
    const initialIteration = 0;
    writeRalphStateFile(dir, sessionId, initialIteration);

    const CONCURRENCY = 5;
    const errors: string[] = [];

    // Spawn 5 node processes in parallel, each calling incrementRalphIteration
    // via the compiled worker script. They race on the same state file.
    const procs = Array.from({ length: CONCURRENCY }, (_, i) =>
      spawnSync("node", [workerScript, dir, sessionId, String(i * 10)], {
        timeout: 10_000,
        encoding: "utf-8",
      }),
    );

    for (const proc of procs) {
      if (proc.status !== 0) {
        errors.push(
          proc.stderr?.trim() || proc.stdout?.trim() || "non-zero exit",
        );
      }
    }

    try {
      if (errors.length > 0) {
        throw new Error(`Worker(s) failed:\n${errors.join("\n")}`);
      }

      const finalIteration = readIteration(dir, sessionId);
      expect(finalIteration).toBe(initialIteration + CONCURRENCY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
