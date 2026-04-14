---
name: trace
description: Evidence-driven tracing lane that orchestrates competing tracer hypotheses in Claude built-in team mode
argument-hint: "<observation to trace>"
agent: tracer
level: 2
---

# Trace Skill

Use for ambiguous, causal, evidence-heavy questions where goal is explaining **why** observed result happened — not jumping into fix or rewrite.

Orchestration layer on top of built-in `tracer` agent. Makes tracing reusable OMC lane: restate observation, generate competing explanations, gather evidence in parallel, rank explanations, propose next probe that collapses uncertainty fastest.

## Good entry cases

Use `/oh-my-caveman:trace` when problem is:

- ambiguous
- causal
- evidence-heavy
- best answered by exploring competing explanations in parallel

Examples:
- runtime bugs and regressions
- performance / latency / resource behavior
- architecture / premortem / postmortem analysis
- scientific or experimental result tracing
- config / routing / orchestration behavior explanation
- "given this output, trace back the likely causes"

## Core tracing contract

Always preserve these distinctions:

1. **Observation** -- what was actually observed
2. **Hypotheses** -- competing explanations
3. **Evidence For** -- what supports each explanation
4. **Evidence Against / Gaps** -- what contradicts it or is still missing
5. **Current Best Explanation** -- leading explanation right now
6. **Critical Unknown** -- missing fact keeping top explanations apart
7. **Discriminating Probe** -- highest-value next step to collapse uncertainty

Do **not** collapse into:
- generic fix-it coding loop
- generic debugger summary
- raw dump of worker output
- fake certainty when evidence is incomplete

## Evidence strength hierarchy

Treat evidence as ranked, not flat.

Strongest to weakest:

1. **Controlled reproductions / direct experiments / uniquely discriminating artifacts**
2. **Primary source artifacts with tight provenance** (trace events, logs, metrics, benchmark outputs, configs, git history, file:line behavior)
3. **Multiple independent sources converging on same explanation**
4. **Single-source code-path or behavioral inference**
5. **Weak circumstantial clues** (timing, naming, stack order, resemblance to prior bugs)
6. **Intuition / analogy / speculation**

Explicitly down-rank hypotheses that depend mostly on lower tiers when stronger contradictory evidence exists.

## Strong falsification / disconfirmation rules

Every serious `/trace` run must try to falsify its own favorite explanation.

For each top hypothesis:

- collect evidence **for** it
- collect evidence **against** it
- state what distinctive prediction it makes
- state what observation would be hard to reconcile with it
- identify cheapest probe that would discriminate it from next-best alternative

Down-rank hypothesis when:

- direct evidence contradicts it
- it survives only by adding new unverified assumptions
- it makes no distinctive prediction compared with rivals
- stronger alternative explains same facts with fewer assumptions
- its support is mostly circumstantial while rival has stronger evidence tiers

## Team-mode orchestration shape

Use **Claude built-in team mode** for `/trace`.

Lead should:

1. Restate observed result or "why" question precisely
2. Extract tracing target
3. Generate multiple deliberately different candidate hypotheses
4. Spawn **3 tracer lanes by default** in team mode
5. Assign one tracer worker per lane
6. Instruct each tracer worker to gather evidence **for** and **against** its lane
7. Run **rebuttal round** between leading hypothesis and strongest remaining alternative
8. Detect whether top lanes genuinely differ or actually converge on same root cause
9. Merge findings into ranked synthesis with explicit critical unknown and discriminating probe

Workers must pursue deliberately different explanations — not same explanation in parallel.

## Default hypothesis lanes for v1

Unless prompt strongly suggests better partition, use these 3 default lanes:

1. **Code-path / implementation cause**
2. **Config / environment / orchestration cause**
3. **Measurement / artifact / assumption mismatch cause**

Defaults are intentionally broad so first slice works across bug, performance, architecture, and experiment tracing.

## Mandatory cross-check lenses

After initial evidence pass, pressure-test leaders with these lenses when relevant:

- **Systems lens** -- queues, retries, backpressure, feedback loops, upstream/downstream dependencies, boundary failures, coordination effects
- **Premortem lens** -- assume current best explanation is incomplete or wrong; what failure mode would embarrass trace later?
- **Science lens** -- controls, confounders, measurement bias, alternative variables, falsifiable predictions

