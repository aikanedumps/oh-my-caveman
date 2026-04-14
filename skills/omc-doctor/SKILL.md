---
name: omc-doctor
description: Diagnose and fix oh-my-caveman installation issues
level: 3
---

# Doctor Skill

Note: All `~/.claude/...` paths respect `CLAUDE_CONFIG_DIR` when that env var is set.

## Task: Run Installation Diagnostics

You are OMC Doctor. Diagnose and fix installation issues.

### Step 1: Check Plugin Version

```bash
# Get installed and latest versions (cross-platform)
node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=process.env.CLAUDE_CONFIG_DIR||p.join(h,'.claude'),b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');try{const v=f.readdirSync(b).filter(x=>/^\d/.test(x)).sort((a,c)=>a.localeCompare(c,void 0,{numeric:true}));console.log('Installed:',v.length?v[v.length-1]:'(none)')}catch{console.log('Installed: (none)')}"
npm view oh-my-caveman version 2>/dev/null || echo "Latest: (unavailable)"
```

**Diagnosis**:
- No version installed: CRITICAL - plugin not installed
- INSTALLED != LATEST: WARN - outdated plugin
- Multiple versions exist: WARN - stale cache

### Step 2: Check for Legacy Hooks in settings.json

Read both `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json` (profile-level) and `./.claude/settings.json` (project-level). Check for `"hooks"` key with entries like:
- `bash ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/keyword-detector.sh`
- `bash ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/persistent-mode.sh`
- `bash ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/session-start.sh`

**Diagnosis**:
- Found: CRITICAL - legacy hooks causing duplicates

### Step 3: Check for Legacy Bash Hook Scripts

```bash
ls -la "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/hooks/*.sh 2>/dev/null
```

**Diagnosis**:
- `keyword-detector.sh`, `persistent-mode.sh`, `session-start.sh`, or `stop-continuation.sh` exist: WARN - legacy scripts (can cause confusion)

### Step 4: Check CLAUDE.md

```bash
# Check if CLAUDE.md exists
ls -la "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/CLAUDE.md 2>/dev/null

# Check for OMC markers (<!-- OMC:START --> is canonical marker)
grep -q "<!-- OMC:START -->" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md" 2>/dev/null && echo "Has OMC config" || echo "Missing OMC config in CLAUDE.md"

# Check CLAUDE.md (or deterministic companion) version marker and compare with latest installed plugin cache version
node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=process.env.CLAUDE_CONFIG_DIR||p.join(h,'.claude');const base=p.join(d,'CLAUDE.md');let baseContent='';try{baseContent=f.readFileSync(base,'utf8')}catch{};let candidates=[base];let referenced='';const importMatch=baseContent.match(/CLAUDE-[^ )]*\\.md/);if(importMatch){referenced=p.join(d,importMatch[0]);candidates.push(referenced)}else{const defaultCompanion=p.join(d,'CLAUDE-omc.md');if(f.existsSync(defaultCompanion))candidates.push(defaultCompanion);try{const others=f.readdirSync(d).filter(n=>/^CLAUDE-.*\\.md$/i.test(n)).sort().map(n=>p.join(d,n));for(const o of others){if(candidates.includes(o)===false)candidates.push(o)}}catch{}};let claudeV='(missing)';let claudeSource='(none)';for(const file of candidates){try{const c=f.readFileSync(file,'utf8');const m=c.match(/<!--\\s*OMC:VERSION:([^\\s]+)\\s*-->/i);if(m){claudeV=m[1];claudeSource=file;break}}catch{}};if(claudeV==='(missing)'&&candidates.length>0){claudeV='(missing marker)';claudeSource='scanned deterministic CLAUDE sources';};let pluginV='(none)';try{const b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');const v=f.readdirSync(b).filter(x=>/^\\d/.test(x)).sort((a,c)=>a.localeCompare(c,void 0,{numeric:true}));pluginV=v.length?v[v.length-1]:'(none)';}catch{};console.log('CLAUDE.md OMC version:',claudeV);console.log('OMC version source:',claudeSource);console.log('Latest cached plugin version:',pluginV);if(claudeV==='(missing)'||claudeV==='(missing marker)'||pluginV==='(none)'){console.log('VERSION CHECK SKIPPED: missing CLAUDE marker or plugin cache')}else if(claudeV===pluginV){console.log('VERSION MATCH: CLAUDE and plugin cache are aligned')}else{console.log('VERSION DRIFT: CLAUDE.md and plugin versions differ')}"

# Check companion files for file-split pattern (e.g. CLAUDE-omc.md)
find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" -maxdepth 1 -type f -name 'CLAUDE-*.md' -print 2>/dev/null
while IFS= read -r f; do
  grep -q "<!-- OMC:START -->" "$f" 2>/dev/null && echo "Has OMC config in companion: $f"
done < <(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" -maxdepth 1 -type f -name 'CLAUDE-*.md' -print 2>/dev/null)

# Check if CLAUDE.md references a companion file
grep -o "CLAUDE-[^ )]*\.md" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md" 2>/dev/null
```

**Diagnosis**:
- CLAUDE.md missing: CRITICAL - CLAUDE.md not configured
- `<!-- OMC:START -->` found in CLAUDE.md: OK
- `<!-- OMC:START -->` found in companion file (e.g. `CLAUDE-omc.md`): OK - file-split pattern detected
- No OMC markers in CLAUDE.md or any companion: WARN - outdated CLAUDE.md
- `OMC:VERSION` marker missing from deterministic CLAUDE source scan (base + referenced companion): WARN - cannot verify CLAUDE.md freshness
- `CLAUDE.md OMC version` != `Latest cached plugin version`: WARN - version drift (run `omc update` or `omc setup`)

### Step 5: Check for Stale Plugin Cache

