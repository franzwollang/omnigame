# OmniGame Planning

Roadmap and coordination only. Concrete open work lives in `OPEN_ISSUES.md`.
Vision / non-goals: `README.md`. Formal composition draft: `docs/semantics.md`
(stale vs kernel — refresh tracked). Historical notes: `docs/scratchpad.md`
(not a backlog).

## Status board

### Phase 1 — Foundation (complete)

| ID | Milestone | Status |
|---|---|---|
| M0 | Honesty pass + Effect foothold | `done` |
| M1 | GameKernel ABI + Effect core + event transcripts | `done` |
| M2 | GameIR + deterministic replay | `done` |
| M3 | Compiler / normalize / macro expansion | `done` |
| M4 | Observation primitive + Battleship-lite | `done` |
| M5 | Anchor / reference-game ports | `done` |
| M6 | Debug tooling + baseline agents | `done` |
| M7 | Infinite library / config explorer | `done` |

### Phase 2 — Composition honesty + next seams (active)

| ID | Focus | Status |
|---|---|---|
| M8 | Composition honesty (debt + sandbox/agent truth) | `done` |
| M9 | Next missing mechanism (capture-by-replacement) | `done` |
| M10 | Next missing mechanism (Guess Who Lite query/guess) | `done` |
| M11 | Next missing mechanism (joint simultaneous sliding) | `done` |
| M12 | Next missing mechanism (ordered simultaneous sliding) | `done` |
| M13 | Next missing mechanism (joint simultaneous replace) | `done` |
| M14 | Next missing mechanism (ordered simultaneous replace) | `done` |
| M15 | Next missing mechanism (simultaneous slide+replace) | `done` |

**Optimizing for this marathon:** M15 simultaneous slide+replace closed. Pick
**P3 next-missing-mechanism** (smallest new seam) then P4 CI / semantics
refresh — without asking which fork.

## Marathon runbook (cloud agents)

### Environment

- Node `>=20.19.0`, package manager **`pnpm@10.5.2`** (`package.json#packageManager`)
- Green gate (every PR / before handoff):

```bash
pnpm install
pnpm typecheck
pnpm test
```

Optional: `pnpm lint`, `pnpm build`. Baseline: **≥360** Vitest tests (do not
delete or weaken tests — see `.cursor/rules/testing-integrity.mdc`).

### Read order (cold start)

1. `SCRATCHPAD.json` → current focus / next_step  
2. `OPEN_ISSUES.md` → **Immediate (prioritized)** top item  
3. This file → Phase 2 board + Do-not-do  
4. `README.md` status only for vocabulary — not as a task list  

### Task selection (no user ask)

1. Work the highest unfinished **P3 → P4** item in `OPEN_ISSUES.md`
   (P0–P2 / M8–M15 closed).  
2. Start **P3** `next-missing-mechanism` (post-M15) — smallest new seam — or
   P4 CI / semantics.  
3. If blocked on environment only, fix tooling and continue — do not invent
   parallel roadmaps.  
4. After each landed item: update OPEN_ISSUES (resolve + log), PLANNING status,
   SCRATCHPAD, run green gate, checkpoint commit if policy allows.

### Do not do (this phase)

- No new n-in-a-row / gravity-only preset recombinations  
- No exhausting `references/` as a checklist (mechanism-first only)  
- No Effect Schema migration; no arbitrary user code in specs  
- No weakening / skipping tests to go green  
- No hex/graph `movement.range > 1` until a new seam forces it  
- Do not treat `docs/scratchpad.md` as current backlog  

## Decisions (locked)

| Topic | Decision |
|---|---|
| FP runtime | **Effect.ts** — core + edges; Zod at JSON/UI until Effect Schema is deliberate |
| Product surfaces | Sandbox composer + Library explorer |
| Reference games | Mechanism-first only (`.cursor/rules/project-structure.mdc`) |
| Simultaneous × sliding | **Joint** vacated-origin paths; **ordered** sequential path revalidation |
| Simultaneous × replace | **Joint** real-board (any range, paths clear pre-round); **ordered** sequential capture (any range, incl. slide) |
| Marathon priority | Composition honesty **before** new mechanism |

## Product surfaces

| Surface | Question | Interaction |
|---|---|---|
| **Sandbox** | Author *this* game? | JSON/form + play + presets |
| **Library explorer** | What’s in config-space? | Sample / score / share / load finds |

## What exists today (summary)

Kernel + compiler + GameIR + library explorer + agents (random/greedy/hunt/MCTS/UCT).
**Movement:** form exposes `adjacency` / `range` / `capture`; Replace Race
preset demonstrates `capture = replace`.
**Deduction:** Guess Who Lite (`input/observation = deduction`,
`identify_secret`, query + guess operators).

