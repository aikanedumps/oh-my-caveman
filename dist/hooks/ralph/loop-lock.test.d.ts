/**
 * US-103: Ralph iteration race fix — file-lock tests
 *
 * Tests that incrementRalphIteration:
 *   1. Returns RALPH_LOCK_BUSY and logs a warning when the lock cannot be
 *      acquired (mock scenario).
 *   2. Serialises concurrent increments so no updates are lost
 *      (child_process workers against compiled dist).
 */
export {};
//# sourceMappingURL=loop-lock.test.d.ts.map