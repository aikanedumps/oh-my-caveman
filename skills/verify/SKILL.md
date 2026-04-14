---
name: verify
description: Verify that a change really works before you claim completion
---

# Verify

Use when user needs confidence feature, fix, or refactor actually works.

## Goal
Turn vague "should work" claims into concrete evidence.

## Workflow
1. Identify exact behavior that must be proven.
2. Prefer existing tests first.
3. If coverage missing, run narrowest direct verification commands available.
4. If direct automation not enough, describe manual validation steps and gather concrete observable evidence.
5. Report only what was actually verified.

## Verification order
1. Existing tests
2. Typecheck / build
3. Narrow direct command checks
4. Manual or interactive validation

## Rules
- Do not say change is complete without evidence.
- If check fails, include failure clearly.
- If no realistic verification path exists, say that explicitly — no bluffing.
- Prefer concise evidence summaries over noisy logs.

## Output
- What was verified
- Which commands/tests were run
- What passed
- What failed or remains unverified
