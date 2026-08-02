# OmniGame Planning

Roadmap and coordination only. Concrete open work lives in `OPEN_ISSUES.md`.
Vision / non-goals: `README.md`. Formal composition draft: `docs/semantics.md`
(synced M42). Historical notes: `docs/scratchpad.md` (not a backlog).

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
| M25 | Next missing mechanism (Guess Who trait-disjunction / OR) | `done` |
| M26 | Next missing mechanism (hex replace capture) | `done` |
| M27 | Next missing mechanism (graph replace capture) | `done` |
| M28 | Next missing mechanism (compoundArity / 3-clause AND) | `done` |
| M29 | Next missing mechanism (deduction query→eliminate phases) | `done` |
| M30 | Next missing mechanism (simultaneous deduction joint query/guess) | `done` |
| M31 | Next missing mechanism (graph hop-ball range) | `done` |
| M32 | Next missing mechanism (simultaneous compound deduction) | `done` |
| M33 | Next missing mechanism (simultaneous deduction commitReveal) | `done` |
| M34 | Next missing mechanism (joint UCT under simultaneous deduction) | `done` |
| M35 | Next missing mechanism (simultaneous deduction manual eliminate) | `done` |
| M36 | Next missing mechanism (commitReveal deduction joint UCT) | `done` |
| M37 | Next missing mechanism (commitEliminate / commitReveal manual eliminate) | `done` |
| M38 | Next missing mechanism (commitMove / commitReveal simultaneous move) | `done` |
| M39 | Next missing mechanism (multi-action simultaneous move) | `done` |
| M40 | Next missing mechanism (commitReveal multi-action move) | `done` |
| M41 | Tooling CI (GitHub Actions typecheck + test) | `done` |
| M42 | Semantics doc refresh (`docs/semantics.md` ↔ kernel) | `done` |
| M43 | Next missing mechanism (jump capture / multi-jump chains) | `done` |
| M44 | Next missing mechanism (flood-fill region reveal) | `done` |

**Optimizing for this marathon:** M44 flood-fill reveal landed. Pick **P3
next-missing-mechanism** (smallest new seam; reject recombinations without
anchor) — without asking which fork.

## Marathon runbook (cloud agents)

### Environment

- Node `>=20.19.0`, package manager **`pnpm@10.5.2`** (`package.json#packageManager`)
- Green gate (every PR / before handoff):

```bash
pnpm install
pnpm typecheck
pnpm test
```

Optional: `pnpm lint`, `pnpm build`. Baseline: **≥596** Vitest tests (do not
delete or weaken tests — see `.cursor/rules/testing-integrity.mdc`).

### Read order (cold start)

1. `SCRATCHPAD.json` → current focus / next_step  
2. `OPEN_ISSUES.md` → **Immediate (prioritized)** top item  
3. This file → Phase 2 board + Do-not-do  
4. `README.md` status only for vocabulary — not as a task list  

### Task selection (no user ask)

1. Work the highest unfinished **P3** item in `OPEN_ISSUES.md`
   (P0–P2 / M8–M44 closed).  
2. Start **P3** `next-missing-mechanism` — smallest new seam; reject
   recombinations without an anchor.  
3. If blocked on environment only, fix tooling and continue — do not invent
   parallel roadmaps.  
4. After each landed item: update OPEN_ISSUES (resolve + log), PLANNING status,
   SCRATCHPAD, run green gate, checkpoint commit if policy allows.

### Do not do (this phase)

