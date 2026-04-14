---
name: omc-setup
description: Install or refresh oh-my-caveman for plugin, npm, and local-dev setups from the canonical setup flow
level: 2
---

# OMC Setup

**One command to learn. Everything else automatic.**

**When skill invoked, immediately execute workflow below. Do not restate or summarize instructions back to user.**

Note: All `~/.claude/...` paths respect `CLAUDE_CONFIG_DIR` when that env var is set.

## Best-Fit Use

Use this setup flow when user wants to **install, refresh, or repair OMC itself**.

- Marketplace/plugin install users land here after `/plugin install oh-my-caveman`
- npm users land here after `npm i -g oh-my-caveman@latest`
- local-dev and worktree users land here after updating checked-out repo and rerunning setup

## Flag Parsing

Check flags in user's invocation:
- `--help` → Show Help Text (below) and stop
- `--local` → Phase 1 only (target=local), then stop
- `--global` → Phase 1 only (target=global), then stop
- `--force` → Skip Pre-Setup Check, run full setup (Phase 1 → 2 → 3 → 4)
- No flags → Run Pre-Setup Check, then full setup if needed

## Help Text

When user runs with `--help`, display this and stop:

```
OMC Setup - Configure oh-my-caveman

USAGE:
  /oh-my-caveman:omc-setup           Run initial setup wizard (or update if already configured)
  /oh-my-caveman:omc-setup --local   Configure local project (.claude/CLAUDE.md)
  /oh-my-caveman:omc-setup --global  Configure global settings (~/.claude/CLAUDE.md)
  /oh-my-caveman:omc-setup --force   Force full setup wizard even if already configured
  /oh-my-caveman:omc-setup --help    Show this help

MODES:
  Initial Setup (no flags)
    - Interactive wizard for first-time setup
    - Configures CLAUDE.md (local or global)
    - Sets up HUD statusline
    - Checks for updates
    - Offers MCP server configuration
    - Configures team mode defaults (agent count, type, model)
    - If already configured, offers quick update option

  Local Configuration (--local)
    - Downloads fresh CLAUDE.md to ./.claude/
    - Backs up existing CLAUDE.md to .claude/CLAUDE.md.backup.YYYY-MM-DD
    - Project-specific settings
    - Use this to update project config after OMC upgrades

  Global Configuration (--global)
    - Downloads fresh CLAUDE.md to ~/.claude/
    - Backs up existing CLAUDE.md to ~/.claude/CLAUDE.md.backup.YYYY-MM-DD
    - Default: explicitly overwrites ~/.claude/CLAUDE.md so plain `claude` also uses OMC
    - Optional preserve mode keeps user's base `CLAUDE.md` and installs OMC into `CLAUDE-omc.md` for `omc` launches
    - Applies to all Claude Code sessions
    - Cleans up legacy hooks
    - Use this to update global config after OMC upgrades

  Force Full Setup (--force)
    - Bypasses the "already configured" check
    - Runs complete setup wizard from scratch
    - Use when you want to reconfigure preferences

EXAMPLES:
  /oh-my-caveman:omc-setup           # First time setup (or update CLAUDE.md if configured)
  /oh-my-caveman:omc-setup --local   # Update this project
  /oh-my-caveman:omc-setup --global  # Update all projects
  /oh-my-caveman:omc-setup --force   # Re-run full setup wizard

For more info: https://github.com/aikanedumps/oh-my-caveman
```

## Pre-Setup Check: Already Configured?

**CRITICAL**: Before anything else, check if setup already completed. Prevents users from re-running full setup wizard after every update.

