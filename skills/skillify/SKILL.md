---
name: skillify
description: Turn a repeatable workflow from the current session into a reusable OMC skill draft
---

# Skillify

Use when current session uncovered repeatable workflow that should become reusable OMC skill.

## Goal
Capture successful multi-step workflow as concrete skill draft instead of rediscovering it later.

## Workflow
1. Identify repeatable task session accomplished.
2. Extract:
   - inputs
   - ordered steps
   - success criteria
   - constraints / pitfalls
   - best target location for skill
3. Decide whether workflow belongs as:
   - repo built-in skill
   - user/project learned skill
   - documentation only
4. When drafting learned skill file, output complete skill file starting with YAML frontmatter.
   - Never emit plain markdown-only skill files.
   - Minimum frontmatter:
     ```yaml
     ---
     name: <skill-name>
     description: <one-line description>
     triggers:
       - <trigger-1>
       - <trigger-2>
     ---
     ```
   - Write learned/user/project skills to:
     - `${CLAUDE_CONFIG_DIR:-~/.claude}/skills/omc-learned/<skill-name>.md`
     - `.omc/skills/<skill-name>.md`
5. Draft rest of skill file with clear triggers, steps, and success criteria.
6. Point out anything still too fuzzy to encode safely.

## Rules
- Only capture workflows that are actually repeatable.
- Keep skill practical and scoped.
- Prefer explicit success criteria over vague prose.
- If workflow has unresolved branching decisions, note them before drafting.

## Output
- Proposed skill name
- Target location
- Draft workflow structure
- Open questions, if any
