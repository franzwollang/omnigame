# OmniGame Formal Semantics (Draft)

Compact formal model for feature composition, conflicts, and invariants.
Grounded in `src/engine/types.ts`, `reducer.ts`, `kernel.ts`, `contracts.ts`,
`movement.ts`, `capture.ts`, `liberties.ts`, `deduction.ts`, and
`src/schemas/config.ts`. Evolves with new mechanics.

## 1. Core Syntax

- Players: P = {X, O}
- Cell marks: CellValue = P ∪ {hit, miss, ∅}
- Grid: G = (W, H, cells) with cells ∈ CellValue^{W×H}; optional owner-only
  hidden fleet layer H
- Topology: rectangle | hex_offset | graph (explicit edges)
- Status: S ∈ {playing, won, draw}; winner ∈ P ∪ {∅} (separate from S)
- Fleet phase: phase ∈ {placement, combat} (hit_miss games)
- State σ = GameState:
  - core: (G, H?, currentPlayer, S, winner, moveCount)
  - budget: actionsRemaining? (alternating multi-step)
  - delayed: pendingPlaces? (cell | column | row + resolveAt)
  - go-lite: consecutivePasses?, koPoint?, positionHistory?
  - fleet: phase?, fleetProgress?
  - simultaneous buffers: committedPlacements?, committedMoves?,
    committedDeduction?
  - in-turn: turnPhaseIndex? (index into turn.phases)
  - jump chain: mustContinueFrom? (landing cell when further jumps exist)
  - deduction?: { secret, eliminated, lastQuery?, lastQueries? }
- Config κ drives guards (input, placement, capture, movement, schedule,
  observation, objective, phases, deduction, …)

### 1.1 Reducer events ε (`GameEvent`)

| Event | Payload (brief) |
|---|---|
| place | position |
| move | from, to |
| fire | position |
| reveal | position (flood_reveal / Minesweeper-lite) |
| flip | position (memory_flip / Memory Flip Lite) |
| activateColumn / activateRow | col / row |
| popOutColumn / popOutRow | col / row |
| tick | — |
| pass | — |
| simultaneousPlace | placements {X,O}: Position \| Position[] |
| simultaneousMove | moves {X,O}: MovePair \| MovePair[] |
| simultaneousQuery | queries {X,O}: QueryEvent |
| simultaneousGuess | guesses {X,O}: id |
| simultaneousEliminate | eliminations {X,O}: id |
| commitPlace | player, position |
| commitMove | player, from, to |
| commitQuery | player, query |
| commitGuess / commitEliminate | player, id |
| query | trait+value \| clauses (+ op and\|or) |
| guess / eliminate | id |
| reset | — |

Supporting: MovePair = {from, to}; QueryClause = {trait, value};
CommittedDeduction = query \| guess \| eliminate.

### 1.2 Kernel transcript events (`KernelEvent`)

Not reducer inputs — emitted by `GameKernel.step` / `stepJoint`:

- `actionApplied` — accepted KernelAction + actor (P | simultaneous)
- `shotResult` — fire mark (hit \| miss)
- `cellsRevealed` — flood_reveal positions + counts (0–8)
- `mineHit` — flood_reveal exploded mine at position
- `tilesFlipped` — memory_flip face-up positions + symbols
- `pairResolved` — memory_flip match/mismatch outcome (+ scorer on match)
- `pieceCaptured` — replace capture at destination; jump capture at mid cell
- `queryAnswered` — trait/clauses + boolean answer
- `guessResult` — targetId + correct
- `candidateEliminated` — pruned roster id
- `phaseChanged` — placement ↔ combat
- `tickApplied` — Life generation
- `ignored` — IllegalReason
- `terminal` — status + winner

IllegalReason includes: game_over, wrong_player, cell_occupied, must_flip,
suicide, ko, superko, own_ship, column_full, row_full, no_own_piece,
invalid_destination, mode_mismatch, not_applicable, illegal_or_noop,
ship_shape, wrong_phase, already_committed.

## 2. Small-step Transition Relation

σ —ε→ σ' is partial. Conceptual phases (`PhaseHook` in contracts):

1. validateInput(σ, ε, κ) ⇒ ok | err
2. applyPlacement(σ, ε) ⇒ σ₁
3. applyEffects(σ₁) ⇒ σ₂  // capture, overflow, pending resolve, tick
4. checkEnd(σ₂) ⇒ σ₃
5. nextTurn(σ₃) ⇒ σ'

Reducer implements these inline; illegal/no-op leaves σ unchanged (kernel
detects via `isNoop`).

### 2.1 Handoff