Mechanisms include: rect/hex/graph topology, wrap (rect+hex), gravity + pop-out
variants, flip + liberties capture, **move capture-by-replacement** (incl.
**joint + ordered simultaneous replace** and **slide+replace**), point/positional/situational ko,
observation (hit/miss + fog + **deduction**), fleet placement, Move
(orthogonal/diagonal/king + sliding range on rectangle), tick/Life, simultaneous
place/move (incl. ordered, hidden commit-reveal, multi-action, **joint + ordered
sliding**), multi-step turns, delayed place/gravity, in-turn phases (place→move /
place→fire / place→move→fire + `connect_or_destroy`), **query + guess /
identify_secret**.

Presets: see `src/presets/registry.ts` and README status (includes Fog Connect
Lite, Slide Race, Simultaneous Slide Race, Ordered Simultaneous Slide Race,
Replace Race, Simultaneous Replace Race, Ordered Simultaneous Replace Race,
Simultaneous Slide Replace Race, Ordered Simultaneous Slide Replace Race,
Guess Who Lite, Simultaneous Step Race, Place Move & Fire Lite, Go Lite
variants, etc.).

**Form honesty:** form exposes turn schedule/budget/delay/**phases**,
`movement.adjacency` / `movement.range` / `movement.capture`, placement, win,
observation, etc., plus an in-UI “Form coverage” callout for remaining
JSON/preset-only fields (`scheduler`, graph nodes/edges, `initial`,
`placement.capture`, `deduction.*` / `identify_secret`, …).

**Not yet:** full Go; hex/graph sliding; joint UCT under simultaneous;
CI workflows; richer Guess Who commit/hypothesis beyond query+guess MVP.

## Phase 2 exit criteria

### M8 — Composition honesty

- Simultaneous × sliding closed (schema forbid **or** apply-time path check + tests) — **done**
- Sandbox Agent step works for simultaneous **move** (joint move) — **done**
- Form exposes movement (+ phases) **or** README explicitly marks JSON-only — **done** (controls + in-UI coverage callout)
- `isNoop` includes phase budget / ko / positionHistory fields — **done**
- Known agent-search limitation under simultaneous documented or improved — **done** (Agent UI label + README agents blurb)

### M9 — Capture-by-replacement

- Schema + kernel path for move onto occupied enemy cell (replace) — **done**
- Preset + transcript/replay tests — **done** (Replace Race)
- Contracts/validation; no forked per-game engine — **done**
- Out of scope still deferred: multi-jump, capture chains, hex/graph replace

### M10 — Guess Who Lite (query + guess)

- Schema deduction lockstep (`input`/`observation`/`objective`/`deduction`) — **done**
- Kernel query/guess + `queryAnswered` / `guessResult`; observation projection — **done**
- Preset `guess-who-lite` + transcript/replay tests — **done**
- Out of scope: full canvas UI; richer commit/hypothesis; simultaneous deduction

### M11 — Joint simultaneous sliding

- Vacated-origin path checks for joint simultaneous + `range > 1` — **done**
- Schema allows joint sliding — **done**
- Preset `simultaneous-slide-race` + transcript/replay tests — **done**
- Out of scope closed by M12: ordered sequential sliding
- Out of scope closed by M13: joint simultaneous replace (range 1)

### M12 — Ordered simultaneous sliding

- Sequential path revalidation (`canOrderedSimultaneousMoves`) — **done**
- Schema allows ordered + `range > 1`; same-dest first-seat wins preserved — **done**
- Preset `ordered-simultaneous-slide-race` + transcript/replay tests — **done**
- Out of scope: hex/graph sliding
- Out of scope closed by M15: simultaneous slide+replace

### M13 — Joint simultaneous replace

- Real-board legality for joint + `capture: replace` (range 1) — **done**
- Schema allows joint replace — **done**
- Preset `simultaneous-replace-race` + transcript/replay + `pieceCaptured` — **done**
- Out of scope closed by M14: ordered replace
- Out of scope closed by M15: simultaneous slide+replace
- Out of scope: hex/graph replace

### M14 — Ordered simultaneous replace

- Sequential capture apply for ordered + `capture: replace` (range 1) — **done**
- Schema allows ordered replace at range 1; priority capture-before-flee — **done**
- Preset `ordered-simultaneous-replace-race` + transcript/replay + `pieceCaptured` — **done**
- Out of scope closed by M15: simultaneous slide+replace
- Out of scope: hex/graph replace

### M15 — Simultaneous slide + replace

- Schema allows simultaneous + `capture: replace` + `range > 1` (joint + ordered) — **done**
- Joint real-board slide paths (clear pre-round) + ordered sequential path/capture — **done**
- Presets `simultaneous-slide-replace-race` + `ordered-simultaneous-slide-replace-race` + tests — **done**
- Out of scope: hex/graph replace; vacated-origin hybrid for joint replace paths
## Sequencing notes

1. Mechanism-first ports only — not “finish `references/`.”  
2. Effect Schema optional later; Zod remains sandbox validator.  
3. Prefer schema honesty over silent no-ops when composition is unsafe.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous
physics first; no arbitrary user code in specs.
