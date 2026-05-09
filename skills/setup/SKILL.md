---
name: setup
description: Use first for install/update routing — sends setup, doctor, or MCP requests to the correct OMC setup flow
level: 2
---

# Setup

Use `/oh-my-caveman:setup` as unified setup/configuration entrypoint.

## Usage

```bash
/oh-my-caveman:setup                # full setup wizard
/oh-my-caveman:setup doctor         # installation diagnostics
/oh-my-caveman:setup mcp            # MCP server configuration
/oh-my-caveman:setup wizard --local # explicit wizard path
```

## Routing

Process request by **first argument only** so install/setup questions land on right flow immediately:

- No argument, `wizard`, `local`, `global`, or `--force` -> route to `/oh-my-caveman:omc-setup` with same remaining args
- `doctor` -> route to `/oh-my-caveman:omc-doctor` with everything after `doctor` token
- `mcp` -> route to `/oh-my-caveman:mcp-setup` with everything after `mcp` token

Examples:

```bash
/oh-my-caveman:setup --local          # => /oh-my-caveman:omc-setup --local
/oh-my-caveman:setup doctor --json    # => /oh-my-caveman:omc-doctor --json
/oh-my-caveman:setup mcp github       # => /oh-my-caveman:mcp-setup github
```

## Notes

- `/oh-my-caveman:omc-setup`, `/oh-my-caveman:omc-doctor`, `/oh-my-caveman:mcp-setup` remain valid compatibility entrypoints.
- Prefer `/oh-my-caveman:setup` in new docs and user guidance.

Task: {{ARGUMENTS}}
