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
| M45 | Next missing mechanism (mandatory jump-at-turn-start) | `done` |
| M46 | Next missing mechanism (memory flip / tile pair-matching) | `done` |
| M47 | Next missing mechanism (hex jump capture) | `done` |
| M48 | Next missing mechanism (graph jump capture) | `done` |
| M49 | Next missing mechanism (crowned promotion / Transform lite) | `done` |
| M50 | Next missing mechanism (forward-only men) | `done` |
| M51 | Next missing mechanism (longest mandatory capture) | `done` |
| M52 | Next missing mechanism (flying kings / crownedRange) | `done` |
| M53 | Next missing mechanism (hex flood_reveal) | `done` |
| M54 | Next missing mechanism (graph flood_reveal) | `done` |
| M55 | Next missing mechanism (flying jump capture) | `done` |
| M56 | Next missing mechanism (hex liberties / Hex Go Lite) | `done` |
| M57 | Next missing mechanism (graph liberties / Graph Go Lite) | `done` |
| M58 | Next missing mechanism (hex promotion / Hex Crowned Jump Lite) | `done` |
| M59 | Next missing mechanism (graph promotion / Graph Crowned Jump Lite) | `done` |
| M60 | Next missing mechanism (hub targetNodes promotion / Graph Hub Crowned Jump Lite) | `done` |
| M61 | Next missing mechanism (hex flying capture / Hex Flying Capture Jump Lite) | `done` |
| M62 | Next missing mechanism (graph flying capture / Graph Flying Capture Jump Lite) | `done` |
| M63 | Next missing mechanism (hex menForwardOnly / Hex Forward Men Jump Lite) | `done` |
| M64 | Next missing mechanism (graph menForwardOnly / Graph Forward Men Jump Lite) | `done` |
| M65 | Next missing mechanism (hub targetNodes + menForwardOnly / Graph Hub Forward Men Jump Lite) | `done` |
| M66 | Next missing mechanism (Go Lite Komi / objective.komi) | `done` |
| M67 | Next missing mechanism (Go Lite Seki / objective.seki) | `done` |
| M68 | Next missing mechanism (Go Lite Dead Stones / objective.deadStones) | `done` |
| M69 | Next missing mechanism (Go Lite Benson / objective.bensonLife) | `done` |
| M70 | Next missing mechanism (Go Lite Dame Fill / objective.dameFill) | `done` |
| M71 | Next missing mechanism (Go Lite Mark Dead / objective.markDead) | `done` |
| M72 | Next missing mechanism (Go Lite Mark Dead Resume / objective.markDeadResume) | `done` |
| M73 | Next missing mechanism (Go Lite Ladders / objective.ladderDeath) | `done` |
| M74 | Next missing mechanism (Go Lite Territory Prisoners / objective.territoryPrisoners) | `done` |
| M75 | Next missing mechanism (Go Lite Semeai / objective.semeaiDeath) | `done` |
| M76 | Next missing mechanism (Go Lite Nakade / objective.nakadeDeath) | `done` |
| M77 | Next missing mechanism (Go Lite Net / objective.netDeath) | `done` |
| M78 | Next missing mechanism (Go Lite Loose Net / objective.looseNetDeath) | `done` |
| M79 | Next missing mechanism (Go Lite Sente Ladder / objective.senteLadderDeath) | `done` |
| M80 | Next missing mechanism (Go Lite Approach Net / objective.approachNetDeath) | `done` |

**Optimizing for this marathon:** M80 Go Lite Approach Net
(`objective.approachNetDeath`) landed. Pick **P3 next-missing-mechanism**
(smallest new seam; reject recombinations without anchor) — without asking
which fork. Large deferred: simultaneous jump / realtime / fuller Go remainder
beyond approach nets (throw-in / connect-and-die).

## Marathon runbook (cloud agents)

### Environment

- Node `>=20.19.0`, package manager **`pnpm@10.5.2`** (`package.json#packageManager`)
- Green gate (every PR / before handoff):

```bash
pnpm install
pnpm typecheck
pnpm test
```

Optional: `pnpm lint`, `pnpm build`. Baseline: **≥852** Vitest tests (do not
delete or weaken tests — see `.cursor/rules/testing-integrity.mdc`).

### Read order (cold start)

1. `SCRATCHPAD.json` → current focus / next_step  
2. `OPEN_ISSUES.md` → **Immediate (prioritized)** top item  
3. This file → Phase 2 board + Do-not-do  
4. `README.md` status only for vocabulary — not as a task list  

### Task selection (no user ask)

