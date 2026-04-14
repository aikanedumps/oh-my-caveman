---
name: omc-plan
description: Strategic planning with optional interview workflow
argument-hint: "[--direct|--consensus|--review] [--interactive] [--deliberate] <task description>"
pipeline: [deep-interview, omc-plan, autopilot]
next-skill: autopilot
handoff: .omc/plans/ralplan-*.md
level: 4
---

<Purpose>
Creates actionable work plans. Auto-detects: interview mode (broad requests) or direct mode (detailed requests). Supports consensus mode (RALPLAN-DR loop: Planner/Architect/Critic) and review mode (Critic eval of existing plans).
</Purpose>

<Use_When>
- User wants to plan before implementing -- "plan this", "plan the", "let's plan"
- User wants structured requirements gathering for vague idea
- User wants existing plan reviewed -- "review this plan", `--review`
- User wants multi-perspective consensus on plan -- `--consensus`, "ralplan"
- Task is broad or vague, needs scoping before code is written
</Use_When>

<Do_Not_Use_When>
- User wants autonomous end-to-end execution -- use `autopilot` instead
- User wants to start coding immediately with clear task -- use `ralph` or delegate to executor
- User asks simple question answerable directly -- just answer it
- Task is single focused fix with obvious scope -- skip planning, just do it
</Do_Not_Use_When>

<Why_This_Exists>
No planning → rework, scope creep, missed edge cases. Plan: structured requirements, expert analysis, quality-gated output. Consensus mode: multi-perspective validation for high-stakes work.
</Why_This_Exists>

<Execution_Policy>
- Auto-detect interview vs direct mode based on request specificity
- Ask one question at a time during interviews -- never batch multiple questions
- Gather codebase facts via `explore` agent before asking user about them
- Plans must meet quality standards: 80%+ claims cite file/line, 90%+ criteria are testable
- Consensus mode runs fully automated by default; add `--interactive` to enable user prompts at draft review and final approval steps
- Consensus mode uses RALPLAN-DR short mode by default; switch to deliberate mode with `--deliberate` or when request explicitly signals high risk (auth/security, data migration, destructive/irreversible changes, production incident, compliance/PII, public API breakage)
</Execution_Policy>

<Steps>

### Mode Selection

| Mode | Trigger | Behavior |
|------|---------|----------|
| Interview | Default for broad requests | Interactive requirements gathering |
| Direct | `--direct`, or detailed request | Skip interview, generate plan directly |
| Consensus | `--consensus`, "ralplan" | Planner -> Architect -> Critic loop until agreement with RALPLAN-DR structured deliberation (short by default, `--deliberate` for high-risk); add `--interactive` for user prompts at draft and approval steps |
| Review | `--review`, "review this plan" | Critic evaluation of existing plan |

### Interview Mode (broad/vague requests)

1. **Classify request**: Broad (vague verbs, no specific files, touches 3+ areas) triggers interview mode
2. **Ask one focused question** using `AskUserQuestion` for preferences, scope, constraints
3. **Gather codebase facts first**: Before asking "what patterns does your code use?", spawn `explore` agent to find out, then ask informed follow-up questions
4. **Build on answers**: Each question builds on previous answer
5. **Consult Analyst** (Opus) for hidden requirements, edge cases, risks
6. **Create plan** when user signals readiness: "create the plan", "I'm ready", "make it a work plan"

### Direct Mode (detailed requests)

1. **Quick Analysis**: Optional brief Analyst consultation
2. **Create plan**: Generate comprehensive work plan immediately
3. **Review** (optional): Critic review if requested

### Consensus Mode (`--consensus` / "ralplan")

**RALPLAN-DR modes**: **Short** (default, bounded structure) and **Deliberate** (for `--deliberate` or explicit high-risk requests). Both modes keep same Planner -> Architect -> Critic sequence and same `AskUserQuestion` gates.

**Provider overrides (supported when provider CLI is installed):**
- `--architect codex` — replace Claude Architect pass with `omc ask codex --agent-prompt architect "..."` for implementation-heavy architecture review
- `--critic codex` — replace Claude Critic pass with `omc ask codex --agent-prompt critic "..."` for external review pass before execution
- If requested provider unavailable, briefly note that and continue with default Claude Architect/Critic step for that stage

