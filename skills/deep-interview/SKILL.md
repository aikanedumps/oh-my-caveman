---
name: deep-interview
description: Socratic deep interview with mathematical ambiguity gating before autonomous execution
argument-hint: "[--quick|--standard|--deep] [--autoresearch] <idea or vague description>"
pipeline: [deep-interview, omc-plan, autopilot]
next-skill: omc-plan
next-skill-args: --consensus --direct
handoff: .omc/specs/deep-interview-{slug}.md
level: 3
---

<Purpose>
Deep Interview implements Ouroboros-inspired Socratic questioning with mathematical ambiguity scoring. Replaces vague ideas with crystal-clear specifications by asking targeted questions that expose hidden assumptions, measuring clarity across weighted dimensions, and refusing to proceed until ambiguity drops below configurable threshold (default: 20%). Output feeds into 3-stage pipeline: **deep-interview → ralplan (consensus refinement) → autopilot (execution)**, ensuring maximum clarity at every stage.
</Purpose>

<Use_When>
- User has vague idea, wants thorough requirements gathering before execution
- User says "deep interview", "interview me", "ask me everything", "don't assume", "make sure you understand"
- User says "ouroboros", "socratic", "I have a vague idea", "not sure exactly what I want"
- User wants to avoid "that's not what I meant" outcomes from autonomous execution
- Task complex enough that jumping to code wastes cycles on scope discovery
- User wants mathematically-validated clarity before committing to execution
</Use_When>

<Do_Not_Use_When>
- User has detailed, specific request with file paths, function names, or acceptance criteria — execute directly
- User wants to explore options or brainstorm — use `omc-plan` skill instead
- User wants quick fix or single change — delegate to executor or ralph
- User says "just do it" or "skip the questions" — respect intent
- User already has PRD or plan file — use ralph or autopilot with that plan
</Do_Not_Use_When>

<Why_This_Exists>
AI can build anything. Hard part is knowing what to build. OMC's autopilot Phase 0 expands ideas into specs via analyst + architect, but single-pass approach struggles with genuinely vague inputs. Asks "what do you want?" instead of "what are you assuming?" Deep Interview applies Socratic methodology to iteratively expose assumptions and mathematically gate readiness, ensuring genuine clarity before spending execution cycles.