1. Work the highest unfinished **P3** item in `OPEN_ISSUES.md`
   (P0–P2 / M8–M51 closed).  
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
**Movement:** form exposes `adjacency` / `range` / `capture` / `mustCapture` /
`mustLongestCapture`;
Replace Race / **Hex Replace Race** / **Graph Replace Race** demonstrate
`capture = replace` on rectangle | hex_offset | graph; **Jump Race** /
**Mandatory Jump Race** demonstrate `capture = jump` on rectangle;
**Mandatory Longest Jump Lite** demonstrates `mustLongestCapture` (Draughts-lite
max-length chain pruning); **Hex Jump Race** demonstrates `capture = jump` on
hex_offset (cube-axis leap-over + `mustContinueFrom` chains); **Graph Jump Race**
demonstrates `capture = jump` on graph (2-edge leap-over + chains);
**Crowned Kings Jump Lite** demonstrates `movement.promotion` (Transform lite —
crown on reach row; crowned adjacency); **Hex Crowned Jump Lite** /
**Graph Crowned Jump Lite** demonstrate promotion on hex/graph via
`targetRows`; **Graph Hub Crowned Jump Lite** demonstrates
`promotion.targetNodes` (hub vs same-row decoy); **Forward Men Jump Lite** demonstrates
`promotion.menForwardOnly` (uncrowned advance toward promo side only;
crowned unrestricted); **Hex Forward Men Jump Lite** / **Graph Forward Men
Jump Lite** / **Graph Hub Forward Men Jump Lite** demonstrate topology-aware
forward filters (hex offset-row; graph row edge-distance; graph hub-key
edge-distance); **Flying Kings Jump Lite** demonstrates
`promotion.crownedRange` (crowned quiet slides longer than men; jump leaps
unchanged); **Flying Capture Jump Lite** demonstrates
`promotion.crownedFlyingCapture` (crowned long-range leap capture within
`crownedRange`); **Hex Flying Capture Jump Lite** demonstrates the same on
`hex_offset` (cube-axis flying leap); **Graph Flying Capture Jump Lite**
demonstrates the same on `graph` (chain-walk flying leap).
**Flood reveal:** **Minesweeper Lite** demonstrates `flood_reveal` +
`clear_hazards` + `hazards` (region open + mine-hit / clear-board terminals);
**Hex Minesweeper Lite** demonstrates the same on `hex_offset` with cube-axis-6
adjacency; **Graph Minesweeper Lite** on `graph` with explicit-edge adjacency.
**Memory:** **Memory Flip Lite** demonstrates `memory_flip` + `flip` +
`match_pairs` + `memory` deck.
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

**Not yet:** fuller Go remainder beyond approach net (M80; e.g. throw-in /
connect-and-die); fire→move
reorder (only with
anchor); realtime scheduler; simultaneous jump. Go Lite Approach Net landed
(M80). Go Lite Sente Ladder landed
(M79). Go Lite Loose Net landed (M78). Go Lite Net landed
(M77). Go Lite Nakade landed
(M76). Go Lite Semeai landed
(M75). Go Lite Territory Prisoners
landed (M74). Go Lite Ladders landed
(M73). Go Lite Mark Dead Resume
landed (M72). Go Lite Mark Dead landed
(M71). Go Lite Dame Fill landed
(M70). Go Lite Benson landed
(M69). Go Lite Dead Stones landed
(M68). Go Lite Seki landed (M67). Go Lite Komi landed (M66).
Graph hub menForwardOnly landed (M65 Graph Hub
Forward Men Jump Lite). Graph menForwardOnly landed (M64 Graph Forward Men
Jump Lite). Hex menForwardOnly landed (M63 Hex Forward Men Jump Lite). Graph
flying capture landed (M62 Graph Flying Capture Jump Lite). Hex flying
capture landed (M61 Hex Flying Capture Jump Lite). Hub-graph promotion
landed (M60 Graph Hub Crowned Jump Lite).
Graph promotion landed (M59 Graph Crowned Jump Lite). Hex promotion
landed (M58 Hex Crowned Jump Lite).
Graph liberties landed (M57 Graph Go Lite). Hex liberties landed
(M56 Hex Go Lite). Flying jump capture landed (M55 Flying Capture Jump
Lite). Graph flood_reveal landed (M54 Graph Minesweeper Lite).
Hex flood_reveal landed (M53 Hex Minesweeper Lite). Flying kings quiet range
landed (M52 Flying Kings Jump Lite). Longest mandatory capture landed (M51
Mandatory Longest Jump Lite). Forward-only men landed (M50 Forward Men Jump
Lite). Crowned promotion landed (M49 Crowned Kings Jump Lite). Graph jump
landed (M48 Graph Jump Race). Hex jump landed (M47 Hex Jump Race).
Mandatory jump-at-turn-start landed (M45 Mandatory Jump Race). CI:
`.github/workflows/ci.yml` (Node 20.19 + pnpm 10.5.2). Semantics:
`docs/semantics.md` (M42; jump in M43; flood_reveal in M44; mustCapture in
M45; memory_flip in M46; hex jump in M47; graph jump in M48; promotion in
M49; menForwardOnly in M50; mustLongestCapture in M51; crownedRange in M52;
hex flood_reveal in M53; graph flood_reveal in M54; crownedFlyingCapture in
M55; hex liberties in M56; hex crownedFlyingCapture in M61; graph
crownedFlyingCapture in M62; hex menForwardOnly in M63; graph menForwardOnly
in M64; hub targetNodes + menForwardOnly in M65; komi in M66; seki in M67;
deadStones in M68; bensonLife in M69; dameFill in M70; markDead in M71;
markDeadResume in M72; ladderDeath in M73; territoryPrisoners in M74;
semeaiDeath in M75; nakadeDeath in M76; netDeath in M77; looseNetDeath in
M78; senteLadderDeath in M79; approachNetDeath in M80).

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
- Out of scope closed by M45: mandatory jump-at-turn-start
- Out of scope closed by M47: hex jump
- Out of scope closed by M48: graph jump
- Out of scope: simultaneous jump; crowned kings / checkers promotion
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