```bash
# Count versions in cache (cross-platform)
node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=process.env.CLAUDE_CONFIG_DIR||p.join(h,'.claude'),b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');try{const v=f.readdirSync(b).filter(x=>/^\d/.test(x));console.log(v.length+' version(s):',v.join(', '))}catch{console.log('0 versions')}"
```

**Diagnosis**:
- > 1 version: WARN - multiple cached versions (cleanup recommended)

### Step 6: Check for Legacy Curl-Installed Content

Check for legacy agents, commands, and skills installed via curl (before plugin system).
**Important**: Only flag files whose names match actual plugin-provided names. Do NOT flag user custom agents/commands/skills unrelated to OMC.

```bash
# Check for legacy agents directory
ls -la "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/agents/ 2>/dev/null

# Check for legacy commands directory
ls -la "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/commands/ 2>/dev/null

# Check for legacy skills directory
ls -la "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/skills/ 2>/dev/null
```

**Diagnosis**:
- `~/.claude/agents/` exists with files matching plugin agent names: WARN - legacy agents (now provided by plugin)
- `~/.claude/commands/` exists with files matching plugin command names: WARN - legacy commands (now provided by plugin)
- `~/.claude/skills/` exists with files matching plugin skill names: WARN - legacy skills (now provided by plugin)
- Custom files that do NOT match plugin names: OK - user custom content, do not flag

**Known plugin agent names** (check agents/ for these):
`architect.md`, `document-specialist.md`, `explore.md`, `executor.md`, `debugger.md`, `planner.md`, `analyst.md`, `critic.md`, `verifier.md`, `test-engineer.md`, `designer.md`, `writer.md`, `qa-tester.md`, `scientist.md`, `security-reviewer.md`, `code-reviewer.md`, `git-master.md`, `code-simplifier.md`

**Known plugin skill names** (check skills/ for these):
`ai-slop-cleaner`, `ask`, `autopilot`, `cancel`, `ccg`, `configure-notifications`, `deep-interview`, `deepinit`, `external-context`, `hud`, `learner`, `mcp-setup`, `omc-doctor`, `omc-setup`, `omc-teams`, `plan`, `project-session-manager`, `ralph`, `ralplan`, `release`, `sciomc`, `setup`, `skill`, `team`, `ultraqa`, `ultrawork`, `visual-verdict`, `writer-memory`

**Known plugin command names** (check commands/ for these):
`ultrawork.md`, `deepsearch.md`

---

## Report Format

After running all checks, output report:

```
## OMC Doctor Report

### Summary
[HEALTHY / ISSUES FOUND]

### Checks

| Check | Status | Details |
|-------|--------|---------|
| Plugin Version | OK/WARN/CRITICAL | ... |
| Legacy Hooks (settings.json) | OK/CRITICAL | ... |
| Legacy Scripts (~/.claude/hooks/) | OK/WARN | ... |
| CLAUDE.md | OK/WARN/CRITICAL | ... |
| Plugin Cache | OK/WARN | ... |
| Legacy Agents (~/.claude/agents/) | OK/WARN | ... |
| Legacy Commands (~/.claude/commands/) | OK/WARN | ... |
| Legacy Skills (~/.claude/skills/) | OK/WARN | ... |

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommended Fixes
[List fixes based on issues]
```

---

## Auto-Fix (if user confirms)

Issues found — ask user: "Would you like me to fix these issues automatically?"

If yes, apply fixes:

### Fix: Legacy Hooks in settings.json
Remove `"hooks"` section from `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json` (keep other settings intact)

### Fix: Legacy Bash Scripts
```bash
rm -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/hooks/keyword-detector.sh
rm -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/hooks/persistent-mode.sh
rm -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/hooks/session-start.sh
rm -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/hooks/stop-continuation.sh
```

### Fix: Outdated Plugin
```bash
# Clear plugin cache (cross-platform)
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude'),b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');try{f.rmSync(b,{recursive:true,force:true});console.log('Plugin cache cleared. Restart Claude Code to fetch latest version.')}catch{console.log('No plugin cache found')}"
```

### Fix: Stale Cache (multiple versions)
```bash
# Keep only latest version (cross-platform)
node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=process.env.CLAUDE_CONFIG_DIR||p.join(h,'.claude'),b=p.join(d,'plugins','cache','oh-my-caveman','oh-my-caveman');try{const v=f.readdirSync(b).filter(x=>/^\d/.test(x)).sort((a,c)=>a.localeCompare(c,void 0,{numeric:true}));v.slice(0,-1).forEach(x=>f.rmSync(p.join(b,x),{recursive:true,force:true}));console.log('Removed',v.length-1,'old version(s)')}catch(e){console.log('No cache to clean')}"
```

### Fix: Missing/Outdated CLAUDE.md
Fetch latest from GitHub, write to `${CLAUDE_CONFIG_DIR:-~/.claude}/CLAUDE.md`:
```
WebFetch(url: "https://raw.githubusercontent.com/aikanedumps/oh-my-caveman/main/docs/CLAUDE.md", prompt: "Return the complete raw markdown content exactly as-is")
```

### Fix: Legacy Curl-Installed Content

Remove legacy agents, commands, and skills directories (now provided by plugin):

```bash
# Backup first (optional - ask user)
# mv "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/agents "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/agents.bak
# mv "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/commands "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/commands.bak
# mv "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/skills "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/skills.bak

# Or remove directly
rm -rf "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/agents
rm -rf "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/commands
rm -rf "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/skills
```

**Note**: Only remove if these contain oh-my-caveman-related files. If user has custom agents/commands/skills, warn and ask before removing.

---

## Post-Fix

After fixes applied:
> Fixes applied. **Restart Claude Code** for changes to take effect.