Inspired by the [Ouroboros project](https://github.com/Q00/ouroboros) which demonstrated specification quality is primary bottleneck in AI-assisted development.
</Why_This_Exists>

<Execution_Policy>
- Ask ONE question at a time — never batch multiple questions
- Target WEAKEST clarity dimension with each question
- Make weakest-dimension targeting explicit every round: name weakest dimension, state score/gap, explain why next question aims there
- Gather codebase facts via `explore` agent BEFORE asking user about them
- For brownfield confirmation questions, cite repo evidence that triggered question (file path, symbol, or pattern) instead of asking user to rediscover it
- Score ambiguity after every answer — display score transparently
- Do not proceed to execution until ambiguity ≤ threshold (default 0.2)
- Allow early exit with clear warning if ambiguity still high
- Persist interview state for resume across session interruptions
- Challenge agents activate at specific round thresholds to shift perspective
</Execution_Policy>

<Autoresearch_Mode>
When arguments include `--autoresearch`, Deep Interview becomes zero-learning-curve setup lane for `omc autoresearch`.

- No usable mission brief yet → start by asking: **"What should autoresearch improve or prove for this repo?"**
- After mission clear, collect evaluator command. User leaves blank → infer only when repo evidence strong; otherwise keep interviewing until evaluator explicit enough to launch safely.
- Keep usual one-question-per-round rule, but treat **mission clarity** and **evaluator clarity** as hard readiness gates in addition to normal ambiguity threshold.
- Once ready, do **not** bridge into `omc-plan`, `autopilot`, `ralph`, or `team`. Instead run:
  - `omc autoresearch --mission "<mission>" --eval "<evaluator>" [--keep-policy <policy>] [--slug <slug>]`
- Direct handoff expected to detach into real autoresearch runtime tmux session. After successful handoff, announce launched session and end interview lane.
</Autoresearch_Mode>

<Steps>

## Phase 1: Initialize

1. **Parse user's idea** from `{{ARGUMENTS}}`
2. **Detect brownfield vs greenfield**:
   - Run `explore` agent (haiku): check if cwd has existing source code, package files, or git history
   - Source files exist AND user's idea references modifying/extending something: **brownfield**
   - Otherwise: **greenfield**
3. **For brownfield**: Run `explore` agent to map relevant codebase areas, store as `codebase_context`
4. **Initialize state** via `state_write(mode="deep-interview")`:

```json
{
  "active": true,
  "current_phase": "deep-interview",
  "state": {
    "interview_id": "<uuid>",
    "type": "greenfield|brownfield",
    "initial_idea": "<user input>",
    "rounds": [],
    "current_ambiguity": 1.0,
    "threshold": 0.2,
    "codebase_context": null,
    "challenge_modes_used": [],
    "ontology_snapshots": []
  }
}
```

5. **Announce interview** to user:

> Starting deep interview. Targeted questions to understand idea thoroughly before building anything. After each answer, clarity score shown. Proceed to execution once ambiguity drops below 20%.
>
> **Your idea:** "{initial_idea}"
> **Project type:** {greenfield|brownfield}
> **Current ambiguity:** 100% (not started yet)

## Phase 2: Interview Loop

Repeat until `ambiguity ≤ threshold` OR user exits early:

### Step 2a: Generate Next Question

Build question generation prompt with:
- User's original idea
- All prior Q&A rounds (conversation history)
- Current clarity scores per dimension (which is weakest?)
- Challenge agent mode (if activated — see Phase 3)
- Brownfield codebase context (if applicable)

**Question targeting strategy:**
- Identify dimension with LOWEST clarity score
- Generate question that specifically improves that dimension
- State, in one sentence before question, why this dimension is now bottleneck to reducing ambiguity
- Questions should expose ASSUMPTIONS, not gather feature lists
- Scope still conceptually fuzzy (entities keep shifting, user naming symptoms, core noun unstable) → switch to ontology-style question asking what thing fundamentally IS before returning to feature/detail questions

**Question styles by dimension:**
| Dimension | Question Style | Example |
|-----------|---------------|---------|
| Goal Clarity | "What exactly happens when...?" | "When you say 'manage tasks', what specific action does user take first?" |
| Constraint Clarity | "What are the boundaries?" | "Should this work offline, or is internet connectivity assumed?" |
| Success Criteria | "How do we know it works?" | "If I showed you finished product, what would make you say 'yes, that's it'?" |
| Context Clarity (brownfield) | "How does this fit?" | "I found JWT auth middleware in `src/auth/` (pattern: passport + JWT). Should this feature extend that path or intentionally diverge?" |
| Scope-fuzzy / ontology stress | "What IS the core thing here?" | "You have named Tasks, Projects, and Workspaces across last rounds. Which one is core entity, and which are supporting views or containers?" |

### Step 2b: Ask the Question

Use `AskUserQuestion` with generated question. Present clearly with current ambiguity context:

```
Round {n} | Targeting: {weakest_dimension} | Why now: {one_sentence_targeting_rationale} | Ambiguity: {score}%

{question}
```

Options should include contextually relevant choices plus free-text.

### Step 2c: Score Ambiguity

After receiving user's answer, score clarity across all dimensions.

**Scoring prompt** (use opus model, temperature 0.1 for consistency):

```
Given the following interview transcript for a {greenfield|brownfield} project, score clarity on each dimension from 0.0 to 1.0:

Original idea: {idea}

Transcript:
{all rounds Q&A}

Score each dimension:
1. Goal Clarity (0.0-1.0): Is primary objective unambiguous? Can you state it in one sentence without qualifiers? Can you name key entities (nouns) and their relationships (verbs) without ambiguity?
2. Constraint Clarity (0.0-1.0): Are boundaries, limitations, and non-goals clear?
3. Success Criteria Clarity (0.0-1.0): Could you write test that verifies success? Are acceptance criteria concrete?
{4. Context Clarity (0.0-1.0): [brownfield only] Do we understand existing system well enough to modify safely? Do identified entities map cleanly to existing codebase structures?}

For each dimension provide:
- score: float (0.0-1.0)
- justification: one sentence explaining score
- gap: what's still unclear (if score < 0.9)

Also identify:
- weakest_dimension: single lowest-confidence dimension this round
- weakest_dimension_rationale: one sentence explaining why it is highest-leverage target for next question

5. Ontology Extraction: Identify all key entities (nouns) discussed in transcript.

{If round > 1, inject: "Previous round's entities: {prior_entities_json from state.ontology_snapshots[-1]}. REUSE these entity names where concept is same. Only introduce new names for genuinely new concepts."}

For each entity provide:
- name: string (entity name, e.g., "User", "Order", "PaymentMethod")
- type: string (e.g., "core domain", "supporting", "external system")
- fields: string[] (key attributes mentioned)
- relationships: string[] (e.g., "User has many Orders")

Respond as JSON. Include additional "ontology" key containing entities array alongside dimension scores.
```

**Calculate ambiguity:**

Greenfield: `ambiguity = 1 - (goal × 0.40 + constraints × 0.30 + criteria × 0.30)`
Brownfield: `ambiguity = 1 - (goal × 0.35 + constraints × 0.25 + criteria × 0.25 + context × 0.15)`

**Calculate ontology stability:**

**Round 1 special case:** Skip stability comparison. All entities are "new". Set stability_ratio = N/A. Any round producing zero entities → set stability_ratio = N/A (avoids division by zero).

For rounds 2+, compare with previous round's entity list:
- `stable_entities`: entities present in both rounds with same name
- `changed_entities`: entities with different names but same type AND >50% field overlap (renamed, not new+removed)
- `new_entities`: entities in this round not matched by name or fuzzy-match to any previous entity
- `removed_entities`: entities in previous round not matched to any current entity
- `stability_ratio`: (stable + changed) / total_entities (0.0 to 1.0, where 1.0 = fully converged)

Formula counts renamed entities (changed) toward stability. Renamed entities indicate concept persists even if name shifted — convergence, not instability. Two entities with different names but same `type` and >50% field overlap → classify as "changed" (renamed), not one removed and one added.

**Show your work:** Before reporting stability numbers, briefly list which entities were matched (by name or fuzzy) and which are new/removed. Lets user sanity-check matching.

Store ontology snapshot (entities + stability_ratio + matching_reasoning) in `state.ontology_snapshots[]`.

### Step 2d: Report Progress

After scoring, show user progress:

```
Round {n} complete.

| Dimension | Score | Weight | Weighted | Gap |
|-----------|-------|--------|----------|-----|
| Goal | {s} | {w} | {s*w} | {gap or "Clear"} |
| Constraints | {s} | {w} | {s*w} | {gap or "Clear"} |
| Success Criteria | {s} | {w} | {s*w} | {gap or "Clear"} |
| Context (brownfield) | {s} | {w} | {s*w} | {gap or "Clear"} |
| **Ambiguity** | | | **{score}%** | |

**Ontology:** {entity_count} entities | Stability: {stability_ratio} | New: {new} | Changed: {changed} | Stable: {stable}

**Next target:** {weakest_dimension} — {weakest_dimension_rationale}

{score <= threshold ? "Clarity threshold met! Ready to proceed." : "Focusing next question on: {weakest_dimension}"}
```

### Step 2e: Update State

Update interview state with new round and scores via `state_write`.

### Step 2f: Check Soft Limits

- **Round 3+**: Allow early exit if user says "enough", "let's go", "build it"
- **Round 10**: Show soft warning: "We're at 10 rounds. Current ambiguity: {score}%. Continue or proceed with current clarity?"
- **Round 20**: Hard cap: "Maximum interview rounds reached. Proceeding with current clarity level ({score}%)."

## Phase 3: Challenge Agents

At specific round thresholds, shift questioning perspective:

### Round 4+: Contrarian Mode
Inject into question generation prompt:
> You are now in CONTRARIAN mode. Next question should challenge user's core assumption. Ask "What if opposite were true?" or "What if this constraint doesn't actually exist?" Goal is to test whether user's framing is correct or habitual.

### Round 6+: Simplifier Mode
Inject into question generation prompt:
> You are now in SIMPLIFIER mode. Next question should probe whether complexity can be removed. Ask "What's simplest version that would still be valuable?" or "Which of these constraints are necessary vs. assumed?" Goal is to find minimal viable specification.

### Round 8+: Ontologist Mode (if ambiguity still > 0.3)
Inject into question generation prompt:
> You are now in ONTOLOGIST mode. Ambiguity still high after 8 rounds, suggesting we may be addressing symptoms rather than core problem. Tracked entities so far: {current_entities_summary from latest ontology snapshot}. Ask "What IS this, really?" or "Looking at these entities, which one is CORE concept and which are supporting?" Goal is to find essence by examining ontology.

Challenge modes used ONCE each, then return to normal Socratic questioning. Track which modes used in state.

## Phase 4: Crystallize Spec

When ambiguity ≤ threshold (or hard cap / early exit):

1. **Generate specification** using opus model with full interview transcript
2. **Write to file**: `.omc/specs/deep-interview-{slug}.md`

Spec structure:

```markdown
# Deep Interview Spec: {title}

## Metadata
- Interview ID: {uuid}
- Rounds: {count}
- Final Ambiguity Score: {score}%
- Type: greenfield | brownfield
- Generated: {timestamp}
- Threshold: {threshold}
- Status: {PASSED | BELOW_THRESHOLD_EARLY_EXIT}

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | {s} | {w} | {s*w} |
| Constraint Clarity | {s} | {w} | {s*w} |
| Success Criteria | {s} | {w} | {s*w} |
| Context Clarity | {s} | {w} | {s*w} |
| **Total Clarity** | | | **{total}** |
| **Ambiguity** | | | **{1-total}** |

## Goal
{crystal-clear goal statement derived from interview}

## Constraints
- {constraint 1}
- {constraint 2}
- ...

## Non-Goals
- {explicitly excluded scope 1}
- {explicitly excluded scope 2}

## Acceptance Criteria
- [ ] {testable criterion 1}
- [ ] {testable criterion 2}
- [ ] {testable criterion 3}
- ...

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| {assumption} | {how it was questioned} | {what was decided} |

## Technical Context
{brownfield: relevant codebase findings from explore agent}
{greenfield: technology choices and constraints}

## Ontology (Key Entities)
{Fill from FINAL round's ontology extraction, not just crystallization-time generation}

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| {entity.name} | {entity.type} | {entity.fields} | {entity.relationships} |

## Ontology Convergence
{Show how entities stabilized across interview rounds using data from ontology_snapshots in state}

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | {n} | {n} | - | - | - |
| 2 | {n} | {new} | {changed} | {stable} | {ratio}% |
| ... | ... | ... | ... | ... | ... |
| {final} | {n} | {new} | {changed} | {stable} | {ratio}% |

## Interview Transcript
<details>
<summary>Full Q&A ({n} rounds)</summary>

### Round 1
**Q:** {question}
**A:** {answer}
**Ambiguity:** {score}% (Goal: {g}, Constraints: {c}, Criteria: {cr})

...
</details>
```

## Phase 5: Execution Bridge

**Autoresearch override:** if `--autoresearch` active, skip standard execution options below. Only valid bridge is direct `omc autoresearch --mission ... --eval ...` handoff described above.

After spec written, present execution options via `AskUserQuestion`:

**Question:** "Spec ready (ambiguity: {score}%). How proceed?"

**Options:**

1. **Ralplan → Autopilot (Recommended)**
   - Description: "3-stage pipeline: consensus-refine spec with Planner/Architect/Critic, then execute with full autopilot. Maximum quality."
   - Action: Invoke `Skill("oh-my-caveman:omc-plan")` with `--consensus --direct` flags and spec file path as context. `--direct` flag skips omc-plan skill's interview phase (deep interview already gathered requirements), while `--consensus` triggers Planner/Architect/Critic loop. When consensus completes and produces plan in `.omc/plans/`, invoke `Skill("oh-my-caveman:autopilot")` with consensus plan as Phase 0+1 output — autopilot skips both Expansion and Planning, starting directly at Phase 2 (Execution).
   - Pipeline: `deep-interview spec → omc-plan --consensus --direct → autopilot execution`

2. **Execute with autopilot (skip ralplan)**
   - Description: "Full autonomous pipeline — planning, parallel implementation, QA, validation. Faster but without consensus refinement."
   - Action: Invoke `Skill("oh-my-caveman:autopilot")` with spec file path as context. Spec replaces autopilot's Phase 0 — autopilot starts at Phase 1 (Planning).

3. **Execute with ralph**
   - Description: "Persistence loop with architect verification — keeps working until all acceptance criteria pass"
   - Action: Invoke `Skill("oh-my-caveman:ralph")` with spec file path as task definition.

4. **Execute with team**
   - Description: "N coordinated parallel agents — fastest execution for large specs"
   - Action: Invoke `Skill("oh-my-caveman:team")` with spec file path as shared plan.

5. **Refine further**
   - Description: "Continue interviewing to improve clarity (current: {score}%)"
   - Action: Return to Phase 2 interview loop.

**IMPORTANT:** On execution selection, **MUST** invoke chosen skill via `Skill()`. Do NOT implement directly. Deep-interview agent is requirements agent, not execution agent.

### The 3-Stage Pipeline (Recommended Path)

```
Stage 1: Deep Interview          Stage 2: Ralplan                Stage 3: Autopilot
┌─────────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐
│ Socratic Q&A        │    │ Planner creates plan      │    │ Phase 2: Execution   │
│ Ambiguity scoring   │───>│ Architect reviews         │───>│ Phase 3: QA cycling  │
│ Challenge agents    │    │ Critic validates          │    │ Phase 4: Validation  │
│ Spec crystallization│    │ Loop until consensus      │    │ Phase 5: Cleanup     │
│ Gate: ≤20% ambiguity│    │ ADR + RALPLAN-DR summary  │    │                      │
└─────────────────────┘    └───────────────────────────┘    └──────────────────────┘
Output: spec.md            Output: consensus-plan.md        Output: working code
```

**Why 3 stages?** Each stage provides different quality gate:
1. **Deep Interview** gates on *clarity* — does user know what they want?
2. **Ralplan** gates on *feasibility* — is approach architecturally sound?
3. **Autopilot** gates on *correctness* — does code work and pass review?

Skipping any stage is possible but reduces quality assurance:
- Skip Stage 1 → autopilot may build wrong thing (vague requirements)
- Skip Stage 2 → autopilot may plan poorly (no Architect/Critic challenge)
- Skip Stage 3 → no execution (refined plan only)

</Steps>

<Tool_Usage>
- Use `AskUserQuestion` for each interview question — provides clickable UI with contextual options
- Use `Task(subagent_type="oh-my-caveman:explore", model="haiku")` for brownfield codebase exploration (run BEFORE asking user about codebase)
- Use opus model (temperature 0.1) for ambiguity scoring — consistency critical
- Use `state_write` / `state_read` for interview state persistence
- Use `Write` tool to save final spec to `.omc/specs/`
- Use `Skill()` to bridge to execution modes — never implement directly
- Challenge agent modes are prompt injections, not separate agent spawns
</Tool_Usage>

<Examples>
<Good>
Targeting weakest dimension:
```
Scores: Goal=0.9, Constraints=0.4, Criteria=0.7
Next question targets Constraints (lowest at 0.4):
"You mentioned this should 'work on mobile'. Does that mean native app,
responsive web app, or PWA? And are there specific devices or OS versions
to support?"
```
Why good: Identifies weakest dimension, explains why it is now bottleneck, asks specific question to improve it, doesn't batch multiple topics.
</Good>

<Good>
Gathering codebase facts before asking:
```
[spawns explore agent: "find authentication implementation"]
[receives: "Auth is in src/auth/ using JWT with passport.js"]

Question: "I found JWT authentication with passport.js in `src/auth/` (pattern match from explore).
For this new feature, should we extend existing auth middleware or create
separate authentication flow?"
```
Why good: Explored first, cited repo evidence that triggered question, then asked informed confirmation question. Never asks user what code already reveals.
</Good>

<Good>
Contrarian mode activation:
```
Round 5 | Contrarian Mode | Ambiguity: 42%

You've said this needs to support 10,000 concurrent users. What if it only
needed to handle 100? Would architecture change fundamentally, or is
10K number assumption rather than measured requirement?
```
Why good: Challenges specific assumption (scale requirement) that could dramatically simplify solution.
</Good>

<Good>
Early exit with warning:
```
User: "That's enough, just build it"
System: "Current ambiguity is 35% (threshold: 20%). Areas still unclear:
  - Success Criteria: 0.5 (How do we verify search ranking algorithm works correctly?)
  - Constraints: 0.6 (No performance targets defined yet)

Proceeding may require rework. Continue anyway?"
  [Yes, proceed] [Ask 2-3 more questions] [Cancel]
```
Why good: Respects user's desire to stop but transparently shows risk.
</Good>

<Good>
Ontology convergence tracking:
```
Round 3 entities: User, Task, Project (stability: N/A → 67%)
Round 4 entities: User, Task, Project, Tag (stability: 75% — 3 stable, 1 new)
Round 5 entities: User, Task, Project, Tag (stability: 100% — all 4 stable)

"Ontology converged — same 4 entities appeared in 2 consecutive rounds
with no changes. Domain model stable."
```
Why good: Shows entity tracking across rounds with visible convergence. Stability ratio increases as domain model solidifies, giving mathematical evidence interview is converging on stable understanding.
</Good>

<Good>
Ontology-style question for scope-fuzzy tasks:
```
Round 6 | Targeting: Goal Clarity | Why now: core entity still unstable across rounds, so feature questions would compound ambiguity | Ambiguity: 38%

"Across last rounds you've described this as workflow, inbox, and planner. Which one is core thing this product IS, and which ones are supporting metaphors or views?"
```
Why good: Uses ontology-style questioning to stabilize core noun before drilling into features — right move when scope fuzzy rather than merely incomplete.
</Good>

<Bad>
Batching multiple questions:
```
"What's target audience? And what tech stack? And how should auth work?
Also, what's deployment target?"
```
Why bad: Four questions at once — causes shallow answers and makes scoring inaccurate.
</Bad>

<Bad>
Asking about codebase facts:
```
"What database does your project use?"
```
Why bad: Should have spawned explore agent to find this. Never ask user what code already tells you.
</Bad>

<Bad>
Proceeding despite high ambiguity:
```
"Ambiguity is at 45% but we've done 5 rounds, so let's start building."
```
Why bad: 45% ambiguity means nearly half requirements are unclear. Mathematical gate exists to prevent exactly this.
</Bad>
</Examples>

<Escalation_And_Stop_Conditions>
- **Hard cap at 20 rounds**: Proceed with whatever clarity exists, noting risk
- **Soft warning at 10 rounds**: Offer to continue or proceed
- **Early exit (round 3+)**: Allow with warning if ambiguity > threshold
- **User says "stop", "cancel", "abort"**: Stop immediately, save state for resume
- **Ambiguity stalls** (same score +-0.05 for 3 rounds): Activate Ontologist mode to reframe
- **All dimensions at 0.9+**: Skip to spec generation even if not at round minimum
- **Codebase exploration fails**: Proceed as greenfield, note limitation
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] Interview completed (ambiguity ≤ threshold OR user chose early exit)
- [ ] Ambiguity score displayed after every round
- [ ] Every round explicitly names weakest dimension and why it is next target
- [ ] Challenge agents activated at correct thresholds (round 4, 6, 8)
- [ ] Spec file written to `.omc/specs/deep-interview-{slug}.md`
- [ ] Spec includes: goal, constraints, acceptance criteria, clarity breakdown, transcript
- [ ] Execution bridge presented via AskUserQuestion
- [ ] Selected execution mode invoked via Skill() (never direct implementation)
- [ ] If 3-stage pipeline selected: omc-plan --consensus --direct invoked, then autopilot with consensus plan
- [ ] State cleaned up after execution handoff
- [ ] Brownfield confirmation questions cite repo evidence (file/path/pattern) before asking user to decide
- [ ] Scope-fuzzy tasks can trigger ontology-style questioning to stabilize core entity before feature elaboration
- [ ] Per-round ambiguity report includes Ontology row with entity count and stability ratio
- [ ] Spec includes Ontology (Key Entities) table and Ontology Convergence section
</Final_Checklist>