- No new n-in-a-row / gravity-only preset recombinations  
- No exhausting `references/` as a checklist (mechanism-first only)  
- No Effect Schema migration; no arbitrary user code in specs  
- No weakening / skipping tests to go green  
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
**Movement:** form exposes `adjacency` / `range` / `capture`; Replace Race /
**Hex Replace Race** / **Graph Replace Race** demonstrate `capture = replace`
on rectangle | hex_offset | graph; **Jump Race** demonstrates
`capture = jump` (leap over adjacent enemy + `mustContinueFrom` chains;
rectangle + alternating).
**Flood reveal:** **Minesweeper Lite** demonstrates `flood_reveal` +
`clear_hazards` + `hazards` (region open + mine-hit / clear-board terminals).
**Deduction:** Guess Who Lite (`input/observation = deduction`,
`identify_secret`, query + guess), **Guess Who Commit Lite**
(`autoEliminate: false` + eliminate operator; `wrongGuess: end_turn`),
**Guess Who And Lite** (`queryShape: and` — 2-clause trait conjunction),
**Guess Who Or Lite** (`queryShape: or` — 2-clause trait disjunction),
**Guess Who And3 Lite** (`compoundArity: 3` — 3-clause AND),
**Simultaneous Guess Who Lite** (joint query/guess under simultaneous),
**Simultaneous Guess Who And Lite** (joint compound AND under simultaneous),
**Simultaneous Guess Who Commit Lite** (joint manual eliminate under
simultaneous), **Hidden Simultaneous Guess Who Lite** (`commitReveal` under
simultaneous deduction — private query/guess then reveal).

Mechanisms include: rect/hex/graph topology, wrap (rect+hex), gravity + pop-out
variants, flip + liberties capture, **move capture-by-replacement** (incl.
**joint + ordered simultaneous replace** and **slide+replace**), point/positional/situational ko,
observation (hit/miss + fog + **deduction** + **flood_reveal**), fleet placement, Move
(orthogonal/diagonal/king + sliding range on rectangle **and hex_offset cube
axes** + **graph edge chain-walk**; replace on rectangle | hex_offset | **graph**), tick/Life, simultaneous
place/move/deduction (incl. ordered, hidden commit-reveal for place **and
move** **and deduction**, multi-action, **joint + ordered
sliding**, **joint query/guess** + **joint compound query**), multi-step turns, delayed place/gravity, in-turn phases (place→move /
place→fire / place→move→fire + `connect_or_destroy` / **move→fire** / query→eliminate), **query +
guess / identify_secret** + **manual eliminate** (`autoEliminate: false`) +
**trait-conjunction queries** (`queryShape: and`) + **trait-disjunction
queries** (`queryShape: or`) + **N-clause compounds** (`compoundArity`).

Presets: see `src/presets/registry.ts` and README status (includes Fog Connect
Lite, Slide Race, **Hex Slide Race**, **Graph Slide Race**, **Graph Hop Race**, Simultaneous Slide Race, Ordered Simultaneous Slide Race,
Replace Race, **Hex Replace Race**, **Graph Replace Race**, Simultaneous Replace Race, Ordered Simultaneous Replace Race,
Simultaneous Slide Replace Race, Ordered Simultaneous Slide Replace Race,
Guess Who Lite, Guess Who Commit Lite, **Guess Who And Lite**, **Guess Who Or Lite**,
**Guess Who And3 Lite**, **Simultaneous Guess Who Lite**, **Simultaneous Guess Who
Commit Lite**, **Simultaneous Guess Who And Lite**,
**Hidden Simultaneous Guess Who Lite**, **Hidden Simultaneous Guess Who Commit Lite**, Simultaneous Step Race, **Hidden Simultaneous Step Race**, **Double Simultaneous Step Race**, **Hidden Double Simultaneous Step Race**, Place Move & Fire Lite, Move & Fire
Lite, Go Lite variants, etc.).

