/**
 * OMC HUD - Caveman Mode Element
 *
 * Reads the caveman activation flag at ~/.claude/.caveman-active
 * (written by scripts/caveman-activate.cjs on SessionStart and updated
 * by scripts/caveman-mode-tracker.cjs on /caveman commands) and renders
 * a [CAVEMAN] / [CAVEMAN:LEVEL] badge.
 *
 * Returns null when no flag exists — i.e. caveman mode is off — so the
 * badge takes zero columns.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { bold, yellow } from '../colors.js';
const VALID_MODES = new Set([
    'lite', 'full', 'ultra',
    'wenyan-lite', 'wenyan', 'wenyan-full', 'wenyan-ultra',
    'commit', 'review', 'compress',
]);
/**
 * Render the caveman mode badge from the flag file.
 *
 * Format:
 *   [CAVEMAN:FULL]     when mode === 'full' (the default)
 *   [CAVEMAN:ULTRA]    for any other valid mode (uppercased)
 *   null               when the flag file is missing/empty/invalid
 */
export function renderCaveman() {
    let raw;
    try {
        raw = readFileSync(join(homedir(), '.claude', '.caveman-active'), 'utf8').trim();
    }
    catch {
        return null;
    }
    if (!raw || !VALID_MODES.has(raw))
        return null;
    return bold(yellow(`[CAVEMAN:${raw.toUpperCase()}]`));
}
//# sourceMappingURL=caveman.js.map