- Alternating, budget 1: flip currentPlayer
- Alternating, actionsPerTurn > 1: decrement actionsRemaining; handoff when 0
- turn.phases set: advance turnPhaseIndex; after last phase → flip + reset index
- Simultaneous: currentPlayer unchanged; joint events advance moveCount;
  commit buffers clear on reveal
- tick: global update; no player flip
- pass: consecutivePasses++; may terminal (area_control)

### 2.2 Simultaneous resolve

- resolveOrder = joint (default): same-cell place → neither; same-dest move →
  neither; move paths checked on vacated-origin board; replace needs
  `movement.capture = replace` for stationary enemies
- resolveOrder = x_first | o_first: sequential apply; first seat wins
  same-cell; ordered paths/captures revalidated after first apply

### 2.3 Commit-reveal

Under commitReveal + simultaneous: per-seat private commits until budget full
→ auto-reveal as joint event. Deduction commits require matching kind
(query×query, guess×guess, eliminate×eliminate).

## 3. Features as Machine Slices

Feature F = (Req, Prov, Slot, Pre, Post, Inv, Hooks).

Capabilities: ResolvedCell, TargetLine, Adjacency, CellsWritable, EndCondition.

Slots:

- PlacementPolicy ∈ {direct, gravity, move}
- EndCondition ∈ {nInARow, destroyHidden, connectOrDestroy, reachRow,
  areaControl, identifySecret, none}
- Schedule ∈ {alternating, manualTick, simultaneous}

Hooks: validateInput | applyPlacement | applyEffects | checkEnd | nextTurn.

Registry: `src/engine/contracts.ts` (`Contracts.*`, `checkContracts`).

Examples (informal):

- PlacementGravity — Slot PlacementPolicy=gravity; Hook applyPlacement
- Capture (flip) / LibertyCapture — Hook applyEffects; ko/superko guards
- MovementReplaceCapture — replace clears enemy then lands; path empty except
  dest; joint/ordered simultaneous replace invariants
- ScheduleSimultaneous / CommitReveal / MultiAction / InTurnPhases — schedule
  protocol
- InputDeduction / IdentifySecret / ObservationDeduction — query/guess/eliminate
- TopologyHex / TopologyGraph — non-rect boards

## 4. Composition

F ⊕ G valid iff Req satisfied, slots disjoint (or ordered), Pre satisfiable,
Invs preserved. Primary enforcement: Zod `superRefine` + reducer guards.

### 4.1 Notable composition rules (current)

- commitReveal ⇒ schedule = simultaneous
- resolveOrder ≠ joint ⇒ schedule = simultaneous
- turn.phases ⇒ alternating only; forbids simultaneous, commitReveal,
  actionsPerTurn > 1, delayTurns > 0
- Board phases: [place,move] | [place,fire] | [place,move,fire]
  (connect_or_destroy + hit_miss) | [move,fire] (destroy_hidden + seeds)
- Deduction phases: [query,eliminate] | [query,guess] |
  [query,eliminate,guess]; eliminate phase ⇒ autoEliminate = false
- Simultaneous place: cell + n_in_a_row; no capture/gravity
- Simultaneous move: reach_row foothold; **single-action** allows sliding
  (range > 1) and replace; **multi-action** (actionsPerTurn > 1) requires
  range = 1 and no replace
- Simultaneous deduction: joint only; queryShape ∈ {single, and, or};
  optional commitReveal / manual eliminate
- Hex/graph sliding and replace: supported (cube axes / chain-walk or hop-ball)

## 5. Conflict Definition

A feature set conflicts iff:

- Capability unsatisfied or slot contention without ordering
- Schema UNSAT (composition matrix)
- Protocol violation (wrong_phase, mode_mismatch, budget/kind mismatch)
- Invariant break on some σ —ε→ σ'
- Simultaneous same-cell: joint → neither; ordered → first seat wins

## 6. Base Invariants

- I1: grid bounds / active topology positions preserved
- I2: public cells ∈ CellValue; hidden owner-only when present
- I3: one resolved cell write per successful place intent (before batch
  effects); simultaneous joint may write 0–2 per sub-step
- I4: moveCount increments on successful state-changing ply (incl. joint
  rounds, queries, passes); tick increments without player handoff
- I5: terminal S ∈ {won, draw} ⇒ no further legal actions; winner set iff won
- I6: simultaneous ⇒ currentPlayer unchanged across joint round
- I7: commit buffers cleared after successful reveal
- I8: deduction secrets fixed at init; queries answer vs opponent secret
- I9: point ko forbids one intersection next place; superko forbids repeated
  hash in positionHistory; pass does not append superko history