### M45 — Mandatory jump-at-turn-start (`mustCapture`)

- Schema: `movement.mustCapture` (requires `capture = jump`) — **done**
- Kernel/reducer: when any jump exists for the acting seat at turn start,
  legal moves = jumps only; quiet moves ignored; mid-chain
  `mustContinueFrom` unchanged; when no jumps exist, quiet moves remain
  legal — **done**
- Contract invariant `mustCaptureForbidsQuietWhenJumpExists`; form Switch —
  **done**
- Preset `mandatory-jump-race` (quiet escape + jump both exist; only jump
  legal) + contrast vs optional jump + transcript/replay/schema tests —
  **done**
- Out of scope: longest-chain rule; crowned kings / promotion; graph /
  simultaneous jump (hex closed by M47)
- Green gate: 602 tests — **done**

### M46 — Memory flip / tile pair-matching

- Schema: `observation.mode = memory_flip` + `input.mode = flip` +
  `objective.mode = match_pairs` + `memory` block — **done**
- Kernel: flip two tiles; match scores; mismatch re-hides; `mem:N` CellValue
  marks — **done**
- Preset `memory-flip-lite` + transcript/replay/schema tests — **done**
- Green gate: 614 tests — **done**

### M47 — Hex jump capture

- Schema: `movement.capture = "jump"` accepts `rectangle | hex_offset`;
  graph still rejected; hex requires orthogonal (cube-axis); same
  M43/M45 incompatibilities (simultaneous, phases, actionsPerTurn>1,
  range=1, no placement.capture) — **done**
- Movement: `jumpMid` / `jumpDestinations` / `isJumpCapture` /
  `hasAnyJumpCapture` / `legalDestinations` topology-aware for hex
  cube-axis double steps; reducer/kernel mid clear + `pieceCaptured`
  unchanged via board-aware `jumpMid` — **done**
- Form: jump select enabled on hex_offset; helper copy updated — **done**
- Preset `hex-jump-race` (cube-axis two-jump chain to reach_row) +
  helper/schema/transcript/replay tests — **done**
- Out of scope closed by M48: graph jump
- Out of scope: simultaneous jump; crowned kings / promotion
- Green gate: 622 tests — **done**

### M48 — Graph jump capture

- Schema: `movement.capture = "jump"` accepts `rectangle | hex_offset |
  graph`; incompatible with `graphReach = hop`; same M43/M45
  incompatibilities (simultaneous, phases, actionsPerTurn>1, range=1,
  no placement.capture) — **done**
- Movement: `jumpMid` / `jumpDestinations` / `isJumpCapture` /
  `hasAnyJumpCapture` / `legalDestinations` topology-aware for graph
  2-edge leap over enemy mid node; reducer/kernel unchanged via
  board-aware helpers — **done**
- Form: jump select enabled on graph; helper copy updated — **done**
- Preset `graph-jump-race` (lane two-jump chain to reach_row) +
  helper/schema/transcript/replay tests — **done**
- Out of scope: simultaneous jump; crowned kings / promotion
- Green gate: 630 tests — **done**

### M49 — Crowned kings / promotion (Transform lite)

- Schema: optional `movement.promotion` (`targetRows` + `crownedAdjacency`
  default king); requires `capture = jump`, `input.mode = move`, rectangle,
  alternating, range 1; same jump incompatibilities (no simultaneous,
  phases, actionsPerTurn>1, placement.capture); reject hex/graph — **done**
- Types: `CrownMark` (`X+`|`O+`) on `CellValue`; helpers `cellOwner` /
  `isCrowned` / `promote` / `isPieceMark` — **done**
- Movement: `effectiveMovement` (crowned → crownedAdjacency); jump/quiet
  legality + mustCapture scans via `cellOwner` — **done**
- Reducer/kernel: preserve crown on move; promote on land; `piecePromoted`
  event; crowned mid-capture clears with `pieceCaptured` owner — **done**
- Contract `MovementPromotion`; preset `crowned-jump-race` (Crowned Kings
  Jump Lite — mustCapture jump promotes on row 1, then crowned orthogonal
  to win row 0; promo ≠ win so crowned adjacency is playable); canvas crowns;
  form JSON note — **done**
- Out of scope: simultaneous jump; forward-only men; longest-chain;
  hex/graph promotion
- Green gate: ≥641 tests — **done**

