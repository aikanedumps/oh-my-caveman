---
name: cancel
description: Cancel any active OMC mode (autopilot, ralph, ultrawork, ultraqa, swarm, ultrapilot, pipeline, team)
argument-hint: "[--force|--all]"
level: 2
---

# Cancel Skill

Detects and cancels active OMC mode.

**Cancel skill = standard exit for any OMC mode.**
Stop hook detects work complete, instructs LLM to invoke this skill for state cleanup. Cancel fails or gets interrupted → retry with `--force`, or wait for 2-hour staleness timeout.

## What It Does

Auto-detects active mode and cancels:
- **Autopilot**: Stops workflow, preserves progress for resume
- **Ralph**: Stops persistence loop, clears linked ultrawork if applicable
- **Ultrawork**: Stops parallel execution (standalone or linked)
- **UltraQA**: Stops QA cycling workflow
- **Swarm**: Stops coordinated agent swarm, releases claimed tasks
- **Ultrapilot**: Stops parallel autopilot workers
- **Pipeline**: Stops sequential agent pipeline
- **Team**: Sends shutdown_request to all teammates, waits for responses, calls TeamDelete, clears linked ralph if present
- **Team+Ralph (linked)**: Cancels team first (graceful shutdown), then clears ralph state. Cancelling ralph when linked also cancels team first.

## Usage

```
/oh-my-caveman:cancel
```

Or say: "cancelomc", "stopomc"

## Critical: Deferred Tool Handling

State management tools (`state_clear`, `state_read`, `state_write`, `state_list_active`,
`state_get_status`) may be registered as **deferred tools** by Claude Code. Before calling
any state tool, load all via `ToolSearch`:

```
ToolSearch(query="select:mcp__plugin_oh-my-caveman_t__state_clear,mcp__plugin_oh-my-caveman_t__state_read,mcp__plugin_oh-my-caveman_t__state_write,mcp__plugin_oh-my-caveman_t__state_list_active,mcp__plugin_oh-my-caveman_t__state_get_status")
```

If `state_clear` unavailable or fails, use **bash fallback** as **emergency escape from stop hook loop**. NOT full replacement for cancel flow — only removes state files to unblock session. Linked modes (e.g. ralph→ultrawork, autopilot→ralph/ultraqa) must be cleared separately by running fallback once per mode.

Replace `MODE` with specific mode (e.g. `ralplan`, `ralph`, `ultrawork`, `ultraqa`).

**WARNING:** Do NOT use this fallback for `autopilot` or `omc-teams`. Autopilot requires
`state_write(active=false)` to preserve resume data. omc-teams requires tmux session
cleanup that file deletion alone cannot do.

