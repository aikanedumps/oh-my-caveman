---
name: ai-slop-cleaner
description: Clean AI-generated code slop with a regression-safe, deletion-first workflow and optional reviewer-only mode
level: 3
---

# AI Slop Cleaner

Cleans AI-generated code slop without drifting scope or changing intended behavior. In OMC, this is bounded cleanup workflow for code that works but feels bloated, repetitive, weakly tested, or over-abstracted.

## When to Use

Use when:
- User explicitly says `deslop`, `anti-slop`, or `AI slop`
- Request is to clean up or refactor code that feels noisy, repetitive, or overly abstract
- Follow-up implementation left duplicate logic, dead code, wrapper layers, boundary leaks, or weak regression coverage
- User wants reviewer-only anti-slop pass via `--review`
- Goal is simplification and cleanup, not new feature delivery

## When Not to Use

Do not use when:
- Task is mainly new feature build or product change
- User wants broad redesign instead of incremental cleanup pass
- Request is generic refactor with no simplification or anti-slop intent
- Behavior too unclear to protect with tests or concrete verification plan

## OMC Execution Posture

- Preserve behavior unless user explicitly asks for behavior changes.
- Lock behavior with focused regression tests first whenever practical.
- Write cleanup plan before editing code.
- Prefer deletion over addition.
- Reuse existing utilities and patterns before introducing new ones.
- Avoid new dependencies unless user explicitly requests them.
- Keep diffs small, reversible, and smell-focused.
- Stay concise and evidence-dense: inspect, edit, verify, and report.
- Treat new user instructions as local scope updates without dropping earlier non-conflicting constraints.

## Scoped File-List Usage

Skill can be bounded to explicit file list or changed-file scope when caller already knows safe cleanup surface.

- Good fit: `oh-my-caveman:ai-slop-cleaner skills/ralph/SKILL.md skills/ai-slop-cleaner/SKILL.md`
- Good fit: Ralph session handing off only files changed in that session
- Preserve same regression-safe workflow even when scope is short file list
- Do not silently expand changed-file scope into broader cleanup work unless user explicitly asks

## Ralph Integration

Ralph can invoke this skill as bounded post-review cleanup pass.

- In that workflow, cleaner runs in standard mode (not `--review`)
- Cleanup scope is Ralph session's changed files only
- After cleanup pass, Ralph re-runs regression verification before completion
- `--review` remains reviewer-only follow-up mode, not default Ralph integration path

## Review Mode (`--review`)

`--review` is reviewer-only pass after cleanup work is drafted. Exists to preserve explicit writer/reviewer separation for anti-slop work.

- **Writer pass**: make cleanup changes with behavior locked by tests.
- **Reviewer pass**: inspect cleanup plan, changed files, and verification evidence.
- Same pass must not both write and self-approve high-impact cleanup without separate review step.

In review mode:
1. Do **not** start by editing files.
2. Review cleanup plan, changed files, and regression coverage.
3. Check specifically for:
   - leftover dead code or unused exports
   - duplicate logic that should have been consolidated
   - needless wrappers or abstractions that still blur boundaries
   - missing tests or weak verification for preserved behavior
   - cleanup that appears to have changed behavior without intent
4. Produce reviewer verdict with required follow-ups.
5. Hand needed changes back to separate writer pass instead of fixing and approving in one step.

## Workflow

1. **Protect current behavior first**
   - Identify what must stay same.
   - Add or run narrowest regression tests needed before editing.
   - Tests cannot come first → record verification plan explicitly before touching code.

2. **Write cleanup plan before code**
   - Bound pass to requested files or feature area.
   - List concrete smells to remove.
   - Order work from safest deletion to riskier consolidation.

3. **Classify slop before editing**
   - **Duplication** — repeated logic, copy-paste branches, redundant helpers
   - **Dead code** — unused code, unreachable branches, stale flags, debug leftovers
   - **Needless abstraction** — pass-through wrappers, speculative indirection, single-use helper layers
   - **Boundary violations** — hidden coupling, misplaced responsibilities, wrong-layer imports or side effects
   - **Missing tests** — behavior not locked, weak regression coverage, edge-case gaps

4. **Run one smell-focused pass at a time**
   - **Pass 1: Dead code deletion**
   - **Pass 2: Duplicate removal**
   - **Pass 3: Naming and error-handling cleanup**
   - **Pass 4: Test reinforcement**
   - Re-run targeted verification after each pass.
   - Do not bundle unrelated refactors into same edit set.

5. **Run quality gates**
   - Keep regression tests green.
   - Run relevant lint, typecheck, and unit/integration tests for touched area.
   - Run existing static or security checks when available.
   - Gate fails → fix issue or back out risky cleanup instead of forcing through.

6. **Close with evidence-dense report**
   Always report:
   - **Changed files**
   - **Simplifications**
   - **Behavior lock / verification run**
   - **Remaining risks**

## Usage

- `/oh-my-caveman:ai-slop-cleaner <target>`
- `/oh-my-caveman:ai-slop-cleaner <target> --review`
- `/oh-my-caveman:ai-slop-cleaner <file-a> <file-b> <file-c>`
- From Ralph: run cleaner on Ralph session's changed files only, then return to Ralph for post-cleanup regression verification

## Good Fits

**Good:** `deslop this module: too many wrappers, duplicate helpers, and dead code`

**Good:** `cleanup the AI slop in src/auth and tighten boundaries without changing behavior`

**Bad:** `refactor auth to support SSO`

**Bad:** `clean up formatting`
