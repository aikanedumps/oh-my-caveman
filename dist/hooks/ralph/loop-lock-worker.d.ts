/**
 * Worker helper for US-103 concurrent increment test.
 *
 * Invoked via child_process from loop-lock.test.ts.
 * Reads dir/sessionId from argv, calls incrementRalphIteration with retry,
 * then exits 0 on success or 1 on failure.
 *
 * Usage: node dist/hooks/ralph/loop-lock-worker.js <dir> <sessionId> <jitterMs>
 */
export {};
//# sourceMappingURL=loop-lock-worker.d.ts.map