```bash
# Fallback: direct file removal when state_clear MCP tool is unavailable
SESSION_ID="${CLAUDE_SESSION_ID:-${CLAUDECODE_SESSION_ID:-}}"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || { d="$PWD"; while [ "$d" != "/" ] && [ ! -d "$d/.omc" ]; do d="$(dirname "$d")"; done; echo "$d"; })"

# Cross-platform SHA-256 (macOS: shasum, Linux: sha256sum)
sha256portable() { printf '%s' "$1" | (sha256sum 2>/dev/null || shasum -a 256) | cut -c1-16; }

# Resolve state directory (supports OMC_STATE_DIR centralized storage)
if [ -n "${OMC_STATE_DIR:-}" ]; then
  # Mirror getProjectIdentifier() from worktree-paths.ts
  SOURCE="$(git remote get-url origin 2>/dev/null || echo "$REPO_ROOT")"
  HASH="$(sha256portable "$SOURCE")"
  DIR_NAME="$(basename "$REPO_ROOT" | sed 's/[^a-zA-Z0-9_-]/_/g')"
  OMC_STATE="$OMC_STATE_DIR/${DIR_NAME}-${HASH}/state"
  [ ! -d "$OMC_STATE" ] && { echo "ERROR: State dir not found at $OMC_STATE" >&2; exit 1; }
elif [ "$REPO_ROOT" != "/" ] && [ -d "$REPO_ROOT/.omc" ]; then
  OMC_STATE="$REPO_ROOT/.omc/state"
else
  echo "ERROR: Could not locate .omc state directory" >&2
  exit 1
fi
MODE="ralplan"  # <-- replace with the target mode

# Clear session-scoped state for the specific mode
if [ -n "$SESSION_ID" ] && [ -d "$OMC_STATE/sessions/$SESSION_ID" ]; then
  rm -f "$OMC_STATE/sessions/$SESSION_ID/${MODE}-state.json"
  rm -f "$OMC_STATE/sessions/$SESSION_ID/${MODE}-stop-breaker.json"
  rm -f "$OMC_STATE/sessions/$SESSION_ID/skill-active-state.json"
  # Write cancel signal so stop hook detects cancellation in progress
  NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  EXPIRES_ISO="$(date -u -d "+30 seconds" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || python3 - <<'PY'\nfrom datetime import datetime, timedelta, timezone\nprint((datetime.now(timezone.utc) + timedelta(seconds=30)).strftime('%Y-%m-%dT%H:%M:%SZ'))\nPY\n)"
  printf '{"active":true,"requested_at":"%s","expires_at":"%s","mode":"%s","source":"bash_fallback"}' \
    "$NOW_ISO" "$EXPIRES_ISO" "$MODE" > "$OMC_STATE/sessions/$SESSION_ID/cancel-signal-state.json"
fi

# Clear legacy state only if no session ID (avoid clearing another session's state)
if [ -z "$SESSION_ID" ]; then
  rm -f "$OMC_STATE/${MODE}-state.json"
fi
```

## Auto-Detection

`/oh-my-caveman:cancel` follows session-aware state contract:
- Default: inspects current session via `state_list_active` and `state_get_status`, navigating `.omc/state/sessions/{sessionId}/…` to discover active mode.
- Session id provided or known → session-scoped path is authoritative. Legacy files in `.omc/state/*.json` consulted only as compatibility fallback if session id missing or empty.
- Swarm = shared SQLite/marker mode (`.omc/state/swarm.db` / `.omc/state/swarm-active.marker`) — not session-scoped.
- Default cleanup calls `state_clear` with session id to remove only matching session files; modes stay bound to originating session.

Active modes cancelled in dependency order:
1. Autopilot (includes linked ralph/ultraqa/ cleanup)
2. Ralph (cleans its linked ultrawork or )
3. Ultrawork (standalone)
4. UltraQA (standalone)
5. Swarm (standalone)
6. Ultrapilot (standalone)
7. Pipeline (standalone)
8. Team (Claude Code native)
9. OMC Teams (tmux CLI workers)
10. Plan Consensus (standalone)
11. Self-Improve (standalone — clear state, clean orphaned worktrees, preserve iteration_state for resume, set status: "user_stopped" in .omc/self-improve/state/agent-settings.json)

## Force Clear All

Use `--force` or `--all` to erase every session plus legacy artifacts, e.g., full workspace reset.

```
/oh-my-caveman:cancel --force
```

```
/oh-my-caveman:cancel --all
```

Steps under hood:
1. `state_list_active` enumerates `.omc/state/sessions/{sessionId}/…` to find every known session.
2. `state_clear` runs once per session to drop that session's files.
3. Global `state_clear` without `session_id` removes legacy files under `.omc/state/*.json`, `.omc/state/swarm*.db`, and compatibility artifacts (see list).
4. Team artifacts (`~/.claude/teams/*/`, `~/.claude/tasks/*/`, `.omc/state/team-state.json`) best-effort cleared as part of legacy fallback.
   - Cancel for native team does NOT affect omc-teams state, and vice versa.

Every `state_clear` honors `session_id` argument — force mode still uses session-aware paths before deleting legacy files.