### M50 — Forward-only men (Checkers-lite direction)

- Schema: optional `movement.promotion.menForwardOnly` (boolean); inherits
  promotion constraints (rectangle jump, alternating, range 1) — **done**
- Movement: `manForwardRowSign` / `pieceAdjacencyDeltas` /
  `filterMenForwardDestinations`; uncrowned quiet + jump filtered to
  forward row-delta; crowned ignores filter — **done**
- Normalize passes `menForwardOnly`; contract invariant
  `menForwardOnlyRestrictsUncrowned` — **done**
- Preset `forward-men-jump-lite` (Forward Men Jump Lite — mustCapture
  forward jump promotes, crowned retreat/ortho win); form JSON note;
  transcript/replay + helper tests — **done**
- Out of scope: longest-chain mandatory; hex/graph promotion; simultaneous
- Green gate: ≥649 tests — **done**

### M51 — Longest mandatory capture (Draughts-lite)

- Schema: optional `movement.mustLongestCapture` (boolean); requires
  `capture = jump` and `mustCapture = true`; same jump topology /
  incompatibility rules — **done**
- Movement: `maxJumpChainFrom` / `jumpChainLengthThrough` /
  `globalMaxJumpCaptures` / `isMaximalJumpStart` /
  `isMaximalJumpContinuation` (DFS over simulated jump clears) — **done**
- Kernel/reducer: turn-start prune non-max chains; mid-chain prune shorter
  remaining branches; contract invariant
  `mustLongestCapturePrunesShorterChains` — **done**
- Normalize + form switch; preset `mandatory-longest-jump-lite`
  (Mandatory Longest Jump Lite — 1-capture vs 2-capture opening; only
  longest legal) + helper/schema/transcript/replay tests — **done**
- Out of scope: hex/graph promotion; simultaneous jump; flying kings
- Green gate: ≥658 tests — **done**

### M52 — Flying kings / crowned quiet range

- Schema: optional `movement.promotion.crownedRange` (int 1–8); men keep
  `movement.range = 1` under jump; inherits promotion constraints
  (rectangle jump, alternating) — **done**
- Movement: `effectiveMovement` sets crowned `range` from `crownedRange`;
  jump-mode quiet slides use `eff.range` (no longer hardcode 1); jump leap
  distance unchanged (no flying capture) — **done**
- Normalize passes `crownedRange`; contract invariant
  `crownedUsesCrownedRange`; form JSON note — **done**
- Preset `flying-kings-jump-lite` (Flying Kings Jump Lite — mustCapture jump
  promotes on row 2; crowned diagonal `crownedRange: 2` slides to win row 0;
  men / `crownedRange` omitted cannot) + helper/schema/transcript/replay
  tests — **done**
- Out of scope: flying jump capture; hex/graph promotion; simultaneous jump
- Green gate: ≥667 tests — **done**

### M53 — Hex flood_reveal / cube-axis hazard adjacency

- Schema: `flood_reveal` on `rectangle | hex_offset` (graph still deferred);
  hex foothold accepts `flood_reveal` + `clear_hazards` — **done**
- Hazards: `hazardNeighbors` / `adjacentHazardCount` / `floodRevealRegion`
  topology-aware (Chebyshev-8 vs cube-axis-6); reducer passes topology —
  **done**
- Preset `hex-minesweeper-lite` (Hex Minesweeper Lite) + helper / schema /
  transcript / replay tests — **done**
- Form observation helper notes hex adjacency — **done**
- Out of scope: graph flood_reveal; flags/chords; wrap
- Green gate: ≥674 tests — **done**

### M54 — Graph flood_reveal / explicit-edge hazard adjacency

- Schema: `flood_reveal` on `rectangle | hex_offset | graph`; graph foothold
  accepts `flood_reveal` + `clear_hazards`; max degree ≤ 8; `hazards.count`
  vs active node count — **done**
- Hazards: graph adjacency via `neighborsOf`; active-only mine placement;
  `allSafeRevealed` ignores inactive cells; reducer/kernel pass `graph` —
  **done**
- Preset `graph-minesweeper-lite` (Graph Minesweeper Lite) + helper /
  schema / transcript / replay tests — **done**
- Form observation helper notes graph edges — **done**
- Out of scope: flags/chords; wrap; degree > 8
- Green gate: ≥682 tests — **done**

### M55 — Flying jump capture / crownedFlyingCapture

- Schema: optional `movement.promotion.crownedFlyingCapture` (bool); requires
  `crownedRange >= 2`; inherits promotion constraints (rectangle jump,
  alternating) — **done**
- Movement: crowned pieces ray-walk empty approach + long land within
  `crownedRange`; men stay adjacent leaps; `jumpMid` finds unique enemy on
  ray; chains / mustCapture unchanged — **done**
- Normalize passes `crownedFlyingCapture`; contract invariant
  `crownedFlyingCaptureExtendsJumpRays`; form JSON note — **done**
