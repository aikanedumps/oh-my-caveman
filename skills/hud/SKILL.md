---
name: hud
description: Configure HUD display options (layout, presets, display elements)
argument-hint: "[setup|minimal|focused|full|status]"
role: config-writer  # DOCUMENTATION ONLY - This skill writes to ~/.claude/ paths
scope: ~/.claude/**  # DOCUMENTATION ONLY - Allowed write scope
level: 2
---

# HUD Skill

Configure OMC HUD (Heads-Up Display) for statusline.

Note: All `~/.claude/...` paths in this guide respect `CLAUDE_CONFIG_DIR` when that environment variable is set.

## Quick Commands

| Command | Description |
|---------|-------------|
| `/oh-my-caveman:hud` | Show current HUD status (auto-setup if needed) |
| `/oh-my-caveman:hud setup` | Install/repair HUD statusline |
| `/oh-my-caveman:hud minimal` | Switch to minimal display |
| `/oh-my-caveman:hud focused` | Switch to focused display (default) |
| `/oh-my-caveman:hud full` | Switch to full display |
| `/oh-my-caveman:hud status` | Show detailed HUD status |

## Auto-Setup

Running `/oh-my-caveman:hud` or `/oh-my-caveman:hud setup` automatically:
1. Check if `~/.claude/hud/omc-hud.mjs` exists
2. Check if `statusLine` configured in `~/.claude/settings.json`
3. If missing, create HUD wrapper script and configure settings
4. Report status and prompt to restart Claude Code if changes were made

**IMPORTANT**: If argument is `setup` OR HUD script doesn't exist at `~/.claude/hud/omc-hud.mjs`, MUST create HUD files directly using instructions below.

### Setup Instructions (Run These Commands)

**Step 1:** Check if setup needed:
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude');console.log(f.existsSync(p.join(d,'hud','omc-hud.mjs'))?'EXISTS':'MISSING')"
```

**Step 2:** Verify plugin installed:
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude'),b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');try{const v=f.readdirSync(b).filter(x=>/^\d/.test(x)).sort((a,c)=>a.localeCompare(c,void 0,{numeric:true}));if(v.length===0){console.log('Plugin not installed - run: /plugin install oh-my-caveman');process.exit()}const l=v[v.length-1],h=p.join(b,l,'dist','hud','index.js');console.log('Version:',l);console.log(f.existsSync(h)?'READY':'NOT_FOUND - try reinstalling: /plugin install oh-my-caveman')}catch{console.log('Plugin not installed - run: /plugin install oh-my-caveman')}"
```

**Step 3:** If omc-hud.mjs MISSING or argument is `setup`, install HUD wrapper and its dependency from canonical template:

```bash
HUD_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hud"
mkdir -p "$HUD_DIR/lib"
cp "${CLAUDE_PLUGIN_ROOT}/scripts/lib/hud-wrapper-template.txt" "$HUD_DIR/omc-hud.mjs"
cp "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config-dir.mjs" "$HUD_DIR/lib/config-dir.mjs"
```

**IMPORTANT:** Always copy from canonical template at `scripts/lib/hud-wrapper-template.txt`. Do NOT write wrapper content inline — template is single source of truth, guarded by drift tests (`src/__tests__/hud-wrapper-template-sync.test.ts`, `src/__tests__/paths-consistency.test.ts`).

**Step 4:** Make executable (Unix only, skip on Windows):
```bash
node -e "if(process.platform==='win32'){console.log('Skipped (Windows)')}else{require('fs').chmodSync(require('path').join(process.env.CLAUDE_CONFIG_DIR||require('path').join(require('os').homedir(),'.claude'),'hud','omc-hud.mjs'),0o755);console.log('Done')}"
```

**Step 5:** Update settings.json to use HUD:

Read `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json`, then update/add `statusLine` field.

**IMPORTANT:** Do not use `~` in command. On Unix, use `$HOME` to keep path portable across machines. On Windows, use absolute path — Windows does not expand `~` in shell commands.

On Windows, determine correct path first:
```bash
node -e "const p=require('path').join(require('os').homedir(),'.claude','hud','omc-hud.mjs').split(require('path').sep).join('/');console.log(JSON.stringify(p))"
```

**IMPORTANT:** Command path MUST use forward slashes on all platforms. Claude Code executes statusLine commands via bash, which interprets backslashes as escape characters and breaks path.

On Unix, `statusLine` field stays portable:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hud/omc-hud.mjs"
  }
}
```

On Windows, path uses forward slashes (not backslashes):
```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/username/.claude/hud/omc-hud.mjs"
  }
}
```

Use Edit tool to add/update this field while preserving other settings.

**Step 6:** Clean up old HUD scripts (if any):
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude'),t=p.join(d,'hud','omc-hud.js');try{if(f.existsSync(t)){f.unlinkSync(t);console.log('Removed legacy omc-hud.js')}else{console.log('No legacy script found')}}catch{}"
```

**Step 7:** Tell user to restart Claude Code for changes to take effect.

## Display Presets

### Minimal
Shows only essentials:
```
[OMC] ralph | ultrawork | todos:2/5
```

### Focused (Default)
Shows all relevant elements:
```
[OMC] branch:main | ralph:3/10 | US-002 | ultrawork skill:planner | ctx:67% | agents:2 | bg:3/5 | todos:2/5
```

### Full
Shows everything including multi-line agent details:
```
[OMC] repo:oh-my-caveman branch:main | ralph:3/10 | US-002 (2/5) | ultrawork | ctx:[████░░]67% | agents:3 | bg:3/5 | todos:2/5
├─ O architect    2m   analyzing architecture patterns...
├─ e explore     45s   searching for test files
└─ s executor     1m   implementing validation logic
```

## Multi-Line Agent Display

When agents running, HUD shows detailed info on separate lines:
- **Tree characters** (`├─`, `└─`) show visual hierarchy
- **Agent code** (O, e, s) indicates agent type with model tier color
- **Duration** shows how long each agent has been running
- **Description** shows what each agent is doing (up to 45 chars)

## Display Elements

| Element | Description |
|---------|-------------|
| `[OMC]` | Mode identifier |
| `repo:name` | Git repository name (cyan) |
| `branch:name` | Git branch name (cyan) |
| `ralph:3/10` | Ralph loop iteration/max |
| `US-002` | Current PRD story ID |
| `ultrawork` | Active mode badge |
| `skill:name` | Last activated skill (cyan) |
| `ctx:67%` | Context window usage |
| `agents:2` | Running subagent count |
| `bg:3/5` | Background task slots |
| `todos:2/5` | Todo completion |

## Color Coding

- **Green**: Normal/healthy
- **Yellow**: Warning (context >70%, ralph >7)
- **Red**: Critical (context >85%, ralph at max)

## Configuration Location

HUD config stored in `~/.claude/settings.json` under `omcHud` key (or custom config directory if `CLAUDE_CONFIG_DIR` is set).

Legacy config location (deprecated): `~/.claude/.omc/hud-config.json`

## Manual Configuration

Manually edit config file. Each option can be set individually — unset values use defaults.

```json
{
  "preset": "focused",
  "elements": {
    "omcLabel": true,
    "ralph": true,
    "autopilot": true,
    "prdStory": true,
    "activeSkills": true,
    "lastSkill": true,
    "contextBar": true,
    "agents": true,
    "agentsFormat": "multiline",
    "backgroundTasks": true,
    "todos": true,
    "thinking": true,
    "thinkingFormat": "text",
    "permissionStatus": false,
    "apiKeySource": false,
    "profile": true,
    "promptTime": true,
    "sessionHealth": true,
    "useBars": true,
    "showCallCounts": true,
    "callCountsFormat": "auto",
    "safeMode": true,
    "maxOutputLines": 4
  },
  "thresholds": {
    "contextWarning": 70,
    "contextCompactSuggestion": 80,
    "contextCritical": 85,
    "ralphWarning": 7
  },
  "staleTaskThresholdMinutes": 30,
  "contextLimitWarning": {
    "threshold": 80,
    "autoCompact": false
  }
}
```

### callCountsFormat

Controls call-count badge icon style:
- `"auto"` (default): emoji on macOS/Linux, ASCII on Windows/WSL
- `"emoji"`: force `🔧 🤖 ⚡`
- `"ascii"`: force `T: A: S:`

### safeMode

When `safeMode` is `true` (default), HUD strips ANSI codes and uses ASCII-only output to prevent terminal rendering corruption during concurrent updates. Especially important on Windows and terminal multiplexers.

### agentsFormat Options

- `count`: agents:2
- `codes`: agents:Oes (type-coded with model tier casing)
- `codes-duration`: agents:O(2m)es (codes with duration)
- `detailed`: agents:[architect(2m),explore,exec]
- `descriptions`: O:analyzing code | e:searching (codes + what they're doing)
- `tasks`: [analyzing code, searching...] (just descriptions)
- `multiline`: Multi-line display with full agent details on separate lines

## Troubleshooting

If HUD not showing:
1. Run `/oh-my-caveman:hud setup` to auto-install and configure
2. Restart Claude Code after setup completes
3. Still not working → run `/oh-my-caveman:omc-doctor` for full diagnostics

**Legacy string format migration:** Older OMC versions wrote `statusLine` as plain string (e.g., `"~/.claude/hud/omc-hud.mjs"`). Modern Claude Code (v2.1+) requires object format. Running installer or `/oh-my-caveman:hud setup` auto-migrates legacy strings to correct object format:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hud/omc-hud.mjs"
  }
}
```

**Node 24+ compatibility:** HUD wrapper script imports `homedir` from `node:os` (not `node:path`). If you encounter `SyntaxError: The requested module 'path' does not provide an export named 'homedir'`, re-run installer to regenerate `omc-hud.mjs`.

Manual verification:
- HUD script: `~/.claude/hud/omc-hud.mjs`
- Settings: `~/.claude/settings.json` should have `statusLine` configured as object with `type` and `command` fields

---

*HUD updates automatically every ~300ms during active sessions.*
