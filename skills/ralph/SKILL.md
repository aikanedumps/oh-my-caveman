---
name: ralph
description: Self-referential loop until task completion with configurable verification reviewer
argument-hint: "[--no-deslop] [--critic=architect|critic|codex] <task description>"
level: 4
---

[RALPH + ULTRAWORK - ITERATION {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

<Purpose>
PRD-driven persistence loop. Works until ALL user stories in prd.json have passes: true and reviewer-verified. Wraps ultrawork's parallel execution with session persistence, auto-retry on failure, structured story tracking, mandatory verification before completion.
</Purpose>

<Use_When>
- Task needs guaranteed completion with verification (not "do your best")
- User says "ralph", "don't stop", "must complete", "finish this", or "keep going until done"
- Work may span multiple iterations, needs persistence across retries
- Task benefits from PRD-driven execution with reviewer sign-off
</Use_When>

<Do_Not_Use_When>
- User wants full autonomous pipeline from idea to code -- use `autopilot` instead
- User wants to explore or plan before committing -- use `plan` skill instead
- User wants quick one-shot fix -- delegate directly to executor agent
- User wants manual control over completion -- use `ultrawork` directly
</Do_Not_Use_When>

<Why_This_Exists>
Complex tasks fail silently: partial implementations declared "done", tests skipped, edge cases forgotten. Ralph prevents this by:
1. Structuring work into discrete user stories with testable acceptance criteria (prd.json)
2. Iterating story-by-story until each passes
3. Tracking progress and learnings across iterations (progress.txt)
4. Requiring fresh reviewer verification against specific acceptance criteria before completion
</Why_This_Exists>

<PRD_Mode>
By default, ralph runs in PRD mode. Scaffold `prd.json` auto-generated on startup if none exists.

**Startup gate:** Ralph always initializes and validates `prd.json` at startup. Legacy `--no-prd` text sanitized from prompt for backward compatibility, but no longer bypasses PRD creation or validation.

**Deslop opt-out:** If `{{PROMPT}}` contains `--no-deslop`, skip mandatory post-review deslop pass entirely. Use only when cleanup pass is intentionally out of scope.

**Reviewer selection:** Pass `--critic=architect`, `--critic=critic`, or `--critic=codex` in Ralph prompt to choose completion reviewer for that run. `architect` remains default.
</PRD_Mode>

<Execution_Policy>
- Fire independent agent calls simultaneously -- never wait sequentially for independent work
- Use `run_in_background: true` for long operations (installs, builds, test suites)
- Always pass `model` parameter explicitly when delegating to agents
- Read `docs/shared/agent-tiers.md` before first delegation to select correct agent tiers
- Deliver full implementation: no scope reduction, no partial completion, no deleting tests to make them pass
</Execution_Policy>

<Steps>
1. **PRD Setup** (first iteration only):
   a. Check if `prd.json` exists (in project root or `.omc/`). If exists, read it and proceed to Step 2.
   b. If no `prd.json`, system auto-generated scaffold. Read `.omc/prd.json`.
   c. **CRITICAL: Refine scaffold.** Auto-generated PRD has generic acceptance criteria ("Implementation is complete", etc.). MUST replace with task-specific criteria:
      - Analyze original task, break into right-sized user stories (each completable in one iteration)
      - Write concrete, verifiable acceptance criteria per story (e.g., "Function X returns Y when given Z", "Test file exists at path P and passes")
      - If acceptance criteria are generic (e.g., "Implementation is complete"), REPLACE with task-specific criteria before proceeding
      - Order stories by priority (foundational work first, dependent work later)
      - Write refined `prd.json` back to disk
   d. Initialize `progress.txt` if it doesn't exist

2. **Pick next story**: Read `prd.json`, select highest-priority story with `passes: false`. This is current focus.

3. **Implement current story**:
   - Delegate to specialist agents at appropriate tiers:
     - Simple lookups: LOW tier (Haiku) -- "What does this function return?"
     - Standard work: MEDIUM tier (Sonnet) -- "Add error handling to this module"
     - Complex analysis: HIGH tier (Opus) -- "Debug this race condition"
   - If sub-tasks discovered during implementation, add as new stories to `prd.json`
   - Run long operations in background: Builds, installs, test suites use `run_in_background: true`

4. **Verify current story's acceptance criteria**:
   a. For EACH acceptance criterion in story, verify met with fresh evidence
   b. Run relevant checks (test, build, lint, typecheck) and read output
   c. If any criterion NOT met, continue working -- do NOT mark story complete

5. **Mark story complete**:
   a. When ALL acceptance criteria verified, set `passes: true` for story in `prd.json`
   b. Record progress in `progress.txt`: what was implemented, files changed, learnings for future iterations
   c. Add discovered codebase patterns to `progress.txt`

6. **Check PRD completion**:
   a. Read `prd.json` -- are ALL stories marked `passes: true`?
   b. If NOT all complete, loop back to Step 2 (pick next story)
   c. If ALL complete, proceed to Step 7 (architect verification)

7. **Reviewer verification** (tiered, against acceptance criteria):
   - <5 files, <100 lines with full tests: STANDARD tier minimum (architect-medium / Sonnet)
   - Standard changes: STANDARD tier (architect-medium / Sonnet)
   - >20 files or security/architectural changes: THOROUGH tier (architect / Opus)
   - If `--critic=critic`, use Claude `critic` agent for approval pass
   - If `--critic=codex`, run `omc ask codex --agent-prompt critic "..."` for approval pass. Codex critic prompt MUST include:
     1. Full list of acceptance criteria from prd.json for verification
     2. Directive to evaluate whether implementation is **OPTIMAL** -- not just correct, but whether meaningfully better approach exists (simpler, faster, more maintainable)
     3. Directive to review **all code related to changes** (callers, callees, shared types, adjacent modules), not only directly modified files
     4. List of files changed during ralph session for context
   - Ralph floor: always at least STANDARD, even for small changes
   - Selected reviewer verifies against SPECIFIC acceptance criteria from prd.json, not vague "is it done?"
   - **On APPROVAL: immediately proceed to Step 7.5 in same turn. Do NOT pause to report verdict to user -- reporting happens only at Step 8 (`/oh-my-caveman:cancel`) or on rejection (Step 9). Treating approved verdict as reporting checkpoint is polite-stop anti-pattern.**

7.5 **Mandatory Deslop Pass** (runs unconditionally after Step 7 approval, unless `{{PROMPT}}` contains `--no-deslop`):
   - **Invoke `ai-slop-cleaner` skill via Skill tool: `Skill("ai-slop-cleaner")`.** Run in standard mode (not `--review`) on files changed during current Ralph session only.
   - **ai-slop-cleaner is SKILL, not agent.** Do NOT call via `Task(subagent_type="oh-my-caveman:ai-slop-cleaner")` -- that subagent type does not exist and call will fail with "Agent type not found". If error appears, retry with Skill tool -- do NOT substitute similarly-named agent like `code-simplifier` as "closest match".
   - Keep scope bounded to Ralph changed-file set; do not broaden cleanup pass to unrelated files.
   - If reviewer approved implementation but deslop pass introduces follow-up edits, keep those edits inside same changed-file scope before proceeding.

7.6 **Regression Re-verification**:
   - After deslop pass, re-run all relevant tests, build, and lint checks for Ralph session.
   - Read output and confirm post-deslop regression run actually passes.
   - If regression fails, roll back cleaner changes or fix regression, then rerun verification loop until it passes.
   - Only proceed to completion after post-deslop regression run passes (or `--no-deslop` explicitly specified).

8. **On approval**: After Step 7.6 passes (with Step 7.5 completed, or skipped via `--no-deslop`), run `/oh-my-caveman:cancel` to cleanly exit and clean up all state files

9. **On rejection**: Fix issues raised, re-verify with same reviewer, then loop back to check if story needs to be marked incomplete
</Steps>

<Tool_Usage>
- Use `Task(subagent_type="oh-my-caveman:architect", ...)` for architect verification cross-checks when changes are security-sensitive, architectural, or involve complex multi-system integration
- Use `Task(subagent_type="oh-my-caveman:critic", ...)` when `--critic=critic`
- Use `omc ask codex --agent-prompt critic "..."` when `--critic=codex`. Construct prompt to include: (a) prd.json acceptance criteria, (b) files changed + related files, (c) explicit optimality question: "Is there meaningfully simpler, faster, or more maintainable approach that achieves same acceptance criteria?"
- Skip architect consultation for simple feature additions, well-tested changes, or time-critical verification
- Proceed with architect agent verification alone -- never block on unavailable tools
- Use `state_write` / `state_read` for ralph mode state persistence between iterations
- **Skill vs agent invocation**: `ai-slop-cleaner` is skill, invoke via `Skill("ai-slop-cleaner")`. `architect`, `critic`, `executor` etc. are agents, invoke via `Task(subagent_type="oh-my-caveman:<name>")`. If "Agent type ... not found" for `oh-my-caveman:<name>` identifier, item is skill -- retry with Skill tool. Do NOT substitute similarly-named agent as "closest match".
</Tool_Usage>

<Examples>
<Good>
PRD refinement in Step 1:
```
Auto-generated scaffold has:
  acceptanceCriteria: ["Implementation is complete", "Code compiles without errors"]

After refinement:
  acceptanceCriteria: [
    "Legacy --no-prd text is stripped from the Ralph working prompt",
    "Ralph startup still creates or validates prd.json when legacy --no-prd text is present",
    "TypeScript compiles with no errors (npm run build)"
  ]
```
Generic criteria replaced with specific, testable criteria.
</Good>

<Good>
Correct parallel delegation:
```
Task(subagent_type="oh-my-caveman:executor", model="haiku", prompt="Add type export for UserConfig")
Task(subagent_type="oh-my-caveman:executor", model="sonnet", prompt="Implement the caching layer for API responses")
Task(subagent_type="oh-my-caveman:executor", model="opus", prompt="Refactor auth module to support OAuth2 flow")
```
Three independent tasks fired simultaneously at appropriate tiers.
</Good>

<Good>
Story-by-story verification:
```
1. Story US-001: "Add flag detection helpers"
   - Criterion: "Legacy --no-prd is stripped from the working prompt" → Run test → PASS
   - Criterion: "TypeScript compiles" → Run build → PASS
   - Mark US-001 passes: true
2. Story US-002: "Wire PRD into bridge.ts"
   - Continue to next story...
```
Each story verified against its own acceptance criteria before marking complete.
</Good>

<Bad>
Claiming completion without PRD verification:
"All the changes look good, the implementation should work correctly. Task complete."
Uses "should" and "look good" -- no fresh evidence, no story-by-story verification, no architect review.
</Bad>

<Bad>
Sequential execution of independent tasks:
```
Task(executor, "Add type export") → wait →
Task(executor, "Implement caching") → wait →
Task(executor, "Refactor auth")
```
Independent tasks should run in parallel, not sequentially.
</Bad>

<Bad>
Keeping generic acceptance criteria:
"prd.json created with criteria: Implementation is complete, Code compiles. Moving on to coding."
Did not refine scaffold criteria into task-specific ones. PRD theater.
</Bad>
</Examples>

<Escalation_And_Stop_Conditions>
- Stop and report when fundamental blocker requires user input (missing credentials, unclear requirements, external service down)
- Stop when user says "stop", "cancel", or "abort" -- run `/oh-my-caveman:cancel`
- Continue working when hook system sends "The boulder never stops" -- iteration continues
- If selected reviewer rejects verification, fix issues and re-verify (do not stop)
- If same issue recurs across 3+ iterations, report as potential fundamental problem
- **Do NOT stop after Step 7 approval.** Boulder continues through 7 → 7.5 → 7.6 → 8 in same turn as single chain. Step 7 is checkpoint inside loop, not reporting moment. Treating architect/critic APPROVED verdict as "time to summarise and wait for user acknowledgment" is polite-stop anti-pattern -- only reporting moments in Ralph are Step 8 (successful cancel) or Step 9 (rejection).
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] All prd.json stories have `passes: true` (no incomplete stories)
- [ ] prd.json acceptance criteria are task-specific (not generic boilerplate)
- [ ] All requirements from original task met (no scope reduction)
- [ ] Zero pending or in_progress TODO items
- [ ] Fresh test run output shows all tests pass
- [ ] Fresh build output shows success
- [ ] lsp_diagnostics shows 0 errors on affected files
- [ ] progress.txt records implementation details and learnings
- [ ] Selected reviewer verification passed against specific acceptance criteria
- [ ] ai-slop-cleaner pass completed on changed files (or `--no-deslop` specified)
- [ ] Post-deslop regression tests pass
- [ ] `/oh-my-caveman:cancel` run for clean state cleanup
</Final_Checklist>

<Advanced>
## Background Execution Rules

**Run in background** (`run_in_background: true`):
- Package installation (npm install, pip install, cargo build)
- Build processes (make, project build commands)
- Test suites
- Docker operations (docker build, docker pull)

**Run blocking** (foreground):
- Quick status checks (git status, ls, pwd)
- File reads and edits
- Simple commands
</Advanced>

Original task:
{{PROMPT}}
