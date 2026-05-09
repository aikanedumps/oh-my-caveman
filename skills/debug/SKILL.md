---
name: debug
description: Diagnose the current OMC session or repo state using logs, traces, state, and focused reproduction
---

# Debug

Diagnose current OMC/Claude-Code session problem, workflow breakage, or confusing runtime behavior.

## Goal
Find real failure signal fast. Explain next corrective step.

## Workflow
1. Read user's issue description.
2. Inspect most relevant local evidence first:
   - trace tools
   - state tools
   - notepad / project memory when relevant
   - failing tests or commands
3. Reproduce issue narrowly if possible.
4. Distinguish symptoms from root cause.
5. Recommend smallest next fix or verification step.

## Rules
- Prefer real evidence over guesses.
- Use trace/state surfaces when issue involves orchestration, hooks, or agent flow.
- Issue is product/runtime bug rather than app code → say so plainly.
- Do not prescribe broad rewrites before isolating failure.

## Output
- Observed failure
- Root-cause hypothesis
- Evidence for that hypothesis
- Smallest next action
