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
/**
 * Render the caveman mode badge from the flag file.
 *
 * Format:
 *   [CAVEMAN:FULL]     when mode === 'full' (the default)
 *   [CAVEMAN:ULTRA]    for any other valid mode (uppercased)
 *   null               when the flag file is missing/empty/invalid
 */
export declare function renderCaveman(): string | null;
//# sourceMappingURL=caveman.d.ts.map