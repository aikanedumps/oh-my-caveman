# oh-my-caveman

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Multi-agent orchestration for Claude Code. Caveman mode ON by default. Fewer tokens.

---

## What it is

**OMCave** = multi-agent orchestration + caveman communication mode.

- 40+ skills: autopilot, ralph, team, ultrawork, plan, ralplan, ultraqa, trace, and more
- 19 specialist agents: architect, executor, critic, debugger, and more
- Caveman mode on every session — drops articles/filler, terse fragments, ~75% token savings
- Disable caveman: say "stop caveman" or "normal mode"

---

## Install

### Claude Code plugin (recommended)

```
/plugin marketplace add https://github.com/aikanedumps/oh-my-caveman
/plugin install oh-my-caveman
```

After install: open any Claude Code session. Caveman mode activates automatically.

---

## What you get

After install, every Claude Code session starts with:

```
CAVEMAN MODE ACTIVE — level: full
```

All OMCave skills available via `/oh-my-caveman:<skill>`:

| Skill | What it does |
|-------|-------------|
| `/oh-my-caveman:ralph` | Loop until task done + verified |
| `/oh-my-caveman:autopilot` | Full autonomous from idea to code |
| `/oh-my-caveman:team` | Parallel agent team execution |
| `/oh-my-caveman:ultrawork` | Parallel task engine |
| `/oh-my-caveman:plan` | Strategic planning with interview |
| `/oh-my-caveman:ralplan` | Consensus planning loop |
| `/oh-my-caveman:ultraqa` | QA cycling — test, fix, repeat |
| `/oh-my-caveman:deepinit` | Deep codebase initialization |
| `/oh-my-caveman:trace` | Evidence-driven causal tracing |
| `/oh-my-caveman:caveman` | Manage caveman mode levels |

Keyword shortcuts: "ralph" → ralph, "autopilot" → autopilot, "ralplan" → ralplan.

---

## Caveman mode

Always-on communication compression.

```
full mode (default): Drop articles, fragments OK, no fluff.
lite mode: Light compression.
ultra mode: Maximum compression.
```

Switch levels: `/caveman lite` | `/caveman full` | `/caveman ultra`

Disable: say **"stop caveman"** or **"normal mode"**

Re-enable: say **"caveman mode"**

---

## Agents

19 specialist agents, invoked via `oh-my-caveman:<name>`:

`explore`, `analyst`, `planner`, `architect`, `debugger`, `executor`, `verifier`, `tracer`, `security-reviewer`, `code-reviewer`, `test-engineer`, `designer`, `writer`, `qa-tester`, `scientist`, `document-specialist`, `git-master`, `code-simplifier`, `critic`

Model routing: haiku (quick), sonnet (standard), opus (deep analysis).

---

## CLI

```bash
omc <command>
# or
oh-my-caveman <command>
```

---

## Uninstall

```bash
bash oh-my-caveman/uninstall.sh
```

Removes: hooks from `~/.claude/settings.json`, flag files. Idempotent.

Or via Claude Code:

```bash
claude plugin uninstall oh-my-caveman
```

---

## License

MIT
