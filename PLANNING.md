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
| M16 | Next missing mechanism (move→fire in-turn phases) | `done` |
| M17 | Next missing mechanism (joint replace vacated-origin hybrid) | `done` |
| M18 | Next missing mechanism (joint UCT/MCTS under simultaneous) | `done` |
| M19 | Next missing mechanism (joint UCT under multi-action simultaneous) | `done` |
| M20 | Next missing mechanism (joint UCT/MCTS under commitReveal) | `done` |
| M21 | Next missing mechanism (hex cube-axis sliding) | `done` |
| M22 | Next missing mechanism (graph chain-walk sliding) | `done` |
| M23 | Next missing mechanism (Guess Who manual commit / eliminate) | `done` |
| M24 | Next missing mechanism (Guess Who trait-conjunction / AND) | `done` |

**Optimizing for this marathon:** M24 Guess Who AND queries closed. Pick **P3
next-missing-mechanism** (e.g. richer phases, hex/graph replace, OR queries) or
**P4** CI / semantics refresh — without asking which fork.

## Marathon runbook (cloud agents)

### Environment

- Node `>=20.19.0`, package manager **`pnpm@10.5.2`** (`package.json#packageManager`)
- Green gate (every PR / before handoff):

```bash
pnpm install
pnpm typecheck
pnpm test
```

Optional: `pnpm lint`, `pnpm build`. Baseline: **≥426** Vitest tests (do not
delete or weaken tests — see `.cursor/rules/testing-integrity.mdc`).

### Read order (cold start)

1. `SCRATCHPAD.json` → current focus / next_step  
2. `OPEN_ISSUES.md` → **Immediate (prioritized)** top item  
3. This file → Phase 2 board + Do-not-do  
4. `README.md` status only for vocabulary — not as a task list  

### Task selection (no user ask)

1. Work the highest unfinished **P3 → P4** item in `OPEN_ISSUES.md`
   (P0–P2 / M8–M24 closed).  
2. Start **P3** `next-missing-mechanism` (post-M24) — smallest new seam — or
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
- No hex/graph `capture: replace` until a new seam forces it  
- No hop-ball graph range until a game needs turning mid-slide  
- Do not treat `docs/scratchpad.md` as current backlog  

## Decisions (locked)

| Topic | Decision |
|---|---|
| FP runtime | **Effect.ts** — core + edges; Zod at JSON/UI until Effect Schema is deliberate |
| Product surfaces | Sandbox composer + Library explorer |
| Reference games | Mechanism-first only (`.cursor/rules/project-structure.mdc`) |
| Simultaneous × sliding | **Joint** vacated-origin paths; **ordered** sequential path revalidation |
| Simultaneous × replace | **Joint** vacated-origin paths (any range; stationary replace still required); **ordered** sequential capture (any range, incl. slide) |
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
`identify_secret`, query + guess), **Guess Who Commit Lite**
(`autoEliminate: false` + eliminate operator; `wrongGuess: end_turn`), and
**Guess Who And Lite** (`queryShape: and` — 2-clause trait conjunction).

Mechanisms include: rect/hex/graph topology, wrap (rect+hex), gravity + pop-out
variants, flip + liberties capture, **move capture-by-replacement** (incl.
**joint + ordered simultaneous replace** and **slide+replace**), point/positional/situational ko,
observation (hit/miss + fog + **deduction**), fleet placement, Move
(orthogonal/diagonal/king + sliding range on rectangle **and hex_offset cube
axes** + **graph edge chain-walk**; replace rectangle-only), tick/Life, simultaneous
place/move (incl. ordered, hidden commit-reveal, multi-action, **joint + ordered
sliding**), multi-step turns, delayed place/gravity, in-turn phases (place→move /
place→fire / place→move→fire + `connect_or_destroy` / **move→fire**), **query +
guess / identify_secret** + **manual eliminate** (`autoEliminate: false`) +
**trait-conjunction queries** (`queryShape: and`).

Presets: see `src/presets/registry.ts` and README status (includes Fog Connect
Lite, Slide Race, **Hex Slide Race**, **Graph Slide Race**, Simultaneous Slide Race, Ordered Simultaneous Slide Race,
Replace Race, Simultaneous Replace Race, Ordered Simultaneous Replace Race,
Simultaneous Slide Replace Race, Ordered Simultaneous Slide Replace Race,
Guess Who Lite, Guess Who Commit Lite, **Guess Who And Lite**, Simultaneous Step Race, Place Move & Fire Lite, Move & Fire
Lite, Go Lite variants, etc.).