- Preset `flying-capture-jump-lite` (Flying Capture Jump Lite — mustCapture
  jump promotes on row 3; mustContinueFrom chain; adjacent land ≠ win;
  flying land to win row 0) + helper/schema/transcript/replay tests — **done**
- Out of scope: hex/graph flying capture; simultaneous jump; multi-jump
  direction-change demos beyond existing chains
- Green gate: ≥692 tests — **done**

### M56 — Hex liberties / Hex Go Lite

- Schema: hex foothold allows `capture.mode = liberties` + `area_control`
  (cube-axis-6); flip/gravity capture still forbidden on hex — **done**
- Liberties helpers: `libertyNeighbors` / topology-threaded group capture +
  area scoring; rectangle stays von Neumann-4 — **done**
- Reducer/kernel pass `config.topology` into liberty legality / capture /
  pass scoring — **done**
- Preset `hex-go-lite` (Hex Go Lite) + unit / schema / transcript / replay
  tests — **done**
- Out of scope: graph Go; komi/seki; hex superko preset variants; hex
  promotion
- Green gate: ≥699 tests — **done**

### M57 — Graph liberties / Graph Go Lite

- Schema: graph foothold allows `capture.mode = liberties` + `area_control`
  (explicit-edge); flip/gravity capture still forbidden on graph — **done**
- Liberties helpers: `libertyNeighbors` graph branch + `graph` threaded
  through group capture / legality / `scoreArea` (active nodes only) — **done**
- Reducer/kernel pass `config.graph` into liberty legality / capture /
  pass scoring — **done**
- Preset `graph-go-lite` (Graph Go Lite, bridge graph) + unit / schema /
  transcript / replay tests — **done**
- Out of scope: full Go; graph superko preset variants; hex/graph promotion
- Green gate: ≥707 tests — **done**

### M58 — Hex promotion / Hex Crowned Jump Lite

- Schema: `movement.promotion` on `hex_offset` + jump; require
  `crownedAdjacency = orthogonal`; forbid `menForwardOnly` /
  `crownedFlyingCapture` / graph — **done**
- Kernel: hex legalDestinations already honor crowned `crownedRange` when
  adjacency is orthogonal (default king would yield `[]`) — **done**
- Preset `hex-crowned-jump-lite` (Hex Crowned Jump Lite) + schema /
  movement / transcript / replay tests — **done**
- Out of scope: graph promotion; hex flying capture; hex menForwardOnly;
  simultaneous jump
- Green gate: ≥716 tests — **done**

### M59 — Graph promotion / Graph Crowned Jump Lite

- Schema: `movement.promotion` on `graph` + jump; require
  `crownedAdjacency = orthogonal`; forbid `menForwardOnly` /
  `crownedFlyingCapture` — **done**
- Kernel: graph legalDestinations already honor crowned `crownedRange` when
  adjacency is orthogonal (default king would yield `[]`) — **done**
- Preset `graph-crowned-jump-lite` (Graph Crowned Jump Lite) + schema /
  movement / transcript / replay tests — **done**
- Out of scope: hub `targetNodes` promotion geometry; graph flying capture;
  graph menForwardOnly; simultaneous jump
- Green gate: ≥726 tests — **done**

### M60 — Hub-graph promotion / Graph Hub Crowned Jump Lite

- Schema: `movement.promotion.targetNodes` (`"row,col"` per seat) on `graph`
  + jump; mutually exclusive with `targetRows`; keys must be active nodes;
  rectangle/hex reject `targetNodes` — **done**
- Kernel: `landsOnPromotionTarget` — promote on exact node key match (not
  every co-row node) — **done**
- Preset `graph-hub-crowned-jump-lite` (Graph Hub Crowned Jump Lite) + schema /
  movement / transcript / replay / decoy-contrast tests — **done**
- Out of scope: hex/graph flying capture; hex/graph menForwardOnly;
  simultaneous jump; full Go; realtime
- Green gate: ≥737 tests — **done**

### M61 — Hex flying capture / Hex Flying Capture Jump Lite

- Schema: allow `crownedFlyingCapture` on `hex_offset` + jump promotion;
  keep graph forbid; require `crownedRange >= 2` + orthogonal
  `crownedAdjacency` — **done**
- Kernel: hex `jumpDestinations` / `jumpMid` cube-axis ray flying capture
  (mirror rectangle M55; men stay adjacent-only) — **done**
- Preset `hex-flying-capture-jump-lite` (Hex Flying Capture Jump Lite) +
  schema / movement / transcript / replay tests — **done**
- Out of scope: graph flying capture; hex/graph menForwardOnly;
  simultaneous jump; full Go; realtime
- Green gate: ≥747 tests — **done**

### M62 — Graph flying capture / Graph Flying Capture Jump Lite

- Schema: allow `crownedFlyingCapture` on `graph` + jump promotion;
  require `crownedRange >= 2` + orthogonal `crownedAdjacency` — **done**
- Kernel: graph `jumpDestinations` / `jumpMid` chain-walk ray flying capture
  (mirror hex M61 / rectangle M55; men stay 2-edge-only; junctions stop rays)
  — **done**