Legacy compatibility list (removed only under `--force`/`--all`):
- `.omc/state/autopilot-state.json`
- `.omc/state/ralph-state.json`
- `.omc/state/ralph-plan-state.json`
- `.omc/state/ralph-verification.json`
- `.omc/state/ultrawork-state.json`
- `.omc/state/ultraqa-state.json`
- `.omc/state/swarm.db`
- `.omc/state/swarm.db-wal`
- `.omc/state/swarm.db-shm`
- `.omc/state/swarm-active.marker`
- `.omc/state/swarm-tasks.db`
- `.omc/state/ultrapilot-state.json`
- `.omc/state/ultrapilot-ownership.json`
- `.omc/state/pipeline-state.json`
- `.omc/state/omc-teams-state.json`
- `.omc/state/plan-consensus.json`
- `.omc/state/ralplan-state.json`
- `.omc/state/boulder.json`
- `.omc/state/hud-state.json`
- `.omc/state/subagent-tracking.json`
- `.omc/state/subagent-tracker.lock`
- `.omc/state/rate-limit-daemon.pid`
- `.omc/state/rate-limit-daemon.log`
- `.omc/state/checkpoints/` (directory)
- `.omc/state/sessions/` (empty directory cleanup after clearing sessions)

## Implementation Steps

When skill invoked:

### 1. Parse Arguments

```bash
# Check for --force or --all flags
FORCE_MODE=false
if [[ "$*" == *"--force"* ]] || [[ "$*" == *"--all"* ]]; then
  FORCE_MODE=true
fi
```

### 2. Detect Active Modes

Skill relies on session-aware state contract, not hard-coded file paths:
1. Call `state_list_active` to enumerate `.omc/state/sessions/{sessionId}/…` and discover every active session.
2. For each session id, call `state_get_status` to learn which mode is running (`autopilot`, `ralph`, `ultrawork`, etc.) and whether dependent modes exist.
3. If `session_id` was supplied to `/oh-my-caveman:cancel`, skip legacy fallback entirely — operate solely within that session path; otherwise, consult legacy files in `.omc/state/*.json` only if state tools report no active session. Swarm remains shared SQLite/marker mode outside session scoping.
4. Cancellation logic mirrors dependency order discovered via state tools (autopilot → ralph → …).

### 3A. Force Mode (if --force or --all)

Use force mode to clear every session plus legacy artifacts via `state_clear`. Direct file removal reserved for legacy cleanup when state tools report no active sessions.

### 3B. Smart Cancellation (default)

#### If Team Active (Claude Code native)

Teams detected by checking for config files in `${CLAUDE_CONFIG_DIR:-~/.claude}/teams/`:

```bash
# Check for active teams
TEAM_CONFIGS=$(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/teams -name config.json -maxdepth 2 2>/dev/null)
```

**Two-pass cancellation protocol:**

**Pass 1: Graceful Shutdown**
```
For each team found in ${CLAUDE_CONFIG_DIR:-~/.claude}/teams/:
  1. Read config.json to get team_name and members list
  2. For each non-lead member:
     a. Send shutdown_request via SendMessage
     b. Wait up to 15 seconds for shutdown_response
     c. If response received: member terminates and is auto-removed
     d. If timeout: mark member as unresponsive, continue to next
  3. Log: "Graceful pass: X/Y members responded"
```

**Pass 2: Reconciliation**
```
After graceful pass:
  1. Re-read config.json to check remaining members
  2. If only lead remains (or config is empty): proceed to TeamDelete
  3. If unresponsive members remain:
     a. Wait 5 more seconds (they may still be processing)
     b. Re-read config.json again
     c. If still stuck: attempt TeamDelete anyway
     d. If TeamDelete fails: report manual cleanup path
```

