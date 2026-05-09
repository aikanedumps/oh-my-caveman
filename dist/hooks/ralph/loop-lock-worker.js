/**
 * Worker helper for US-103 concurrent increment test.
 *
 * Invoked via child_process from loop-lock.test.ts.
 * Reads dir/sessionId from argv, calls incrementRalphIteration with retry,
 * then exits 0 on success or 1 on failure.
 *
 * Usage: node dist/hooks/ralph/loop-lock-worker.js <dir> <sessionId> <jitterMs>
 */
import { incrementRalphIteration, RALPH_LOCK_BUSY } from "./loop.js";
const [, , dir, sessionId, jitterMsStr] = process.argv;
const jitterMs = parseInt(jitterMsStr ?? "0", 10);
if (!dir || !sessionId) {
    console.error("Usage: loop-lock-worker.js <dir> <sessionId> <jitterMs>");
    process.exit(1);
}
// Small jitter so processes don't all start at the exact same millisecond
if (jitterMs > 0) {
    const deadline = Date.now() + jitterMs;
    while (Date.now() < deadline) { /* spin */ }
}
let attempts = 0;
let result = incrementRalphIteration(dir, sessionId);
while (result === RALPH_LOCK_BUSY && attempts < 20) {
    attempts++;
    const waitUntil = Date.now() + 60;
    while (Date.now() < waitUntil) { /* spin */ }
    result = incrementRalphIteration(dir, sessionId);
}
if (result === null || result === RALPH_LOCK_BUSY) {
    console.error(`incrementRalphIteration failed after ${attempts} retries: result=${String(result)}`);
    process.exit(1);
}
process.exit(0);
//# sourceMappingURL=loop-lock-worker.js.map