- Preset `graph-flying-capture-jump-lite` (Graph Flying Capture Jump Lite) +
  schema / movement / transcript / replay / junction tests — **done**
- Out of scope: hex menForwardOnly (closed M63); graph menForwardOnly;
  simultaneous jump; full Go; realtime
- Green gate: ≥758 tests — **done**

### M63 — Hex menForwardOnly / Hex Forward Men Jump Lite

- Schema: allow `menForwardOnly` on `hex_offset` + jump promotion +
  `targetRows` (graph still forbidden — needs edge-distance forward
  geometry) — **done**
- Kernel: hex `legalDestinations` / `jumpDestinations` filter uncrowned
  quiet ∪ jump lands by offset-row sign (`filterMenForwardDestinations`;
  same `manForwardRowSign` as rectangle M50); crowned unrestricted — **done**
- Preset `hex-forward-men-jump-lite` (Hex Forward Men Jump Lite) + schema /
  movement / transcript / replay tests — **done**
- Out of scope: graph menForwardOnly; simultaneous jump; full Go; realtime
- Green gate: ≥764 tests — **done**

### M64 — Graph menForwardOnly / Graph Forward Men Jump Lite

- Schema: allow `menForwardOnly` on `graph` + jump promotion + `targetRows`
  (`targetNodes` hubs still deferred) — **done**
- Kernel: graph `legalDestinations` / `jumpDestinations` filter uncrowned
  quiet ∪ jump lands by strict decrease in shortest-path edge distance to
  any node on `targetRows[seat]` (`graphMinEdgeDistToPromoRow` /
  `isForwardGraphStep`); crowned unrestricted — **done**
- Preset `graph-forward-men-jump-lite` (Graph Forward Men Jump Lite) + schema /
  movement / edge-distance≠row-delta / transcript / replay tests — **done**
- Out of scope: targetNodes + menForwardOnly; simultaneous jump; full Go;
  realtime
- Green gate: ≥775 tests — **done**

### M65 — Hub targetNodes + menForwardOnly / Graph Hub Forward Men Jump Lite

- Schema: allow `menForwardOnly` on `graph` + jump promotion + `targetNodes`
  (rectangle | hex_offset still require `targetRows`) — **done**
- Kernel: `graphMinEdgeDistToTargetNode` + `isForwardGraphStep` hub branch;
  `filterMenForwardDestinations` applies when only `targetNodes` is set;
  strict hub-distance decrease (same-row decoy blocked; row-mode still
  allows both) — **done**
- Preset `graph-hub-forward-men-jump-lite` (Graph Hub Forward Men Jump Lite) +
  schema / hub≠row-delta / transcript / replay tests — **done**
- Out of scope: simultaneous jump; full Go; realtime
- Green gate: ≥775 + new cases — **done**

### M66 — Go Lite Komi / `objective.komi`

- Schema: optional `objective.komi` (non-negative ≤100); require
  `objective.mode = area_control` — **done**
- Kernel: `areaOutcome` adds komi to O (second-player compensation); pass
  terminal threads `config.komi`; normalize pass-through — **done**
- Preset `go-lite-komi` (Go Lite Komi, komi 0.5) + unit / schema /
  empty double-pass transcript / replay tests; form exposes komi under
  area_control — **done**
- Out of scope: seki; dead-stone scoring; simultaneous jump; realtime
- Green gate: ≥788 + new cases — **done**

### M67 — Go Lite Seki / `objective.seki`

- Schema: optional `objective.seki` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `findSekiNeutralCells` + `scoreArea` exclusion; `areaOutcome`
  threads `sekiScoring`; pass terminal + normalize pass-through — **done**
- Preset `go-lite-seki` (seeded mutual-life; without seki X wins, with seki
  draw) + unit / schema / transcript / replay tests; form switch under
  area_control — **done**
- Out of scope: dead-stone removal; hex/graph seki presets; groups with
  ≥2 private liberties; simultaneous jump; realtime
- Green gate: ≥788 + new cases — **done**

### M68 — Go Lite Dead Stones / `objective.deadStones`

- Schema: optional `objective.deadStones` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `findDeadStoneCells` / `removeDeadStones` (interior groups with
  fewer than 2 true eyes; edge foothold kept; seki clusters exempt);
  `areaOutcome` threads flag; normalize pass-through — **done**
- Preset `go-lite-dead-stones` (7×7 thin O ring + interior X; without removal
  X wins, with removal O wins) + unit / schema / transcript / replay tests;
  form switch under area_control — **done**
- Out of scope: full Benson search; multi-eye shared sets beyond per-group
  true eyes; hex/graph dead-stone presets; simultaneous jump; realtime
- Green gate: ≥798 + new cases — **done**

### M69 — Go Lite Benson / `objective.bensonLife`

