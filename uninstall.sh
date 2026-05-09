#!/usr/bin/env bash
# oh-my-caveman uninstaller
# Removes all plugin files, cache, HUD, and settings entries.
# Safe to run multiple times.

set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
INSTALLED_PLUGINS="$CLAUDE_DIR/plugins/installed_plugins.json"

echo "oh-my-caveman uninstall starting..."
echo ""

# 1. Plugin cache (~/.claude/plugins/cache/oh-my-caveman/)
CACHE_DIR="$CLAUDE_DIR/plugins/cache/oh-my-caveman"
if [ -d "$CACHE_DIR" ]; then
  echo "  Removing plugin cache: $CACHE_DIR"
  rm -rf "$CACHE_DIR"
else
  echo "  Plugin cache not found (already clean)"
fi

# 2. Marketplace clone (~/.claude/plugins/marketplaces/oh-my-caveman/)
MARKETPLACE_DIR="$CLAUDE_DIR/plugins/marketplaces/oh-my-caveman"
if [ -d "$MARKETPLACE_DIR" ]; then
  echo "  Removing marketplace clone: $MARKETPLACE_DIR"
  rm -rf "$MARKETPLACE_DIR"
fi

# 3. HUD files (~/.claude/hud/omc-hud.mjs + lib/)
HUD_SCRIPT="$CLAUDE_DIR/hud/omc-hud.mjs"
HUD_LIB="$CLAUDE_DIR/hud/lib"
if [ -f "$HUD_SCRIPT" ]; then
  echo "  Removing HUD script: $HUD_SCRIPT"
  rm -f "$HUD_SCRIPT"
fi
if [ -d "$HUD_LIB" ]; then
  echo "  Removing HUD lib: $HUD_LIB"
  rm -rf "$HUD_LIB"
fi
if [ -d "$CLAUDE_DIR/hud" ] && [ -z "$(ls -A "$CLAUDE_DIR/hud")" ]; then
  rmdir "$CLAUDE_DIR/hud"
fi

# 4. Config file
OMC_CONFIG="$CLAUDE_DIR/.omc-config.json"
if [ -f "$OMC_CONFIG" ]; then
  echo "  Removing config: $OMC_CONFIG"
  rm -f "$OMC_CONFIG"
fi

# 5. Legacy flag file
FLAG_FILE="$CLAUDE_DIR/.caveman-active"
if [ -f "$FLAG_FILE" ]; then
  echo "  Removing flag: $FLAG_FILE"
  rm -f "$FLAG_FILE"
fi

# 6. settings.json: statusLine, extraKnownMarketplaces, enabledPlugins, hooks
if [ -f "$SETTINGS" ]; then
  TMPSCRIPT=$(mktemp /tmp/omc-uninstall-XXXXXX.cjs)
  cat > "$TMPSCRIPT" << 'JSEOF'
const fs = require('fs');
const filePath = process.argv[2];
let cfg;
try { cfg = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { process.exit(0); }

let changed = false;

if (cfg.statusLine) {
  const cmd = typeof cfg.statusLine === 'string' ? cfg.statusLine : (cfg.statusLine.command || '');
  if (cmd.includes('omc-hud') || cmd.includes('oh-my-caveman') || cmd.includes('caveman')) {
    delete cfg.statusLine;
    changed = true;
    console.log('  Removed statusLine from settings.json');
  }
}

if (cfg.extraKnownMarketplaces && cfg.extraKnownMarketplaces['oh-my-caveman']) {
  delete cfg.extraKnownMarketplaces['oh-my-caveman'];
  if (Object.keys(cfg.extraKnownMarketplaces).length === 0) delete cfg.extraKnownMarketplaces;
  changed = true;
  console.log('  Removed oh-my-caveman from extraKnownMarketplaces');
}

if (cfg.enabledPlugins) {
  for (const key of Object.keys(cfg.enabledPlugins)) {
    if (key.includes('oh-my-caveman')) { delete cfg.enabledPlugins[key]; changed = true; }
  }
  if (Object.keys(cfg.enabledPlugins).length === 0) delete cfg.enabledPlugins;
  if (changed) console.log('  Removed oh-my-caveman from enabledPlugins');
}

for (const event of ['SessionStart', 'UserPromptSubmit', 'Stop', 'PreToolUse', 'PostToolUse']) {
  if (!cfg.hooks || !cfg.hooks[event]) continue;
  const before = cfg.hooks[event].length;
  cfg.hooks[event] = cfg.hooks[event].filter(h => {
    const cmd = typeof h === 'string' ? h : (h.command || (h.hooks || []).map(x => x.command || '').join(' ') || '');
    return !cmd.includes('oh-my-caveman') && !cmd.includes('omc-hud') && !cmd.includes('caveman');
  });
  if (cfg.hooks[event].length !== before) changed = true;
  if (cfg.hooks[event].length === 0) delete cfg.hooks[event];
}
if (cfg.hooks && Object.keys(cfg.hooks).length === 0) delete cfg.hooks;

if (changed) {
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n');
} else {
  console.log('  settings.json already clean');
}
JSEOF
  node "$TMPSCRIPT" "$SETTINGS"
  rm -f "$TMPSCRIPT"
fi

# 7. installed_plugins.json: remove oh-my-caveman entry
if [ -f "$INSTALLED_PLUGINS" ]; then
  TMPSCRIPT=$(mktemp /tmp/omc-uninstall-XXXXXX.cjs)
  cat > "$TMPSCRIPT" << 'JSEOF'
const fs = require('fs');
const filePath = process.argv[2];
let data;
try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { process.exit(0); }

let changed = false;
if (data.plugins) {
  for (const key of Object.keys(data.plugins)) {
    if (key.includes('oh-my-caveman')) { delete data.plugins[key]; changed = true; }
  }
}
if (changed) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log('  Removed oh-my-caveman from installed_plugins.json');
}
JSEOF
  node "$TMPSCRIPT" "$INSTALLED_PLUGINS"
  rm -f "$TMPSCRIPT"
fi

# 8. Remove global CLI if installed via npm link
if command -v npm &>/dev/null; then
  npm unlink -g oh-my-caveman 2>/dev/null && echo "  Removed global CLI (omc / oh-my-caveman)" || true
fi

echo ""
echo "oh-my-caveman uninstalled. All traces removed."