**State lifecycle**: Persistent-mode stop hook uses `ralplan-state.json` to enforce continuation during consensus loop. Skill **MUST** manage this state:
- **On entry**: Call `state_write(mode="ralplan", active=true, session_id=<current_session_id>)` before step 1
- **On handoff to execution** (approval → ralph/team): Call `state_write(mode="ralplan", active=false, session_id=<current_session_id>)`. Do NOT use `state_clear` here -- `state_clear` writes 30-second cancel signal that disables stop-hook enforcement for ALL modes, leaving newly launched execution mode unprotected.
- **On true terminal exit** (rejection, non-interactive plan output, error/abort): Call `state_clear(mode="ralplan", session_id=<current_session_id>)` -- no execution mode follows, cancel signal window is harmless.
- Do NOT clear during intermediate steps like Critic approval or max-iteration presentation, as user may still select "Request changes".

Without cleanup, stop hook blocks all subsequent stops with `[RALPLAN - CONSENSUS PLANNING]` reinforcement messages even after consensus workflow has finished. Always pass `session_id` to avoid clearing other concurrent sessions' state.

1. **Planner** creates initial plan and compact **RALPLAN-DR summary** before any Architect review. Summary **MUST** include:
   - **Principles** (3-5)
   - **Decision Drivers** (top 3)
   - **Viable Options** (>=2) with bounded pros/cons for each option
   - If only one viable option remains, explicit **invalidation rationale** for alternatives that were rejected
   - In **deliberate mode**: **pre-mortem** (3 failure scenarios) and **expanded test plan** covering **unit / integration / e2e / observability**
2. **User feedback** *(--interactive only)*: If running with `--interactive`, **MUST** use `AskUserQuestion` to present draft plan **plus RALPLAN-DR Principles / Decision Drivers / Options summary for early direction alignment** with options:
   - **Proceed to review** — send to Architect and Critic for evaluation
   - **Request changes** — return to step 1 with user feedback incorporated
   - **Skip review** — go directly to final approval (step 7)
   If NOT running with `--interactive`, automatically proceed to review (step 3).
3. **Architect** reviews for architectural soundness using `Task(subagent_type="oh-my-caveman:architect", ...)`. Architect review **MUST** include: strongest steelman counterargument (antithesis) against favored option, at least one meaningful tradeoff tension, and (when possible) synthesis path. In deliberate mode, Architect should explicitly flag principle violations. **Wait for this step to complete before proceeding to step 4.** Do NOT run steps 3 and 4 in parallel.
4. **Critic** evaluates against quality criteria using `Task(subagent_type="oh-my-caveman:critic", ...)`. Critic **MUST** verify principle-option consistency, fair alternative exploration, risk mitigation clarity, testable acceptance criteria, concrete verification steps. Critic **MUST** explicitly reject shallow alternatives, driver contradictions, vague risks, or weak verification. In deliberate mode, Critic **MUST** reject missing/weak pre-mortem or missing/weak expanded test plan. Run only after step 3 complete.
5. **Re-review loop** (max 5 iterations): If Critic rejects, execute closed loop:
   a. Collect all rejection feedback from Architect + Critic
   b. Pass feedback to Planner to produce revised plan
   c. **Return to Step 3** -- Architect reviews revised plan
   d. **Return to Step 4** -- Critic evaluates revised plan
   e. Repeat until Critic approves OR max 5 iterations reached
   f. If max iterations reached without approval, present best version to user via `AskUserQuestion` with note that expert consensus was not reached
6. **Apply improvements**: When reviewers approve with improvement suggestions, merge all accepted improvements into plan file before proceeding. Final consensus output **MUST** include **ADR** section with: **Decision**, **Drivers**, **Alternatives considered**, **Why chosen**, **Consequences**, **Follow-ups**. Specifically:
   a. Collect all improvement suggestions from Architect and Critic responses
   b. Deduplicate and categorize suggestions
   c. Update plan file in `.omc/plans/` with accepted improvements (add missing details, refine steps, strengthen acceptance criteria, ADR updates, etc.)
   d. Note which improvements applied in brief changelog section at end of plan
7. On Critic approval (with improvements applied): *(--interactive only)* If running with `--interactive`, use `AskUserQuestion` to present plan with options:
   - **Approve and implement via team** (Recommended) — proceed to implementation via coordinated parallel team agents (`/team`). Team is canonical orchestration surface since v4.1.7.
   - **Approve and execute via ralph** — proceed to implementation via ralph+ultrawork (sequential execution with verification)
   - **Clear context and implement** — compact context window first (recommended when context large after planning), then start fresh implementation via ralph with saved plan file
   - **Request changes** — return to step 1 with user feedback
   - **Reject** — discard plan entirely
   If NOT running with `--interactive`, output final approved plan, call `state_clear(mode="ralplan", session_id=<current_session_id>)`, and stop. Do NOT auto-execute.
