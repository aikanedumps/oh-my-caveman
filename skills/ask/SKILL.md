---
name: ask
description: Process-first advisor routing for Claude, Codex, or Gemini via `omc ask`, with artifact capture and no raw CLI assembly
---

# Ask

Route prompt through local Claude, Codex, or Gemini CLI and persist result as ask artifact.

## Usage

```bash
/oh-my-caveman:ask <claude|codex|gemini> <question or task>
```

Examples:

```bash
/oh-my-caveman:ask codex "review this patch from a security perspective"
/oh-my-caveman:ask gemini "suggest UX improvements for this flow"
/oh-my-caveman:ask claude "draft an implementation plan for issue #123"
```

## Routing

**Required execution path — always use this command:**

```bash
omc ask {{ARGUMENTS}}
```

**Do NOT manually construct raw provider CLI commands.** Never run `codex`, `claude`, or `gemini` directly to fulfill this skill. `omc ask` wrapper handles correct flag selection, artifact persistence, and provider-version compatibility automatically. Manually assembling provider CLI flags produces incorrect or outdated invocations.

## Requirements

- Selected local CLI must be installed and authenticated.
- Verify availability:

```bash
claude --version
codex --version
gemini --version
```

## Artifacts

`omc ask` writes artifacts to:

```text
.omc/artifacts/ask/<provider>-<slug>-<timestamp>.md
```

Task: {{ARGUMENTS}}