- Schema: optional `objective.bensonLife` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `findBensonAliveGroupIds` / `findBensonDeadStoneCells` /
  `removeBensonDeadStones` (vital-region fixed point; edge foothold + seki
  kept); `areaOutcome` threads flag (supersedes `deadStones` when both set);
  normalize pass-through — **done**
- Preset `go-lite-benson` (dual one-eyed X groups sharing a corridor; deadStones
  draws, Benson X wins) + unit / schema / transcript / replay tests; form
  switch under area_control — **done**
- Out of scope: fuller Go / semantic life-death search; hex/graph Benson
  presets; simultaneous jump; realtime
- Green gate: ≥798 + new cases — **done**

### M70 — Go Lite Dame Fill / `objective.dameFill`

- Schema: optional `objective.dameFill` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `findDameCells`; `endgamePhase` state; first pass while dame remain
  enters damezukai-lite endgame (dame-only places + pass); two consecutive
  passes in endgame score via existing `areaOutcome` stack; normalize
  pass-through — **done**
- Preset `go-lite-dame-fill` (X eye + mixed dame corridor; territory illegal
  after pass, dame fill then score) + unit / schema / transcript / replay
  tests; form switch under area_control — **done**
- Out of scope: interactive dead-stone negotiation; semantic life-death
  search; hex/graph dame-fill presets; simultaneous jump; realtime
- Green gate: ≥802 + new cases — **done**

### M71 — Go Lite Mark Dead / `objective.markDead`

- Schema: optional `objective.markDead` boolean; require
  `objective.mode = area_control`; forbid `turn.schedule = simultaneous` —
  **done**
- Kernel: `markingPhase` + `markedDead` state; `markDead` action toggles
  opponent groups; two consecutive passes enter marking (after dameFill if
  set); two consecutive passes in marking remove marked stones then
  `areaOutcome`; normalize + form switch — **done**
- Preset `go-lite-mark-dead` (O ring + lone X; mark flips winner) + unit /
  schema / transcript / replay tests — **done**
- Out of scope: resume-on-dispute; semantic life-death search; simultaneous
  marking; hex/graph mark-dead presets; simultaneous jump; realtime
- Green gate: ≥813 + new cases — **done**

### M72 — Go Lite Mark Dead Resume / `objective.markDeadResume`

- Schema: optional `objective.markDeadResume` boolean; require
  `objective.markDead = true` + `area_control`; forbid simultaneous — **done**
- Kernel: `rejectMarks` action exits `markingPhase`, clears `markedDead`,
  keeps rejecter initiative, grid unchanged; legal only when marks non-empty;
  re-entry via later double-pass unchanged; normalize + form switch + Reject
  marks button — **done**
- Preset `go-lite-mark-dead-resume` (same O-ring seed; dispute → resume →
  score without removal) + schema / transcript / replay tests — **done**
- Out of scope: semantic life-death search; hex/graph mark-dead-resume
  presets; simultaneous jump; realtime
- Green gate: ≥813 + new cases — **done**

### M73 — Go Lite Ladders / `objective.ladderDeath`

- Schema: optional `objective.ladderDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isLadderDeadGroup` / `findLadderDeadCells` /
  `removeLadderDeadStones`; attacker-sente atari-run via
  `simulateLibertyPlace`; `areaOutcome` applies after optional
  Benson/deadStones; edge foothold does not save runners; normalize + form
  switch — **done**
- Preset `go-lite-ladders` (edge atari X; draw without flag → O with flag) +
  unit / schema / transcript / replay tests — **done**
- Out of scope: full L&D / nakade / nets / ko-alive / semeai; hex/graph ladder
  presets; territory+prisoners; simultaneous jump; realtime
- Green gate: ≥823 + new cases — **done**

### M74 — Go Lite Territory Prisoners / `objective.territoryPrisoners`

- Schema: optional `objective.territoryPrisoners` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `scoreTerritory`; `GameState.prisoners` tallied on liberty capture;
  `areaOutcome` branches to territory + prisoners (Japanese lite) vs stones +
  territory; normalize + form switch — **done**
- Preset `go-lite-territory-prisoners` (O captures 3-stone atari then
  double-pass; area awards X → territory+prisoners awards O) + unit / schema /
  transcript / replay tests — **done**
- Out of scope: full Japanese rules (group tax / root scoring / disputes);
  nakade / nets; hex/graph territoryPrisoners presets; simultaneous
  jump; realtime
- Green gate: ≥828 + new cases — **done**

### M75 — Go Lite Semeai / `objective.semeaiDeath`