8. *(--interactive only)* User chooses via structured `AskUserQuestion` UI (never ask for approval in plain text). If user selects **Reject**, call `state_clear(mode="ralplan", session_id=<current_session_id>)` and stop.
9. On user approval (--interactive only): Call `state_write(mode="ralplan", active=false, session_id=<current_session_id>)` **before** invoking execution skill (ralph/team), so stop hook does not interfere with execution mode's own enforcement. Do NOT use `state_clear` here -- it writes cancel signal that disables enforcement for newly launched mode.
   - **Approve and implement via team**: **MUST** invoke `Skill("oh-my-caveman:team")` with approved plan path from `.omc/plans/` as context. Do NOT implement directly. Team skill coordinates parallel agents across staged pipeline for faster execution on large tasks. Recommended default execution path.
   - **Approve and execute via ralph**: **MUST** invoke `Skill("oh-my-caveman:ralph")` with approved plan path from `.omc/plans/` as context. Do NOT implement directly. Do NOT edit source code files in planning agent. Ralph skill handles execution via ultrawork parallel agents.
   - **Clear context and implement**: First invoke `Skill("compact")` to compress context window (reduces token usage accumulated during planning), then invoke `Skill("oh-my-caveman:ralph")` with approved plan path from `.omc/plans/`. Recommended when context window 50%+ full after planning session.

### Review Mode (`--review`)

1. Read plan file from `.omc/plans/`
2. Evaluate via Critic using `Task(subagent_type="oh-my-caveman:critic", ...)`
3. Return verdict: APPROVED, REVISE (with specific feedback), or REJECT (replanning required)

### Plan Output Format

Every plan includes:
- Requirements Summary
- Acceptance Criteria (testable)
- Implementation Steps (with file references)
- Risks and Mitigations
- Verification Steps
- For consensus/ralplan: **RALPLAN-DR summary** (Principles, Decision Drivers, Options)
- For consensus/ralplan final output: **ADR** (Decision, Drivers, Alternatives considered, Why chosen, Consequences, Follow-ups)
- For deliberate consensus mode: **Pre-mortem (3 scenarios)** and **Expanded Test Plan** (unit/integration/e2e/observability)

Plans saved to `.omc/plans/`. Drafts go to `.omc/drafts/`.
</Steps>

<Tool_Usage>
- Use `AskUserQuestion` for preference questions (scope, priority, timeline, risk tolerance) -- provides clickable UI
- Use plain text for questions needing specific values (port numbers, names, follow-up clarifications)
- Use `explore` agent (Haiku, 30s timeout) to gather codebase facts before asking user
- Use `Task(subagent_type="oh-my-caveman:planner", ...)` for planning validation on large-scope plans
- Use `Task(subagent_type="oh-my-caveman:analyst", ...)` for requirements analysis
- Use `Task(subagent_type="oh-my-caveman:critic", ...)` for plan review in consensus and review modes
- **CRITICAL -- Consensus mode agent calls MUST be sequential, never parallel.** Always await Architect Task result before issuing Critic Task.
- In consensus mode, default to RALPLAN-DR short mode; enable deliberate mode on `--deliberate` or explicit high-risk signals (auth/security, migrations, destructive changes, production incidents, compliance/PII, public API breakage)
- In consensus mode with `--interactive`: use `AskUserQuestion` for user feedback step (step 2) and final approval step (step 7) -- never ask for approval in plain text. Without `--interactive`, skip both prompts and output final plan.
- In consensus mode with `--interactive`, on user approval **MUST** invoke `Skill("oh-my-caveman:ralph")` for execution (step 9) -- never implement directly in planning agent
- When user selects "Clear context and implement" in step 7 (--interactive only): call `state_write(mode="ralplan", active=false, session_id=<current_session_id>)` first, then invoke `Skill("compact")` to compress accumulated planning context, then immediately invoke `Skill("oh-my-caveman:ralph")` with plan path -- compact step critical to free up context before implementation loop begins
- **CRITICAL -- Consensus mode state lifecycle**: Always deactivate ralplan state before stopping or handing off to execution. Use `state_write(active=false)` for handoff paths (approval → ralph/team) and `state_clear` for true terminal exits (rejection, error). Never use `state_clear` before launching execution mode -- cancel signal disables stop-hook enforcement for 30 seconds.
</Tool_Usage>