**Form honesty:** form exposes turn schedule/budget/delay/**phases**,
`movement.adjacency` / `movement.range` / `movement.capture` /
`movement.graphReach`, placement, win, observation, etc., plus an in-UI
“Form coverage” callout for remaining JSON/preset-only fields (`scheduler`,
graph nodes/edges, `initial`, `placement.capture`, `deduction.*` /
`identify_secret`, …). Range 2–8 unlocked for rectangle, hex, and graph
(chain-walk or hop-ball).

**Not yet:** full Go; fire→move reorder (only with anchor); realtime
scheduler. Flood-fill reveal landed (M44 Minesweeper Lite). CI:
`.github/workflows/ci.yml` (Node 20.19 + pnpm 10.5.2). Semantics:
`docs/semantics.md` (M42; jump in M43; flood_reveal in M44).

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
- Out of scope closed by M26: hex replace; by M27: graph replace

### M10 — Guess Who Lite (query + guess)

- Schema deduction lockstep (`input`/`observation`/`objective`/`deduction`) — **done**
- Kernel query/guess + `queryAnswered` / `guessResult`; observation projection — **done**
- Preset `guess-who-lite` + transcript/replay tests — **done**
- Out of scope: full canvas UI; simultaneous deduction
- Out of scope closed by M23: richer commit/hypothesis (`eliminate` +
  `autoEliminate: false`)
- Out of scope closed by M24: trait conjunction queries (`queryShape: and`)
- Out of scope closed by M25: trait disjunction queries (`queryShape: or`)

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
- Out of scope closed by M26: hex replace; by M27: graph replace

### M14 — Ordered simultaneous replace

- Sequential capture apply for ordered + `capture: replace` (range 1) — **done**
- Schema allows ordered replace at range 1; priority capture-before-flee — **done**
- Preset `ordered-simultaneous-replace-race` + transcript/replay + `pieceCaptured` — **done**
- Out of scope closed by M15: simultaneous slide+replace
- Out of scope closed by M26: hex replace; by M27: graph replace

### M15 — Simultaneous slide + replace

- Schema allows simultaneous + `capture: replace` + `range > 1` (joint + ordered) — **done**
- Joint vacated-origin hybrid + ordered sequential path/capture — **done** (hybrid closed in M17)
- Presets `simultaneous-slide-replace-race` + `ordered-simultaneous-slide-replace-race` + tests — **done**
- Out of scope closed by M26: hex replace; by M27: graph replace
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
- Out of scope closed by M26: hex replace; by M27: graph replace
- Out of scope closed by M18: joint UCT over open simultaneous (budget-1)

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
- Out of scope closed by M26: hex replace; by M27: graph replace capture

### M22 — Graph chain-walk sliding

- Schema accepts `graph` + move + `reach_row` + `movement.range` 2..8 — **done**
- `slideGraphDestinations` walks unique forward edge chains (blocker parity;
  junctions stop — no turning mid-slide); replace deferred on graph — **done**
- Preset `graph-slide-race` + destination / blocker / junction / win+replay
  tests — **done**
- Form range max unlocked for graph — **done**
- Out of scope closed by M27: graph replace capture
- Out of scope: hop-ball graph range

### M23 — Guess Who manual commit (eliminate)

- Schema `deduction.autoEliminate` (default true); false disables query
  auto-prune — **done**
- Kernel `{ type: "eliminate"; id }` + `candidateEliminated` event; legal only
  when autoEliminate is false — **done**
- Preset `guess-who-commit-lite` (`wrongGuess: end_turn`) + transcript/replay
  tests — **done**
- Out of scope: simultaneous deduction; batch eliminate;
  full canvas UI
- Out of scope closed by M24: trait conjunction queries
- Out of scope closed by M25: trait disjunction queries
- Out of scope closed by M29: deduction + phases (query→eliminate)

### M24 — Guess Who trait-conjunction queries (AND)

- Schema `deduction.queryShape: "single" | "and"` (default single) — **done**
- Kernel `{ type: "query", clauses }` (length 2); `answerQueryConjunction` /
  `eliminateAfterQueryConjunction`; legal enum C(n,2)×4 — **done**
- Preset `guess-who-and-lite` + transcript/replay tests — **done**
- Out of scope closed by M25: OR queries
- Out of scope closed by M28: 3+ clause AND via compoundArity
- Out of scope closed by M29: deduction + phases
- Out of scope: NOT; simultaneous deduction; full canvas UI

### M25 — Guess Who trait-disjunction queries (OR)

- Schema `deduction.queryShape` adds `"or"` (≥2 traits) — **done**
- Kernel 2-clause OR answer/prune (`answerQueryDisjunction` /
  `eliminateAfterQueryDisjunction`); shared `enumerateTwoClauseQueries`;
  `lastQuery.op` / `queryAnswered.op` — **done**
- Preset `guess-who-or-lite` + transcript/replay tests — **done**
- Out of scope closed by M28: 3+ clause OR via compoundArity
- Out of scope closed by M29: deduction + phases
- Out of scope: NOT; simultaneous deduction; full canvas UI

### M26 — Hex replace capture

- Schema allows `movement.capture = replace` on `hex_offset` — **done**
- Kernel already had hex cube-axis replace in `slideHexDestinations`; form
  enables replace for hex — **done**
- Preset `hex-replace-race` + transcript/replay + sliding cube-axis tests —
  **done**
- Out of scope closed by M27: graph replace
- Out of scope: hop-ball; multi-jump / capture chains

### M27 — Graph replace capture

- Schema allows `movement.capture = replace` on `graph` — **done**
- `slideGraphDestinations` lands on first enemy along a chain (path empty
  except dest; own pieces / junctions still block); form enables replace for
  graph — **done**
- Preset `graph-replace-race` + transcript/replay + sliding chain tests —
  **done**
- Out of scope: hop-ball; multi-jump / capture chains; simultaneous graph
  replace demos (mechanism unlocked via shared legality)

### M28 — Compound arity / 3-clause AND

- Schema `deduction.compoundArity` (default 2; ≤ traits.length) for
  `queryShape` and|or — **done**
- Kernel/reducer validate exact arity + distinct traits;
  `enumerateCompoundQueries` — **done**
- Preset `guess-who-and3-lite` (3 traits × arity 3; 8 legal queries) +
  transcript/replay + prune-≠-2-clause tests — **done**
- Out of scope closed by M29: deduction + phases (query→eliminate)
- Out of scope: simultaneous deduction; hop-ball; fire→move reorder

### M29 — Deduction query→eliminate in-turn phases

- Schema allows deduction-only `turn.phases`: `["query","eliminate"]`,
  `["query","guess"]`, or `["query","eliminate","guess"]`; forbids mixing
  with place/move/fire; eliminate requires `autoEliminate: false` — **done**
- Kernel phase-gates legalActions / wrong_phase; guess legal during
  eliminate phase; `ScheduleInTurnPhases` requires CellsWritable only —
  **done**
- Preset `guess-who-commit-phases-lite` + form options + same-turn
  query→eliminate transcript/replay tests — **done**
- Out of scope closed by M30: simultaneous deduction foothold
- Out of scope closed by M31: hop-ball graph range
- Out of scope: fire→move; multi-eliminate budget within eliminate phase

### M30 — Simultaneous deduction (joint query/guess)

- Schema allows `schedule = simultaneous` + `input.mode = deduction` with
  single-atom queries + `autoEliminate: true`; forbids phases,
  ordered resolve (commitReveal unlocked by M33; compound by M32) — **done**
- Kernel/reducer: `simultaneousQuery` / `simultaneousGuess`;
  `jointQueryFromActions` / `jointGuessFromActions`; `lastQueries` observation;
  `ScheduleSimultaneous` CellsWritable-only + `ScheduleSimultaneousDeduction`;
  joint UCT deferred (`canSearchJointActions` false) — **done** (open joint
  UCT closed by M34; commitReveal joint UCT still deferred)
- Preset `simultaneous-guess-who-lite` + transcript/replay tests — **done**
- Out of scope closed by M32: compound queries under simultaneous
- Out of scope closed by M33: commitReveal under simultaneous deduction
- Out of scope closed by M34: joint UCT over open query/guess cartesian
- Out of scope closed by M35: manual eliminate under simultaneous
- Out of scope: ordered; sandbox pendingQueries UI
- Out of scope still deferred: commitReveal deduction joint UCT

### M31 — Graph hop-ball range

- Schema: `movement.graphReach = "chain" | "hop"` (default chain); hop requires
  `grid.topology = graph` + move (or move phase) — **done**
- Kernel: `hopGraphDestinations` BFS within range; empty-cell traversal;
  blocker stop; replace lands on enemy (not traversable); default chain
  preserves M22/M27 — **done**
- Preset `graph-hop-race` (hub topology) + transcript/replay + chain contrast
  tests; form Graph reach control — **done**
- Out of scope: fire→move; commitReveal deduction joint UCT;
  multi-jump capture chains

### M32 — Simultaneous compound deduction

- Schema allows `queryShape` and|or under `schedule = simultaneous` +
  deduction (still requires `autoEliminate: true`; forbids phases /
  ordered; commitReveal unlocked by M33) — **done**
- Kernel/reducer: joint compound resolve via `resolveQueryForPlayer`;
  legal enumeration via `enumerateCompoundQueries`;
  `simultaneousQuery` legality matches shape — **done**
- Preset `simultaneous-guess-who-and-lite` + transcript/replay tests — **done**
- Out of scope closed by M33: commitReveal
- Out of scope closed by M34: open joint UCT
- Out of scope: manual eliminate; OR-arity demo
  preset (schema already accepts `or`)

### M33 — Simultaneous deduction commitReveal

- Schema allows `turn.commitReveal` under simultaneous deduction
  (`autoEliminate: true`; forbids phases / ordered / alternating) — **done**
- Kernel/reducer: `commitQuery` / `commitGuess` + `committedDeduction`;
  matching-kind reveal via `simultaneousQuery` / `simultaneousGuess`;
  observation `pendingCommit` (own only); `ScheduleCommitReveal`
  CellsWritable-only — **done**
- Preset `hidden-simultaneous-guess-who-lite` + transcript/replay tests —
  **done**
- Out of scope: compound commitReveal demo (schema already allows)
- Out of scope closed by M36: joint UCT over commitReveal query cartesian
- Out of scope closed by M37: manual eliminate under commitReveal
  (`commitEliminate`)

### M34 — Joint UCT under simultaneous deduction

- `canSearchJointActions` true for open simultaneous deduction
  (`commitReveal: false`); still false under commitReveal — **done**
- `enumerateJointLegalActions`: kind-matched query×query + guess×guess
  (32 joints on Simultaneous Guess Who Lite / And Lite) — **done**
- `seatComponentFromJoint` / `jointSeatBudget` for
  `simultaneousQuery` / `simultaneousGuess`; UCT + MCTS dual-`act` cache —
  **done**
- Sandbox Agent step composes `jointQueryFromActions` /
  `jointGuessFromActions`; UI labels joint search for open deduction —
  **done**
- Tests: enum counts, dual-act consistency, immediate winning guess, short
  playout; 505 green — **done**
- Out of scope closed by M35: manual eliminate under simultaneous
- Out of scope closed by M36: commitReveal deduction joint UCT

### M35 — Simultaneous deduction manual eliminate

- Schema: allow `autoEliminate: false` under open simultaneous deduction —
  **done** (commitReveal + manual eliminate closed by M37)
- Kernel: `simultaneousEliminate` + manual `simultaneousQuery` (answers, no
  prune); bare eliminate still noop under simultaneous — **done**
- Agents: kind-matched `eliminate×eliminate` → 48 joints; sandbox compose
  `jointEliminateFromActions` — **done**
- Preset `simultaneous-guess-who-commit-lite` + schema/kernel/GameIR/agent
  tests; 519 green — **done**
- Out of scope: simultaneous `turn.phases`; fire→move
- Out of scope closed by M36: commitReveal deduction joint UCT
- Out of scope closed by M37: commitReveal + manual eliminate

### M36 — CommitReveal deduction joint UCT

- `canSearchCommitRevealJoint` + `isFreshCommitRound` honor
  `committedDeduction`; `enumerateCommitRevealJoints` maps
  commitQuery/Guess → simultaneousQuery/Guess (32 joints) — **done**
- `seatCommitFromJoint` emits `commitQuery` / `commitGuess`; UCT + MCTS
  fresh-round plan cache (same round fingerprint as place) — **done**
- `activeCommitSeat({ deduction })` for mid-round tree nodes; sandbox Agent
  labels joint search under hidden deduction — **done**
- Tests: enum counts, partial-commit disable, coordinated sequential commits,
  immediate winning commitGuess (UCT+MCTS), short playout; 525 green — **done**
- Out of scope closed by M37: commitEliminate / commitReveal + manual eliminate
- Out of scope: fire→move (recombination without anchor)

### M37 — CommitEliminate (commitReveal + manual eliminate)

- Schema: allow `autoEliminate: false` under simultaneous deduction
  `commitReveal`; matching-kind `commitEliminate` — **done**
- Reducer: `handleCommitEliminate` → `handleSimultaneousEliminate`; remove
  `handleCommitQuery` autoEliminate guard so manual hidden queries answer
  without prune — **done**
- Kernel: legals/explain/events/format for `commitEliminate`; observation
  `pendingCommit.kind = eliminate` — **done**
- Agents: `commitDeductionAsOpenActions` + `seatCommitFromJoint` map eliminate;
  fresh-round enum **48** joints (16+16+16); UCT fingerprint encodes eliminate
  commits — **done**
- Preset `hidden-simultaneous-guess-who-commit-lite` + engine/agent tests;
  539 green — **done**
- Out of scope: fire→move; simultaneous `turn.phases`; compound commitReveal
  eliminate demo

### M38 — CommitMove (commitReveal under simultaneous move)

- Schema: allow `commitReveal` under simultaneous move; keep
  `actionsPerTurn > 1` forbidden — **done**
- State/events: `committedMoves` + `commitMove`; reducer `handleCommitMove` →
  `handleSimultaneousMove` (clears commits) — **done**
- Kernel: legals/explain/isNoop/stepPly/equality/highlight for `commitMove`;
  observation overlays own destination — **done**
- Agents: `isFreshCommitRound` + `enumerateCommitRevealJoints` map
  `commitMove` → open move; `seatCommitFromJoint` for `simultaneousMove`;
  UCT fingerprint includes `committedMoves` — **done**
- Sandbox: commitReveal+move emits `commitMove`; seat from `committedMoves` —
  **done**
- Preset `hidden-simultaneous-step-race` + tests; 549 green — **done**
- Out of scope closed by M39: multi-action simultaneous move
- Out of scope: commitReveal + replace/slide variants; fire→move

### M39 — Multi-action simultaneous move

- Schema: allow `actionsPerTurn > 1` under open simultaneous move +
  `reach_row` + `range: 1` + no replace (commitReveal multi-move deferred to
  M40) — **done**
- Reducer: `handleSimultaneousMove` budget loop with sequential revalidation
  (same-piece chains; mid-round reach_row win) — **done**
- Kernel: `asMoveList` / `jointMovesFromActions` / legality probe / format /
  equality / `stepPly` chained picks — **done**
- Agents: `orderedMoveChains` + joint enum; `seatComponentFromJoint` /
  `jointSeatBudget` honor move arrays — **done**
- Sandbox: pending move arrays + chain UX — **done**
- Preset `double-simultaneous-step-race` + tests; 563 green — **done**
- Out of scope closed by M40: commitReveal multi-move
- Out of scope: multi-action slide/replace; fire→move

### M40 — CommitReveal + multi-action simultaneous move

- Schema: allow `commitReveal` + `actionsPerTurn > 1` under simultaneous move
  (same foothold: reach_row + range 1 + no replace) — **done**
- State: `committedMoves` as `MovePair[]` per seat; accumulate until budget —
  **done**
- Reducer: `handleCommitMove` probe-chain legality + budget reveal into
  `handleSimultaneousMove` arrays — **done**
- Kernel: budget-aware legals/explain/stepPly; observation multi-dest overlay —
  **done**
- Agents: `enumerateCommitRevealJoints` uses `orderedMoveChains` for budget>1;
  fingerprints/activeCommitSeat array-aware — **done**
- Sandbox: sequential commitMove + chain auto-select — **done**
- Preset `hidden-double-simultaneous-step-race` + tests; 571 green — **done**
- Out of scope: multi-action slide/replace under commitReveal; fire→move

### M41 — Tooling CI

- `.github/workflows/ci.yml` on push/PR to `main` — **done**
- Pin Node `20.19` + pnpm `10.5.2` (`package.json` engines / packageManager) —
  **done**
- Steps: `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` —
  **done**
- Local green gate: 571 tests — **done**

### M42 — Semantics doc refresh

- Rewrite `docs/semantics.md` against current kernel vocabulary — **done**
- Cover GameEvent union, GameState fields, KernelEvent transcript
  (`pieceCaptured`, `queryAnswered`, `guessResult`, `candidateEliminated`, …)
  — **done**
- Cover simultaneous / commitReveal / phases / deduction / movement
  (slide+replace, hex/graph, hop) / joint UCT notes — **done**
- Correct simultaneous×sliding: single-action allowed; multi-action move
  still range=1 / no replace — **done**
- Resolve OPEN_ISSUES `semantics-doc-refresh`; hand off P3
  `next-missing-mechanism` — **done**

### M43 — Jump capture / multi-jump chains

- Schema: `movement.capture = "jump"` (rectangle + alternating; range 1;
  incompatible with simultaneous / phases / actionsPerTurn>1 /
  placement.capture / hex/graph) — **done**
- Kernel: leap over adjacent enemy to empty landing; clear mid;
  `pieceCaptured` at mid; `mustContinueFrom` continues same seat when
  further jumps exist; legality restricted to that piece’s jumps — **done**
- Contract `MovementJumpCapture` + form select + agent fingerprints — **done**
- Preset `jump-race` (diagonal two-jump chain to reach_row) +
  transcript/replay/schema tests — **done**
- Out of scope: mandatory jump-at-turn-start; hex/graph jump; simultaneous
  jump; crowned kings / checkers promotion
- Green gate: 583 tests — **done**

### M44 — Flood-fill region reveal (Minesweeper-lite)

- Schema: `observation.mode = flood_reveal` + `objective.mode = clear_hazards`
  + `hazards.{count,firstRevealSafe}`; rectangle only; lockstep forbids
  hit_miss/fog/deduction/fleet/movement/simultaneous/phases/hex/graph — **done**
- Kernel: `reveal` action; seeded mine layout (deferred when firstRevealSafe);
  adjacent count 0–8; flood through zeros + numbered frontier;
  `cellsRevealed` / `mineHit` events; mine → opponent wins; all safe → draw —
  **done**
- Contracts `ObservationFloodReveal` / `HazardLayout` / `ClearHazards`;
  canvas counts + mine; form options — **done**
- Preset `minesweeper-lite` + transcript/replay/schema tests — **done**
- Out of scope: flags, chord-click, hex/graph adjacency, timers, difficulty
  tiers
- Green gate: 596 tests — **done**

## Sequencing notes

1. Mechanism-first ports only — not “finish `references/`.”  
2. Effect Schema optional later; Zod remains sandbox validator.  
3. Prefer schema honesty over silent no-ops when composition is unsafe.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous
physics first; no arbitrary user code in specs.