**TeamDelete + Cleanup:**
```
  1. Call TeamDelete() — removes ~/.claude/teams/{name}/ and ~/.claude/tasks/{name}/
  2. Clear team state: state_clear(mode="team")
  3. Check for linked ralph: state_read(mode="ralph") — if linked_team is true:
     a. Clear ralph state: state_clear(mode="ralph")
     b. Clear linked ultrawork if present: state_clear(mode="ultrawork")
  4. Run orphan scan (see below)
  5. Emit structured cancel report
```

**Orphan Detection (Post-Cleanup):**

After TeamDelete, verify no agent processes remain:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-orphans.mjs" --team-name "{team_name}"
```

Orphan scanner:
1. Checks `ps aux` (Unix) or `tasklist` (Windows) for processes with `--team-name` matching deleted team
2. For each orphan whose team config no longer exists: sends SIGTERM, waits 5s, sends SIGKILL if still alive
3. Reports cleanup results as JSON

Use `--dry-run` to inspect without killing. Scanner safe to run multiple times.

**Structured Cancel Report:**
```
Team "{team_name}" cancelled:
  - Members signaled: N
  - Responses received: M
  - Unresponsive: K (list names if any)
  - TeamDelete: success/failed
  - Manual cleanup needed: yes/no
    Path: ~/.claude/teams/{name}/ and ~/.claude/tasks/{name}/