<Examples>
<Good>
Adaptive interview (gathering facts before asking):
```
Planner: [spawns explore agent: "find authentication implementation"]
Planner: [receives: "Auth is in src/auth/ using JWT with passport.js"]
Planner: "I see you're using JWT authentication with passport.js in src/auth/.
         For this new feature, should we extend the existing auth or add a separate auth flow?"
```
Answered own codebase question first, then asked informed preference question.
</Good>

<Good>
Single question at a time:
```
Q1: "What's the main goal?"
A1: "Improve performance"
Q2: "For performance, what matters more -- latency or throughput?"
A2: "Latency"
Q3: "For latency, are we optimizing for p50 or p99?"
```
Each question builds on previous answer. Focused and progressive.
</Good>

<Bad>
Asking about things you could look up:
```
Planner: "Where is authentication implemented in your codebase?"
User: "Uh, somewhere in src/auth I think?"
```
Planner should spawn explore agent to find this, not ask user.
</Bad>

<Bad>
Batching multiple questions:
```
"What's the scope? And the timeline? And who's the audience?"
```
Three questions at once causes shallow answers. Ask one at a time.
</Bad>

<Bad>
Presenting all design options at once:
```
"Here are 4 approaches: Option A... Option B... Option C... Option D... Which do you prefer?"
```
Decision fatigue. Present one option with trade-offs, get reaction, then present next.
</Bad>
</Examples>

<Escalation_And_Stop_Conditions>
- Stop interviewing when requirements are clear enough to plan -- do not over-interview
- In consensus mode, stop after 5 Planner/Architect/Critic iterations and present best version. Do NOT clear ralplan state here -- user may still select "Request changes" in subsequent step. State cleared only on user's final choice (approval/rejection) or when outputting plan in non-interactive mode.
- Consensus mode without `--interactive` outputs final plan and stops; with `--interactive`, requires explicit user approval before any implementation begins. **Always** call `state_clear(mode="ralplan", session_id=<current_session_id>)` before stopping.
- If user says "just do it" or "skip planning", call `state_write(mode="ralplan", active=false, session_id=<current_session_id>)` then **MUST** invoke `Skill("oh-my-caveman:ralph")` to transition to execution mode. Do NOT implement directly in planning agent.
- Escalate to user when irreconcilable trade-offs require business decision
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] Plan has testable acceptance criteria (90%+ concrete)
- [ ] Plan references specific files/lines where applicable (80%+ claims)
- [ ] All risks have mitigations identified
- [ ] No vague terms without metrics ("fast" -> "p99 < 200ms")
- [ ] Plan saved to `.omc/plans/`
- [ ] In consensus mode: RALPLAN-DR summary includes 3-5 principles, top 3 drivers, >=2 viable options (or explicit invalidation rationale)
- [ ] In consensus mode final output: ADR section included (Decision / Drivers / Alternatives considered / Why chosen / Consequences / Follow-ups)
- [ ] In deliberate consensus mode: pre-mortem (3 scenarios) + expanded test plan (unit/integration/e2e/observability) included
- [ ] In consensus mode with `--interactive`: user explicitly approved before any execution; without `--interactive`: plan output only, no auto-execution
- [ ] In consensus mode: ralplan state deactivated on every exit path -- `state_write(active=false)` for handoff to execution, `state_clear` for terminal exits (rejection, error, non-interactive stop)
</Final_Checklist>

<Advanced>
## Design Option Presentation

When presenting design choices during interviews, chunk them:

1. **Overview** (2-3 sentences)
2. **Option A** with trade-offs
3. [Wait for user reaction]
4. **Option B** with trade-offs
5. [Wait for user reaction]
6. **Recommendation** (only after options discussed)

Format for each option:
```
### Option A: [Name]
**Approach:** [1 sentence]
**Pros:** [bullets]
**Cons:** [bullets]

What's your reaction to this approach?
```

## Question Classification

Before asking any interview question, classify it:

| Type | Examples | Action |
|------|----------|--------|
| Codebase Fact | "What patterns exist?", "Where is X?" | Explore first, do not ask user |
| User Preference | "Priority?", "Timeline?" | Ask user via AskUserQuestion |
| Scope Decision | "Include feature Y?" | Ask user |
| Requirement | "Performance constraints?" | Ask user |

## Review Quality Criteria

| Criterion | Standard |
|-----------|----------|
| Clarity | 80%+ claims cite file/line |
| Testability | 90%+ criteria are concrete |
| Verification | All file refs exist |
| Specificity | No vague terms |

## Deprecation Notice

Separate `/planner`, `/ralplan`, `/review` skills merged into `/plan`. All workflows (interview, direct, consensus, review) available through `/plan`.
</Advanced>