```bash
# Check if setup was already completed
CONFIG_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.omc-config.json"

if [ -f "$CONFIG_FILE" ]; then
  SETUP_COMPLETED=$(jq -r '.setupCompleted // empty' "$CONFIG_FILE" 2>/dev/null)
  SETUP_VERSION=$(jq -r '.setupVersion // empty' "$CONFIG_FILE" 2>/dev/null)

  if [ -n "$SETUP_COMPLETED" ] && [ "$SETUP_COMPLETED" != "null" ]; then
    echo "OMC setup was already completed on: $SETUP_COMPLETED"
    [ -n "$SETUP_VERSION" ] && echo "Setup version: $SETUP_VERSION"
    ALREADY_CONFIGURED="true"
  fi
fi
```

### If Already Configured (and no --force flag)

If `ALREADY_CONFIGURED` is true AND user did NOT pass `--force`, `--local`, or `--global` flags:

Use AskUserQuestion to prompt:

**Question:** "OMC is already configured. What would you like to do?"

**Options:**
1. **Update CLAUDE.md only** - Download latest CLAUDE.md without re-running full setup
2. **Run full setup again** - Go through complete setup wizard
3. **Cancel** - Exit without changes

**If user chooses "Update CLAUDE.md only":**
- Detect if local (.claude/CLAUDE.md) or global (~/.claude/CLAUDE.md) config exists
- If local exists, run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-claude-md.sh" local`
- If only global exists, run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-claude-md.sh" global`
- Skip all other steps
- Report success and exit

**If user chooses "Run full setup again":**
- Continue with Resume Detection below

**If user chooses "Cancel":**
- Exit without any changes

### Force Flag Override

User passes `--force` → skip this check and proceed directly to setup.

## Resume Detection

Before starting any phase, check for existing state:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-progress.sh" resume
```

If state exists (output not "fresh"), use AskUserQuestion to prompt:

**Question:** "Found a previous setup session. Would you like to resume or start fresh?"

**Options:**
1. **Resume from step $LAST_STEP** - Continue where you left off
2. **Start fresh** - Begin from beginning (clears saved state)

If user chooses "Start fresh":
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-progress.sh" clear
```

## Phase Execution

### For `--local` or `--global` flags:
Read file at `${CLAUDE_PLUGIN_ROOT}/skills/omc-setup/phases/01-install-claude-md.md` and follow its instructions.
(Phase file handles early exit for flag mode.)

### For full setup (default or --force):
Execute phases sequentially. For each phase, read corresponding file and follow its instructions:

1. **Phase 1 - Install CLAUDE.md**: Read `${CLAUDE_PLUGIN_ROOT}/skills/omc-setup/phases/01-install-claude-md.md` and follow its instructions.

2. **Phase 2 - Environment Configuration**: Read `${CLAUDE_PLUGIN_ROOT}/skills/omc-setup/phases/02-configure.md` and follow its instructions. Phase 2 must delegate HUD/statusLine setup to `hud` skill; do not generate or patch `statusLine` paths inline here.

3. **Phase 3 - Integration Setup**: Read `${CLAUDE_PLUGIN_ROOT}/skills/omc-setup/phases/03-integrations.md` and follow its instructions.

4. **Phase 4 - Completion**: Read `${CLAUDE_PLUGIN_ROOT}/skills/omc-setup/phases/04-welcome.md` and follow its instructions.

## Graceful Interrupt Handling

**IMPORTANT**: Setup process saves progress after each phase via `${CLAUDE_PLUGIN_ROOT}/scripts/setup-progress.sh`. If interrupted (Ctrl+C or connection loss), setup can resume from where it left off.

## Keeping Up to Date

After installing oh-my-caveman updates (via npm or plugin update):

**Automatic**: Run `/oh-my-caveman:omc-setup` — detects already configured and offers quick "Update CLAUDE.md only" option that skips full wizard.

**Manual options**:
- `/oh-my-caveman:omc-setup --local` to update project config only
- `/oh-my-caveman:omc-setup --global` to update global config only
- `/oh-my-caveman:omc-setup --force` to re-run full wizard (reconfigure preferences)

Gets newest features and agent configurations without token cost of repeating full setup.