- Schema: optional `objective.semeaiDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `findSemeaiDeadCells` / `removeSemeaiDeadStones` — group dies when it
  shares ≥1 liberty with an opposing group that has strictly more liberties;
  equal counts kept; `areaOutcome` applies after Benson/deadStones and before
  ladderDeath; normalize + form switch — **done**
- Preset `go-lite-semeai` (X race 3 libs vs O 4; living X mass; raw → X, with
  flag → O) + unit / schema / transcript / replay / contrast tests — **done**
- Out of scope: full L&D / nakade / nets / multi-group race trees; hex/graph
  semeai presets; simultaneous jump; realtime
- Green gate: ≥832 + new cases — **done**

### M76 — Go Lite Nakade / `objective.nakadeDeath`

- Schema: optional `objective.nakadeDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isNakadeVulnerableRegion` / `findNakadeDeadCells` /
  `removeNakadeDeadStones` — T1 (3-straight) mono-border big-eye; vital =
  middle; remove interior groups that would have <2 true eyes after opponent
  vital fill; seki + edge exempt; `areaOutcome` after semeaiDeath before
  ladderDeath; normalize + form switch — **done**
- Preset `go-lite-nakade` (closed 3-corridor + 1 true eye X shell; living edge
  O; raw/Benson → X, with flag → O) + unit / schema / transcript / replay /
  contrast tests — **done**
- Out of scope: L / 4+ / bulky nakade table; nets; hex/graph nakade presets;
  simultaneous jump; realtime
- Green gate: ≥836 + new cases — **done**

### M77 — Go Lite Net / `objective.netDeath`

- Schema: optional `objective.netDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isNetDeadGroup` / `findNetDeadCells` / `removeNetDeadStones` —
  root exactly 3 liberties; every defender liberty extension has an attacker
  liberty-fill reply that captures, ladders, or re-nets; edge does not save;
  `areaOutcome` after nakadeDeath before ladderDeath; normalize + form
  switch — **done**
- Preset `go-lite-net` (edge geta X pair; living X mass + O bulk; raw → X,
  with flag → O; contrasts vs deadStones / Benson / nakade / ladder / seki) +
  unit / schema / transcript / replay tests — **done**
- Out of scope: open 4+ liberty fights; loose nets / throw-ins; hex/graph net
  presets; simultaneous jump; realtime
- Green gate: ≥840 + new cases — **done**

### M78 — Go Lite Loose Net / `objective.looseNetDeath`

- Schema: optional `objective.looseNetDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isLooseNetDeadGroup` / `findLooseNetDeadCells` /
  `removeLooseNetDeadStones` — root exactly 4 liberties; same escape/reply
  search as netDeath; edge does not save; `areaOutcome` after netDeath before
  ladderDeath; normalize + form switch — **done**
- Preset `go-lite-loose-net` (edge loose geta X pair; living X mass + O bulk;
  raw → X, with flag → O; contrasts vs netDeath / deadStones / Benson /
  nakade / ladder / seki) + unit / schema / transcript / replay tests —
  **done**
- Out of scope: throw-in / approach-move nets; open 5+ liberty fights;
  hex/graph loose-net presets; simultaneous jump; realtime
- Green gate: ≥844 + new cases — **done**

### M79 — Go Lite Sente Ladder / `objective.senteLadderDeath`

- Schema: optional `objective.senteLadderDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isSenteLadderDeadGroup` / `findSenteLadderDeadCells` /
  `removeSenteLadderDeadStones` — root exactly 3 liberties; multi-stone
  (≥2); some attacker liberty-fill captures or leaves a ladder; edge does
  not save; `areaOutcome` after looseNetDeath before ladderDeath; normalize
  + form switch — **done**
- Preset `go-lite-sente-ladder` (open cage vs go-lite-net; defender-first
  netDeath misses; raw → X, with flag → O; contrasts vs net/loose/ladder /
  nakade / deadStones / Benson / seki) + unit / schema / transcript / replay
  tests — **done**
- Out of scope: single-stone 3-lib shapes; throw-in / snapback continuation;
  off-liberty approach generator; connect-and-die; root-4 sente-to-ladder;
  hex/graph ports; simultaneous jump; realtime
- Green gate: ≥848 + new cases — **done**

### M80 — Go Lite Approach Net / `objective.approachNetDeath`

- Schema: optional `objective.approachNetDeath` boolean; require
  `objective.mode = area_control` — **done**
- Kernel: `isApproachNetDeadGroup` / `findApproachNetDeadCells` /
  `removeApproachNetDeadStones` — root exactly 3 or 4 liberties; multi-stone
  (≥2); not already net/loose/sente/ladder dead; some non-liberty approach
  place makes net or loose-net dead; edge does not save; `areaOutcome` after
  senteLadderDeath before ladderDeath; normalize + form switch — **done**
- Preset `go-lite-approach-net` (open loose cage vs go-lite-loose-net; drop
  O@(1,4); add O@(3,6); approach completes loose net; raw → X, with flag → O;
  contrasts vs net/loose/sente/ladder / nakade / deadStones / Benson / seki)
  + unit / schema / transcript / replay tests — **done**
- Out of scope: throw-in / snapback / connect-and-die; hex/graph approach-net
  presets; simultaneous jump; realtime
- Green gate: ≥852 + new cases — **done**

## Sequencing notes

1. Mechanism-first ports only — not “finish `references/`.”  
2. Effect Schema optional later; Zod remains sandbox validator.  
3. Prefer schema honesty over silent no-ops when composition is unsafe.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous
physics first; no arbitrary user code in specs.
