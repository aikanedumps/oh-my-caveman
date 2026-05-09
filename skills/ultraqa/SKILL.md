---
name: ultraqa
description: QA cycling workflow - test, verify, fix, repeat until goal met
argument-hint: "[--tests|--build|--lint|--typecheck|--custom <pattern>] [--interactive]"
level: 3
---

# UltraQA Skill

[ULTRAQA ACTIVATED - AUTONOMOUS QA CYCLING]

## Overview

**ULTRAQA** mode — autonomous QA cycling. Runs until quality goal met.

**Cycle**: qa-tester → architect verification → fix → repeat

## Goal Parsing

Parse goal from arguments. Supported formats:

| Invocation | Goal Type | What to Check |
|------------|-----------|---------------|
| `/oh-my-caveman:ultraqa --tests` | tests | All test suites pass |
| `/oh-my-caveman:ultraqa --build` | build | Build succeeds with exit 0 |
| `/oh-my-caveman:ultraqa --lint` | lint | No lint errors |
| `/oh-my-caveman:ultraqa --typecheck` | typecheck | No TypeScript errors |
| `/oh-my-caveman:ultraqa --custom "pattern"` | custom | Custom success pattern in output |

No structured goal provided → interpret argument as custom goal.

## Cycle Workflow

### Cycle N (Max 5)

1. **RUN QA**: Execute verification based on goal type
   - `--tests`: Run project's test command
   - `--build`: Run project's build command
   - `--lint`: Run project's lint command
   - `--typecheck`: Run project's type check command
   - `--custom`: Run appropriate command, check for pattern
   - `--interactive`: Use qa-tester for interactive CLI/service testing:
     ```
     Task(subagent_type="oh-my-caveman:qa-tester", model="sonnet", prompt="TEST:
     Goal: [describe what to verify]
     Service: [how to start]
     Test cases: [specific scenarios to verify]")
     ```

2. **CHECK RESULT**: Did goal pass?
   - **YES** → Exit with success message
   - **NO** → Continue to step 3

3. **ARCHITECT DIAGNOSIS**: Spawn architect to analyze failure
   ```
   Task(subagent_type="oh-my-caveman:architect", model="opus", prompt="DIAGNOSE FAILURE:
   Goal: [goal type]
   Output: [test/build output]
   Provide root cause and specific fix recommendations.")
   ```

4. **FIX ISSUES**: Apply architect's recommendations
   ```
   Task(subagent_type="oh-my-caveman:executor", model="sonnet", prompt="FIX:
   Issue: [architect diagnosis]
   Files: [affected files]
   Apply the fix precisely as recommended.")
   ```

5. **REPEAT**: Go back to step 1

## Exit Conditions

| Condition | Action |
|-----------|--------|
| **Goal Met** | Exit with success: "ULTRAQA COMPLETE: Goal met after N cycles" |
| **Cycle 5 Reached** | Exit with diagnosis: "ULTRAQA STOPPED: Max cycles. Diagnosis: ..." |
| **Same Failure 3x** | Exit early: "ULTRAQA STOPPED: Same failure detected 3 times. Root cause: ..." |
| **Environment Error** | Exit: "ULTRAQA ERROR: [tmux/port/dependency issue]" |

## Observability

Output progress each cycle:
```
[ULTRAQA Cycle 1/5] Running tests...
[ULTRAQA Cycle 1/5] FAILED - 3 tests failing
[ULTRAQA Cycle 1/5] Architect diagnosing...
[ULTRAQA Cycle 1/5] Fixing: auth.test.ts - missing mock
[ULTRAQA Cycle 2/5] Running tests...
[ULTRAQA Cycle 2/5] PASSED - All 47 tests pass
[ULTRAQA COMPLETE] Goal met after 2 cycles
```

## State Tracking

Track state in `.omc/ultraqa-state.json`:
```json
{
  "active": true,
  "goal_type": "tests",
  "goal_pattern": null,
  "cycle": 1,
  "max_cycles": 5,
  "failures": ["3 tests failing: auth.test.ts"],
  "started_at": "2024-01-18T12:00:00Z",
  "session_id": "uuid"
}
```

## Cancellation

Cancel with `/oh-my-caveman:cancel` — clears state file.

## Important Rules

1. **PARALLEL when possible** - Run diagnosis while preparing potential fixes
2. **TRACK failures** - Record each failure to detect patterns
3. **EARLY EXIT on pattern** - 3x same failure = stop and surface
4. **CLEAR OUTPUT** - User must always know current cycle and status
5. **CLEAN UP** - Clear state file on completion or cancellation

## STATE CLEANUP ON COMPLETION

**IMPORTANT: Delete state files on completion - do NOT just set `active: false`**

When goal met OR max cycles reached OR exiting early:

```bash
# Delete ultraqa state file
rm -f .omc/state/ultraqa-state.json
```

Ensures clean state for future sessions. Stale state files with `active: false` must not be left behind.

---

Begin ULTRAQA cycling now. Parse goal and start cycle 1.