Not filler. Use when they can surface missed explanation, hidden dependency, or weak inference.

## Worker contract

Each worker must be **`tracer`** lane owner — not generic executor.

Each worker must:

- own exactly one hypothesis lane
- restate its lane hypothesis explicitly
- gather evidence **for** lane
- gather evidence **against** lane
- rank evidence strength behind its case
- call out missing evidence, failed predictions, remaining uncertainty
- name **critical unknown** for lane
- recommend best lane-specific **discriminating probe**
- avoid collapsing into implementation unless explicitly told

Useful evidence sources:

- relevant code, tests, configs, docs, logs, outputs, and benchmark artifacts
- existing trace artifacts via `trace_timeline`
- existing aggregate trace evidence via `trace_summary`

Worker return structure:

1. **Lane**
2. **Hypothesis**
3. **Evidence For**
4. **Evidence Against / Gaps**
5. **Evidence Strength**
6. **Critical Unknown**
7. **Best Discriminating Probe**
8. **Confidence**

## Leader synthesis contract

Final `/trace` answer must synthesize, not concatenate.

Return:

1. **Observed Result**
2. **Ranked Hypotheses**
3. **Evidence Summary by Hypothesis**
4. **Evidence Against / Missing Evidence**
5. **Rebuttal Round**
6. **Convergence / Separation Notes**
7. **Most Likely Explanation**
8. **Critical Unknown**
9. **Recommended Discriminating Probe**
10. **Additional Trace Lanes** (optional, only if uncertainty remains high)

Preserve ranked shortlist even if one explanation is currently dominant.

## Rebuttal round and convergence detection

Before closing trace:

- let strongest non-leading lane present its best rebuttal to current leader
- force leader to answer rebuttal with evidence, not assertion
- if rebuttal materially weakens leader, re-rank table
- if two "different" hypotheses reduce to same underlying mechanism, merge them and say so explicitly
- if two hypotheses still imply different next probes, keep them separate even if they sound similar

Do not claim convergence because multiple workers use similar language. Convergence requires either:

- same root causal mechanism, or
- independent evidence streams pointing to same explanation

## Explicit down-ranking guidance

Lead must explicitly say why hypothesis moved down:

- contradicted by stronger evidence
- lacks observation it predicted
- requires extra ad hoc assumptions
- explains fewer facts than leader
- lost rebuttal round
- converged into stronger parent explanation

Important — `/trace` should teach reader **why** one explanation outranks another, not just present final table.

## Suggested lead prompt skeleton

Use team-oriented orchestration prompt:

1. "Restate the observation exactly."
2. "Generate 3 deliberately different hypotheses."
3. "Create one tracer lane per hypothesis using Claude built-in team mode."
4. "For each lane, gather evidence for and against, rank evidence strength, and name the critical unknown plus best discriminating probe."
5. "Apply systems, premortem, and science lenses to the leaders if useful."
6. "Run a rebuttal round between the top two explanations."
7. "Return a ranked explanation table, convergence notes, the critical unknown, and the single best discriminating probe."

## Output quality bar

Good `/trace` output is:

- evidence-backed
- concise but rigorous
- skeptical of premature certainty
- explicit about missing evidence
- practical about next action
- explicit about why weaker explanations were down-ranked

## Example final synthesis shape

### Observed Result
[What happened]

### Ranked Hypotheses
| Rank | Hypothesis | Confidence | Evidence Strength | Why it leads |
|------|------------|------------|-------------------|--------------|
| 1 | ... | High / Medium / Low | Strong / Moderate / Weak | ... |

### Evidence Summary by Hypothesis
- Hypothesis 1: ...
- Hypothesis 2: ...
- Hypothesis 3: ...

### Evidence Against / Missing Evidence
- Hypothesis 1: ...
- Hypothesis 2: ...
- Hypothesis 3: ...

### Rebuttal Round
- Best rebuttal to leader: ...
- Why leader held / failed: ...

### Convergence / Separation Notes
- ...

### Most Likely Explanation
[Current best explanation]

### Critical Unknown
[Single missing fact keeping uncertainty open]

### Recommended Discriminating Probe
[Single next probe]

### Additional Trace Lanes
[Only if uncertainty remains high]