**Form honesty:** form exposes turn schedule/budget/delay/**phases**,
`movement.adjacency` / `movement.range` / `movement.capture`, placement, win,
observation, etc., plus an in-UI “Form coverage” callout for remaining
JSON/preset-only fields (`scheduler`, graph nodes/edges, `initial`,
`placement.capture`, `deduction.*` / `identify_secret`, …). Range 2–8 unlocked
for rectangle, hex, and graph (chain-walk).

**Not yet:** full Go; hop-ball graph range; hex/graph replace; CI workflows;
semantics doc refresh; simultaneous deduction / OR / 3+ clause AND.

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
- Out of scope: full canvas UI; simultaneous deduction
- Out of scope closed by M23: richer commit/hypothesis (`eliminate` +
  `autoEliminate: false`)
- Out of scope closed by M24: trait conjunction queries (`queryShape: and`)

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
- Out of scope closed by M21: hex sliding; graph sliding still deferred
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
- Joint vacated-origin hybrid + ordered sequential path/capture — **done** (hybrid closed in M17)
- Presets `simultaneous-slide-replace-race` + `ordered-simultaneous-slide-replace-race` + tests — **done**
- Out of scope: hex/graph replace
- Out of scope closed by M17: vacated-origin hybrid for joint replace paths

### M16 — Move→fire in-turn phases

- Schema allows `turn.phases: ["move","fire"]` (hit_miss + destroy_hidden +
  movement + public spotter seeds) — **done**
- Kernel phase routing already supported; wrong_phase + GameIR replay — **done**
- Preset `move-fire-lite` + form phase option + tests — **done**
- Out of scope: fire→move; hex/graph phases; simultaneous phases

### M17 — Joint replace vacated-origin hybrid

- Joint + replace (+ slide): same vacated-origin path checks as joint slides —
  fleeing blockers clear the ray; stationary enemies stay and still need
  replace — **done**
- Preset `simultaneous-slide-replace-flee-race` + legality/apply/replay tests — **done**
- Stationary capture + static blockers + seat-swap unchanged — **done**
- Out of scope: hex/graph replace; joint UCT over simultaneous actions
  (closed by M18 for open simultaneous budget-1)

### M18 — Joint UCT / MCTS under simultaneous

- Enumerate joint place/move cartesian (`enumerateJointLegalActions`) for open
  simultaneous with `actionsPerTurn = 1` — **done**
- UCT + flat MCTS root search over joint actions; dual-`act` decision cache —
  **done**
- Immediate joint-win shortcut; sandbox Agent UI + README labels updated — **done**
- Tests on `simultaneous-ttt` (enumerate, consistency, win, playout) — **done**
- Out of scope closed by M19: multi-action joint cartesian
- Out of scope closed by M20: `commitReveal` joint search
- Out of scope still deferred: Nash/maximin adversarial joint policy

### M19 — Joint UCT / MCTS under multi-action simultaneous

- Extend `canSearchJointActions` / `enumerateJointLegalActions` to
  `actionsPerTurn > 1` (ordered distinct place tuples × cartesian) — **done**
- Per-seat pick cursor on joint decision cache for sandbox multi-`act` — **done**
- Flat MCTS samples large cartesians; UCT searches full untried set — **done**
- Tests on `double-place-simultaneous-ttt` (5184 enum, coordinated picks,
  mid-round win, playout) — **done**
- Out of scope closed by M21: hex sliding
- Out of scope still deferred: Nash/maximin joint policy

### M20 — Joint UCT / MCTS under commitReveal

- `enumerateCommitRevealJoints` on fresh rounds (81 for Hidden Simultaneous TTT);
  round fingerprint ignores `committedPlacements` — **done**
- UCT + flat MCTS search reveal joints via `simultaneousPlace`; cache sequential
  `commitPlace` for sandbox X-then-O clicks — **done**
- Mid-round without cache: per-seat search over `commitPlace` — **done**
- Tests on `hidden-simultaneous-ttt` (enum, partial disable, sequential cache,
  win, playout) — **done**
- Out of scope: Nash/maximin; observe()-limited imperfect-info search;
  commitReveal + simultaneous move (schema blocked)

### M21 — Hex cube-axis sliding

- Schema accepts `hex_offset` + move + `reach_row` + `movement.range` 2..8 — **done**
- `slideHexDestinations` walks six cube axes via `stepHex` (blocker/wrap parity
  with rectangle slides); graph still range 1 at the time — **done**
- Preset `hex-slide-race` + destination / blocker / win+replay tests — **done**
- Form range max unlocked for hex (graph stays 1 until M22) — **done**
- Out of scope closed by M22: graph sliding
- Out of scope: hex/graph replace capture

### M22 — Graph chain-walk sliding

- Schema accepts `graph` + move + `reach_row` + `movement.range` 2..8 — **done**
- `slideGraphDestinations` walks unique forward edge chains (blocker parity;
  junctions stop — no turning mid-slide); replace still rectangle-only — **done**
- Preset `graph-slide-race` + destination / blocker / junction / win+replay
  tests — **done**
- Form range max unlocked for graph — **done**
- Out of scope: hop-ball graph range; hex/graph replace capture

### M23 — Guess Who manual commit (eliminate)

- Schema `deduction.autoEliminate` (default true); false disables query
  auto-prune — **done**
- Kernel `{ type: "eliminate"; id }` + `candidateEliminated` event; legal only
  when autoEliminate is false — **done**
- Preset `guess-who-commit-lite` (`wrongGuess: end_turn`) + transcript/replay
  tests — **done**
- Out of scope: simultaneous deduction; deduction + phases; batch eliminate;
  full canvas UI
- Out of scope closed by M24: trait conjunction queries

### M24 — Guess Who trait-conjunction queries (AND)

- Schema `deduction.queryShape: "single" | "and"` (default single) — **done**
- Kernel `{ type: "query", clauses }` (length 2); `answerQueryConjunction` /
  `eliminateAfterQueryConjunction`; legal enum C(n,2)×4 — **done**
- Preset `guess-who-and-lite` + transcript/replay tests — **done**
- Out of scope: OR / NOT / 3+ clause AND; simultaneous deduction; deduction +
  phases; full canvas UI

## Sequencing notes

1. Mechanism-first ports only — not “finish `references/`.”  
2. Effect Schema optional later; Zod remains sandbox validator.  
3. Prefer schema honesty over silent no-ops when composition is unsafe.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous
physics first; no arbitrary user code in specs.