```

**Implementation note:** Cancel skill runs as LLM, not bash script. When active team detected:
1. Read `${CLAUDE_CONFIG_DIR:-~/.claude}/teams/*/config.json` to find active teams
2. Multiple teams exist → cancel oldest first (by `createdAt`)
3. For each non-lead member, call `SendMessage(type: "shutdown_request", recipient: member-name, content: "Cancelling")`
4. Wait briefly for shutdown responses (15s per member timeout)
5. Re-read config.json to check remaining members (reconciliation pass)
6. Call `TeamDelete()` to clean up
7. Clear team state: `state_clear(mode="team", session_id)`
8. Report structured summary to user

#### If Autopilot Active

Autopilot handles own cleanup including linked ralph and ultraqa.

1. Read autopilot state via `state_read(mode="autopilot", session_id)` to get current phase
2. Check for linked ralph via `state_read(mode="ralph", session_id)`:
   - If ralph active and has `linked_ultrawork: true`, clear ultrawork first: `state_clear(mode="ultrawork", session_id)`
   - Clear ralph: `state_clear(mode="ralph", session_id)`
3. Check for linked ultraqa via `state_read(mode="ultraqa", session_id)`:
   - If active, clear it: `state_clear(mode="ultraqa", session_id)`
4. Mark autopilot inactive (preserve state for resume) via `state_write(mode="autopilot", session_id, state={active: false, ...existing})`

#### If Ralph Active (but not Autopilot)

1. Read ralph state via `state_read(mode="ralph", session_id)` to check for linked ultrawork
2. If `linked_ultrawork: true`:
   - Read ultrawork state to verify `linked_to_ralph: true`
   - If linked, clear ultrawork: `state_clear(mode="ultrawork", session_id)`
3. Clear ralph: `state_clear(mode="ralph", session_id)`

#### If Ultrawork Active (standalone, not linked)

1. Read ultrawork state via `state_read(mode="ultrawork", session_id)`
2. If `linked_to_ralph: true`, warn user to cancel ralph instead (cascades)
3. Otherwise clear: `state_clear(mode="ultrawork", session_id)`

#### If UltraQA Active (standalone)

Clear directly: `state_clear(mode="ultraqa", session_id)`

#### No Active Modes

Report: "No active OMC modes detected. Use --force to clear all state files anyway."

## Implementation Notes

Cancel skill runs as follows:
1. Parse `--force` / `--all` flags, track whether cleanup spans every session or stays scoped to current session id.
2. Use `state_list_active` to enumerate known session ids and `state_get_status` to learn active mode (`autopilot`, `ralph`, `ultrawork`, etc.) for each session.
3. Default mode: call `state_clear` with session_id to remove only session's files, then run mode-specific cleanup (autopilot → ralph → …) based on state tool signals.
4. Force mode: iterate every active session, call `state_clear` per session, then run global `state_clear` without `session_id` to drop legacy files (`.omc/state/*.json`, compatibility artifacts) and report success. Swarm remains shared SQLite/marker mode outside session scoping.
5. Team artifacts (`~/.claude/teams/*/`, `~/.claude/tasks/*/`, `.omc/state/team-state.json`) remain best-effort cleanup items invoked during legacy/global pass.
6. **Always** clear skill-active state as final step, regardless of which mode was active or whether `--force` was used:
   ```
   state_clear(mode="skill-active", session_id)
   ```
   Ensures stop hook does not keep firing skill-protection reinforcements after cancel due to stale `skill-active-state.json`. See issue #2118.

State tools always honor `session_id` argument — force mode still clears session-scoped paths before deleting compatibility-only legacy state.

Mode-specific subsections below describe extra cleanup each handler performs after state-wide operations finish.
## Messages Reference

| Mode | Success Message |
|------|-----------------|
| Autopilot | "Autopilot cancelled at phase: {phase}. Progress preserved for resume." |
| Ralph | "Ralph cancelled. Persistent mode deactivated." |
| Ultrawork | "Ultrawork cancelled. Parallel execution mode deactivated." |
| UltraQA | "UltraQA cancelled. QA cycling workflow stopped." |
| Swarm | "Swarm cancelled. Coordinated agents stopped." |
| Ultrapilot | "Ultrapilot cancelled. Parallel autopilot workers stopped." |
| Pipeline | "Pipeline cancelled. Sequential agent chain stopped." |
| Team | "Team cancelled. Teammates shut down and cleaned up." |
| Plan Consensus | "Plan Consensus cancelled. Planning session ended." |
| Force | "All OMC modes cleared. You are free to start fresh." |
| None | "No active OMC modes detected." |

## What Gets Preserved

| Mode | State Preserved | Resume Command |
|------|-----------------|----------------|
| Autopilot | Yes (phase, files, spec, plan, verdicts) | `/oh-my-caveman:autopilot` |
| Ralph | No | N/A |
| Ultrawork | No | N/A |
| UltraQA | No | N/A |
| Swarm | No | N/A |
| Ultrapilot | No | N/A |
| Pipeline | No | N/A |
| Plan Consensus | Yes (plan file path preserved) | N/A |

## Notes

- **Dependency-aware**: Autopilot cancellation cleans up Ralph and UltraQA
- **Link-aware**: Ralph cancellation cleans up linked Ultrawork
- **Safe**: Only clears linked Ultrawork, preserves standalone Ultrawork
- **Local-only**: Clears state files in `.omc/state/` directory
- **Resume-friendly**: Autopilot state preserved for seamless resume
- **Team-aware**: Detects native Claude Code teams and performs graceful shutdown

## MCP Worker Cleanup

When cancelling modes that may have spawned MCP workers (team bridge daemons):

1. **Check for active MCP workers**: Look for heartbeat files at `.omc/state/team-bridge/{team}/*.heartbeat.json`
2. **Send shutdown signals**: Write shutdown signal files for each active worker
3. **Kill tmux sessions**: Run `tmux kill-session -t omc-team-{team}-{worker}` for each worker
4. **Clean up heartbeat files**: Remove all heartbeat files for team
5. **Clean up shadow registry**: Remove `.omc/state/team-mcp-workers.json`

### Force Clear Addition

When `--force` used, also clean up:
```bash
rm -rf .omc/state/team-bridge/       # Heartbeat files
rm -f .omc/state/team-mcp-workers.json  # Shadow registry
# Kill all omc-team-* tmux sessions
tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^omc-team-' | while read s; do tmux kill-session -t "$s" 2>/dev/null; done
```