<Advanced>
## Configuration

Optional settings in `.claude/settings.json`:

```json
{
  "omc": {
    "deepInterview": {
      "ambiguityThreshold": 0.2,
      "maxRounds": 20,
      "softWarningRounds": 10,
      "minRoundsBeforeExit": 3,
      "enableChallengeAgents": true,
      "autoExecuteOnComplete": false,
      "defaultExecutionMode": "autopilot",
      "scoringModel": "opus"
    }
  }
}
```

## Resume

If interrupted, run `/deep-interview` again. Skill reads state from `.omc/state/deep-interview-state.json` and resumes from last completed round.

## Integration with Autopilot

When autopilot receives vague input (no file paths, function names, or concrete anchors), it can redirect to deep-interview:

```
User: "autopilot build me a thing"
Autopilot: "Request is open-ended. Run deep interview first to clarify requirements?"
  [Yes, interview first] [No, expand directly]
```

User chooses interview → autopilot invokes `/deep-interview`. When interview completes and user selects "Execute with autopilot", spec becomes Phase 0 output and autopilot continues from Phase 1 (Planning).

## The 3-Stage Pipeline: deep-interview → ralplan → autopilot

Recommended execution path chains three quality gates:

```
/deep-interview "vague idea"
  → Socratic Q&A until ambiguity ≤ 20%
  → Spec written to .omc/specs/deep-interview-{slug}.md
  → User selects "Ralplan → Autopilot"
  → /omc-plan --consensus --direct (spec as input, skip interview)
    → Planner creates implementation plan from spec
    → Architect reviews for architectural soundness
    → Critic validates quality and testability
    → Loop until consensus (max 5 iterations)
    → Consensus plan written to .omc/plans/
  → /autopilot (plan as input, skip Phase 0+1)
    → Phase 2: Parallel execution via Ralph + Ultrawork
    → Phase 3: QA cycling until tests pass
    → Phase 4: Multi-perspective validation
    → Phase 5: Cleanup
```