- I10: delayed intents: cell reservations block occupancy; gravity reserves
  line slots

## 7. Shared Primitives

### Placement

direct (place) | gravity (activateColumn/Row) | overflow reject/pop-out |
delayTurns → pendingPlaces.

### Capture

| Mode | Config | Mechanism |
|---|---|---|
| flip | placement.captureMode | Reversi sandwich along adjacency |
| liberties | placement.captureMode | Go-lite group removal + ko/superko |
| replace | movement.capture = replace | Move onto enemy → clear then land |
| jump | movement.capture = jump | Leap over adjacent enemy to empty beyond (rect rays, hex cube-axis, or graph 2-edge); mid cleared; further jumps keep seat (`mustContinueFrom`); optional `mustCapture`; incompatible with `graphReach: hop` |

KoRule: none | point | positional | situational.

### Movement

- adjacency: orthogonal | diagonal | king (rect); hex/graph: orthogonal
- range: 1..8 sliding (blocker-aware); range 1 = adjacent step
- capture jump: rectangle | hex_offset | graph + alternating only; quiet
  range 1; jump distance always 2 (cube-axis double step on hex; 2-edge
  leap on graph); chains via mustContinueFrom (not actionsPerTurn);
  optional `mustCapture` forbids quiet moves at turn start when any jump
  exists (Mandatory Jump Race); Graph Jump Race covers explicit-edge leaps
  (incompatible with graphReach hop)
- graphReach: chain (unique-forward edge walk) | hop (BFS within range)
- simultaneous: canJointSimultaneousMoves (vacated origins) /
  canOrderedSimultaneousMoves (sequential revalidation)

### Objectives

n_in_a_row | reach_row (+ targetRows) | destroy_hidden | connect_or_destroy |
area_control (two passes → score) | identify_secret | clear_hazards |
match_pairs | none.

### Observation

full | hit_miss | fog (radius + metric) | deduction (roster / eliminations /
lastQuery; commit pending overlay) | flood_reveal (shared counts; hidden mines)
| memory_flip (shared face-up / matched marks; hidden deck).

### Hazards (flood_reveal)

hazards.{count, firstRevealSafe}; reveal action floods zero-count regions and
opens numbered frontiers; mineHit → opponent wins; all safe revealed → draw.

### Memory (memory_flip)

memory.{pairCount, bonusTurnOnMatch}; input.mode = flip; actionsPerTurn = 2;
hidden deck holds `mem:N` marks (exactly two each); flip two tiles per turn;
match stays + scores; mismatch re-hides synchronously; all matched → higher
score wins (tie → draw).

### Fleet / scheduler

fleet.ships → placement then combat fire; manual_tick + life_b3s23 → tick.

### Deduction (Guess Who-lite)

- Roster: {id, traits: Record\<string, bool\>}
- queryShape: single | and | or; compoundArity for N-clause compounds
- query → boolean vs opponent secret; autoEliminate (default true) or manual
  eliminate / simultaneousEliminate / commitEliminate
- guess / simultaneousGuess → identify_secret; wrongGuess: lose | end_turn
- State: lastQuery (alternating) | lastQueries (simultaneous / commitReveal)

### Turn schedules

| Schedule | Shape |
|---|---|
| alternating | currentPlayer; optional multi-step / turn.phases |
| simultaneous | joint place/move/deduction; optional commitReveal |
| manual_tick | alternating + mandatory tick (Life) |

In-turn phase tokens: place | move | fire | query | eliminate | guess.

## 8. Validation Strategy

1. TypeScript: GameState / GameEvent / GameConfig
2. Zod schema + superRefine composition matrix
3. Reducer guards + kernel explainKernelAction
4. Feature contracts (slot/capability checks)
5. Property / transcript tests (simultaneous*, guessWho*, movement*, hidden*)
6. Optional SMT (`solveZ3.ts` — not sandbox-wired)
7. Agent joint enumeration (`agents/jointLegal.ts`) for searchability

## 9. Kernel agent boundary & roadmap

- stepJoint / stepPly: joint place/move/query/guess/eliminate; commit-fill loops
- Joint UCT/MCTS: open simultaneous + multi-action + commitReveal (place/move/
  deduction) via enumerateJointLegalActions / enumerateCommitRevealJoints
- Deferred search notes: ordered-resolve UCT breadth; fire→move only with
  anchor game

Roadmap:

- Formal Hook pre/post signatures per feature
- Typed machine factory from contracts
- SMT export on demand

> Pragmatic draft: strong guarantees via types, schema, and tests; path open
> to stronger formal methods. Keep in sync when kernel event/state vocabulary
> changes.