**omc-plan skill receives spec with `--consensus --direct` flags** because deep interview already did requirements gathering. `--direct` flag (supported by omc-plan skill, which ralplan aliases) skips interview phase and goes straight to Planner → Architect → Critic consensus. Consensus plan includes:
- RALPLAN-DR summary (Principles, Decision Drivers, Options)
- ADR (Decision, Drivers, Alternatives, Why chosen, Consequences)
- Testable acceptance criteria (inherited from deep-interview spec)
- Implementation steps with file references

**Autopilot receives ralplan consensus plan** and skips both Phase 0 (Expansion) and Phase 1 (Planning) since ralplan already produced Critic-approved plan. Autopilot starts directly at Phase 2 (Execution).

## Integration with Ralplan Gate

Ralplan pre-execution gate already redirects vague prompts to planning. Deep interview can serve as alternative redirect target for prompts too vague even for ralplan:

```
Vague prompt → ralplan gate → deep-interview (if extremely vague) → ralplan (with clear spec) → autopilot
```

## Brownfield vs Greenfield Weights

| Dimension | Greenfield | Brownfield |
|-----------|-----------|------------|
| Goal Clarity | 40% | 35% |
| Constraint Clarity | 30% | 25% |
| Success Criteria | 30% | 25% |
| Context Clarity | N/A | 15% |

Brownfield adds Context Clarity because modifying existing code safely requires understanding system being changed.

## Challenge Agent Modes

| Mode | Activates | Purpose | Prompt Injection |
|------|-----------|---------|-----------------|
| Contrarian | Round 4+ | Challenge assumptions | "What if opposite were true?" |
| Simplifier | Round 6+ | Remove complexity | "What's simplest version?" |
| Ontologist | Round 8+ (if ambiguity > 0.3) | Find essence | "What IS this, really?" |

Each mode used exactly once, then normal Socratic questioning resumes. Modes tracked in state to prevent repetition.

## Ambiguity Score Interpretation

| Score Range | Meaning | Action |
|-------------|---------|--------|
| 0.0 - 0.1 | Crystal clear | Proceed immediately |
| 0.1 - 0.2 | Clear enough | Proceed (default threshold) |
| 0.2 - 0.4 | Some gaps | Continue interviewing |
| 0.4 - 0.6 | Significant gaps | Focus on weakest dimensions |
| 0.6 - 0.8 | Very unclear | May need reframing (Ontologist) |
| 0.8 - 1.0 | Almost nothing known | Early stages, keep going |
</Advanced>

Task: {{ARGUMENTS}}
