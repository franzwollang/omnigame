# OmniGame

<p align="center">
  <img src="./public/logo.png" alt="OmniGame Logo" width="160" height="160" />
</p>

<p align="center"><strong>Compose every grid game from data &amp; pure functions</strong></p>

OmniGame is a pure functional, data-driven engine for 2D grid-based games. Instead of hardcoding each game as a bespoke codebase, OmniGame treats a game as a *composition of primitives*—a well-typed description the engine can interpret to validate rules, generate legal moves, apply state transitions, render the board, and detect termination.

Live demo: [omnigame.vercel.app](https://omnigame.vercel.app/)

## What is OmniGame?

There’s a particular “aha” that shows up when you realize how many apparently different systems are just variations on a small set of operations. Grid games are a perfect playground for that insight: they look like unique rulebooks, but the mechanics rhyme.

Most grid-ish games can be described with the same conceptual machinery:

- **Topology**: grid/graph/hex, wrapping rules, adjacency
- **Entities**: tokens, pieces, resources, hidden state
- **Operators**: place, move, remove, transform
- **Constraints**: occupancy, legality, connectivity, capture rules
- **Observation**: what each player can see and when
- **Termination & scoring**: win conditions, draws, territory, race conditions

OmniGame aims to make those mechanics **first-class components**. When the rules are explicit and machine-readable, the project becomes a sandbox (and eventually a “compiler”) from *game descriptions* into executable play.

## Motivation

OmniGame aims to show the power of functional composition and data-driven design in a highly visual, intuitive way. It lets people search for strange hybrids and variants of classic games by tweaking a small set of primitives.

Most configurations are unplayable (akin to the [Library of Babel](https://libraryofbabel.info/) where most books and images are pure noise), which is exactly what makes the playable ones interesting to discover.

## Presets (current examples)

These are built from the same shared schema and operators.

- **Tic‑Tac‑Toe**
- **Connect 4**
- **Connect 4 (Up)** (gravity rises toward the top)
- **Connect 4 (Right)** (row activation; discs slide right)
- **Connect 4 (Pop Out)**
- **Connect 4 (Up Pop Out)** (gravity up + top pop-out)
- **Connect 4 (Right Pop Out)** (row gravity + right pop-out / `popOutRow`)
- **Gomoku (5‑in‑a‑row)**
- **Capture / Flip Demo** (Reversi-style sandwich capture; n-in-a-row win, not full Othello)
- **Battleship Lite** (hit/miss observation + destroy_hidden)
- **Battleship Place** (fleet.ships placement phase → combat)
- **Fog Connect Lite** (fog-of-war radius observation + n-in-a-row)
- **Step Race** (orthogonal `Move` + reach_row objective)
- **Diagonal Step Race** (`movement.adjacency = diagonal` ferz step + reach_row)
- **Slide Race** (`movement.range > 1` blocker-aware orthogonal slide + reach_row)
- **Hex Slide Race** (`hex_offset` cube-axis `movement.range > 1` + reach_row)
- **Graph Slide Race** (`graph` edge chain-walk `movement.range > 1` + reach_row)
- **Replace Race** (`movement.capture = replace` — move onto enemy clears then lands)
- **Hex Replace Race** (`hex_offset` + `capture: replace` — cube-axis attrition)
- **Graph Replace Race** (`graph` + `capture: replace` — chain-walk attrition)
- **Guess Who Lite** (deduction query/guess + identify_secret)
- **Guess Who Commit Lite** (`autoEliminate: false` + eliminate + end_turn wrong guess)
- **Guess Who And Lite** (`queryShape: and` — 2-clause trait conjunction queries)
- **Guess Who Or Lite** (`queryShape: or` — 2-clause trait disjunction queries)
- **Life Lite** (manual `tick` + Conway B3/S23 scheduler)
- **Hex Connect Lite** (odd-r `hex_offset` topology + n-in-a-row)
- **Toroidal Hex Connect Lite** (`grid.wrap` on hex_offset)
- **Go Lite** (liberties group capture + simple point ko + pass-to-score area control)
- **Go Lite Superko** (positional superko — forbids repeating any prior board position)
- **Go Lite Situational Superko** (situational superko — forbids repeating a prior board+side-to-move)
- **Graph Connect Lite** (explicit `graph` topology + n-in-a-row)
- **Toroidal TTT** (`grid.wrap` rectangle)
- **Simultaneous TTT** (`turn.schedule = simultaneous` joint place; same-cell conflict)
- **Ordered Simultaneous TTT** (`turn.resolveOrder = x_first`; earlier seat wins same-cell)
- **Simultaneous Hex Connect Lite** (simultaneous + `hex_offset` composition)
- **Simultaneous Graph Connect Lite** (simultaneous + `graph` composition)
- **Hidden Simultaneous TTT** (`turn.commitReveal`; private commits then reveal)
- **Double Move TTT** (`turn.actionsPerTurn = 2` multi-step budget before handoff)
- **Double Move Hex / Graph** (alternating multi-step on `hex_offset` / `graph`)
- **Double-Place Simultaneous TTT** (`actionsPerTurn = 2` under simultaneous rounds)
- **Double-Place Simultaneous Hex / Graph** (multi-action simultaneous on hex_offset / graph)
- **Delayed TTT** (`placement.delayTurns = 1` queued place; pending cells reserved)
- **Delayed Connect 4** (delayed gravity: column intents settle at resolve time)
- **Place & Move Lite** (`turn.phases: ["place","move"]` in-turn action sequence)
- **Place & Fire Lite** (`turn.phases: ["place","fire"]` + hit/miss sink)
- **Place, Move & Fire Lite** (`turn.phases: ["place","move","fire"]` + `connect_or_destroy`)
- **Move & Fire Lite** (`turn.phases: ["move","fire"]` — reposition spotter then fire; no place)
- **Simultaneous Step Race** (`simultaneous` + `move` joint resolve; same-destination conflict)
- **Simultaneous Slide Race** (`simultaneous` + `movement.range > 1`; vacated-origin path checks)
- **Ordered Simultaneous Slide Race** (`resolveOrder` + sliding; sequential path revalidation)
- **Simultaneous Replace Race** (`simultaneous` + `capture: replace`; stationary capture + pieceCaptured)
- **Ordered Simultaneous Replace Race** (`resolveOrder` + replace; capture-before-flee vs flee-before-capture)
- **Simultaneous Slide Replace Race** (`simultaneous` + slide `range` + `capture: replace`; vacated-origin hybrid)
- **Simultaneous Slide Replace Flee Race** (joint slide through fleeing blocker on the ray)
- **Ordered Simultaneous Slide Replace Race** (`resolveOrder` + slide+replace; sequential path/capture)

In the sandbox, click **Browse presets** (or press **⌘/Ctrl+K**) to load one.

## Tech stack

- Framework: Next.js 14 (App Router), React 18, TypeScript
- Styling: Tailwind CSS, shadcn/ui
- Validation/typing: Zod (runtime), TypeScript (static)
- State/Forms: react-hook-form, fast-deep-equal (for JSON→form sync)
- FP runtime: Effect (Effect.ts) — seeded RNG + GameKernel stepping; GameIR replay foothold landed
- Rendering: Three.js (board/camera), ResizeObserver
- Editor: react-simple-code-editor + Prism.js
- Tests: Vitest (engine transcript + GameIR replay + library explore tests)
- Package manager: pnpm
- Optional SMT: z3-solver (experimental server helper — **not** wired into sandbox UI;
  use `app/actions/validate-config.ts` from scripts/CI when needed)

## Usage

The canvas supports panning with mouse/touch (clamped to board) and zooming with wheel/pinch.

The editor provides live JSON + Zod + feature-contract validation (`validateConfig`).
Format via the “Format” button or ⌘/Ctrl+F. Colors/theme adapt to light/dark mode
(although no toggle added yet), and editor scroll position is preserved on format.

The form syncs two-ways with the JSON editor for many knobs (`metadata`, `grid`,
`turn` schedule/budget/delay/**phases**, **movement**, placement, win, …). A
dashed “Form coverage” callout in the Form tab lists remaining JSON/preset-only
fields (`scheduler`, graph `nodes`/`edges`, `initial`, `placements`,
`placement.capture`, …).

## Scripts

- `pnpm run dev` — Next.js sandbox
- `pnpm run build` / `start` — production
- `pnpm run typecheck` / `lint`
- `pnpm test` / `test:watch` — Vitest (engine transcripts; expect ≥438 tests)
- Green gate: `pnpm install && pnpm typecheck && pnpm test`

Open work and marathon queue: `OPEN_ISSUES.md` / `PLANNING.md` (not this README).

## Architecture notes (directional)

The core follows pure functional principles with reducers (`State -> Event -> State`). Deterministic RNG is available via Effect (`src/engine/rng.ts`). Sandbox play goes through a `GameKernel` (`src/engine/kernel.ts`: `initialState` / `legalActions` / Effect-backed `step`) via `useGameEngine`, which surfaces a kernel event log and a GameIR action transcript (`src/ir/gameIr.ts`) with a sidebar Replay control. Turn phases use a small hand-rolled scaffold (`turnMachine.ts`).

The data-driven configuration uses declarative JSON as a control surface, with the dynamic form mirroring the nested schema. Specs go through `src/compiler/` (`validate → expand macros → normalize → GameKernel`); the sandbox calls `compileToGameConfig` rather than owning the adapter. Macros today: `gravity.enabled` → gravity placement primitives; token `placements` → `initial` seeds. `validateConfig` builds feature contracts for the selected input/placement/overflow/capture/end features (live in the sandbox editor). Z3 SMT remains an optional server-side experiment. Adapters at the edges handle rendering (Three.js), input, and persistence.

Routing uses App Router with scroll-snap landing and URL replacement to reflect the active view. The library explorer (`src/library/` + sandbox **Library** modal) samples/randomizes configs and classifies playable vs noise (Library of Babel framing).

## Current implementation status (today)

OmniGame is actively evolving toward the “spec → compiler → kernel + IR” shape described below. The current sandbox already supports a useful (but intentionally small) slice of the primitive space:

- **Topology**: rectangular grid, odd-r hex (`hex_offset`), or explicit adjacency
  graph (`graph` with `nodes`/`edges`); `grid.wrap` toroidal adjacency for
  **rectangle** and **hex_offset** (graph wrap = explicit edges); Toroidal TTT +
  Toroidal Hex Connect Lite presets
- **Inputs**: cell-click, column-activation, row-activation, piece move, and
  deduction query/guess (`input.mode = "cell" | "column" | "row" | "move" | "deduction"`)
- **Placement**:
  - direct placement (`placement.mode = "direct"`)
  - gravity placement **down | up | left | right** (`placement.mode = "gravity"`, `gravity.direction`; column ↔ vertical, row ↔ horizontal)
  - overflow: `reject` | `pop_out_bottom` | `pop_out_top` | `pop_out_left` |
    `pop_out_right` (paired with gravity direction; horizontal uses `popOutRow`)
  - delayed place (`placement.delayTurns` > 0 → queue intent; Delayed TTT cell
    reserve, or Delayed Connect 4 gravity settle-on-resolve)
- **Movement**: piece steps/slides via `{ type: "move", from, to }` with
  `movement.adjacency` = `orthogonal` | `diagonal` | `king` and sliding
  `movement.range` 1..8 on rectangle (Step Race / Diagonal Step Race /
  Slide Race / Simultaneous Step Race / **Simultaneous Slide Race** / **Ordered
  Simultaneous Slide Race**); joint simultaneous slides use vacated-origin path
  checks; ordered simultaneous slides revalidate the second seat after the first;
  `movement.capture = replace` moves onto an enemy cell (path empty except
  destination) — Replace Race / **Simultaneous Replace Race** (joint range 1;
  vacated-origin paths; stationary replace still required) /
  **Ordered Simultaneous Replace Race** (sequential capture apply; priority can
  capture before prey flees) / **Simultaneous Slide Replace Race** (joint
  slide+replace; path-through-fleeing) / **Simultaneous Slide Replace
  Flee Race** (demo of slide through a vacating blocker) / **Ordered
  Simultaneous Slide Replace Race** (ordered slide+replace; sequential
  path/capture); hex_offset uses cube-axis slides (orthogonal, range 1..8) with
  the same replace rules — Hex Step Race / **Hex Slide Race** / **Hex Replace
  Race** / Simultaneous Hex Step Race; graph uses edge chain-walk slides
  (orthogonal, range 1..8; no junction turns; same replace rules) —
  Simultaneous Graph Step Race / **Graph Slide Race** / **Graph Replace Race**
- **Scheduler**: `turn.schedule = "manual_tick"` + `scheduler.rules = "life_b3s23"` → `{ type: "tick" }` (Life Lite); `turn.actionsPerTurn` multi-step budget on alternating rectangle | hex_offset | graph (Double Move TTT / Hex / Graph) or multi-action budget under simultaneous on rectangle | hex_offset | graph (Double-Place Simultaneous TTT / Hex / Graph); `turn.schedule = "simultaneous"` joint place on rectangle | hex_offset | graph (Simultaneous TTT / Hex / Graph Connect Lite) or joint move/slide on rectangle | hex_offset | graph (Simultaneous Step Race / Slide Race / Hex / Graph); `turn.resolveOrder = x_first | o_first` ordered same-cell / same-destination priority **and** ordered sliding path revalidation **and** ordered replace sequential capture incl. slide+replace (Ordered Simultaneous TTT / Ordered Simultaneous Slide Race / Ordered Simultaneous Replace Race / Ordered Simultaneous Slide Replace Race); `turn.commitReveal` hidden commits until both seats commit (Hidden Simultaneous TTT); `turn.phases` in-turn place→move (Place & Move Lite), place→fire (Place & Fire Lite), or place→move→fire + `connect_or_destroy` (Place, Move & Fire Lite), or move→fire (Move & Fire Lite)
- **Effects**: optional capture toggles (Capture / Flip Demo); move replace capture (`movement.capture`)
- **Objectives**: n-in-a-row (rectangle or hex axes); `destroy_hidden` (hit/miss); `reach_row` (Step Race family); `identify_secret` (Guess Who Lite / Commit / And / Or); `none` (open-ended / tick demos)
- **Observation**: `full` (identity), `hit_miss` (own fleet + public shots), `fog` (radius around own pieces + `visible[]` mask), or `deduction` (public roster + own eliminations / last query); Battleship-lite / Battleship Place (`fleet.ships`) / Fog Connect Lite / **Guess Who Lite** / **Guess Who Commit Lite** / **Guess Who And Lite** / **Guess Who Or Lite** presets
- **Determinism**: GameIR v0 replays `seed + actions → same state`; Effect RNG helpers exist (`rng.seed` in config / transcript)
- **Kernel**: sandbox plays presets through `GameKernel.step` (with per-player observations), legal-move overlay, why-illegal reasons, event trace, Replay, and Agent step (random/greedy/hunt/tiny MCTS/UCT)
- **Compiler**: `src/compiler/` validates, expands macros, normalizes to `GameConfig`, builds the kernel
- **Agents**: `src/agents/` — kernel-only bots (`legalActions` + `stepSync` + `observe`), including hunt (hit/miss) and UCT tree search
- **Library explorer**: `src/library/` samples configs (incl. graph), scores playability (compile → opening → random + greedy probes), share links (`?find=` / `?librarySeed=`), sandbox Library modal loads finds

What’s **roadmap**, not fully realized yet: full Go rules, richer multi-phase
machines, hop-ball graph range, simultaneous deduction /
3+ clause AND, and a larger set of reusable operators/constraints.

## Technical vision (expanded)

### Goal

A **data-driven, functionally composable** 2D/grid/graph game engine where a “game” is a configuration assembled from a small set of typed primitives. The long-term direction is that a game spec compiles into:

- **A runnable runtime**: state model, legal move generation, deterministic step function, and UI/render hooks
- **An analysis IR (optional)**: a stable normalized representation suitable for replay/logging and (later) plug-in solvers/optimizers

### Layering model

- **Spec / DSL layer (rules as data)**: pure-data description of topology, state layers, actions, constraints, turn/phase timing, observation, and objectives. The spec should contain knobs/parameters, not code branching.
- **Compiler layer**: validates + normalizes specs; expands “macros” (e.g. “rook-like moves”) into core primitives; emits:
  - **GameKernel**: fast stepping + legal action generation (“engine ABI”)
  - **GameIR**: canonical normal form for tooling/agents/replay
- **Runtime layer**: deterministic simulation with seeded RNG; supports local play, replay/rollback, and instrumentation.
- **(Optional) solver/agent layer**: pluggable agents that depend only on kernel interfaces and/or GameIR (not on UI code).

## Primitives (MVP → extensible)

OmniGame’s “complete primitive set” is intentionally small at first, but designed so new games are recombinations rather than new engine code.

### 1) Topology / board primitive

A board is a **graph with geometry metadata**.

- **MVP**: `Grid2D` (rectangular), plus wrap rules + neighborhood selection
- **Next**: `Hex2D`, general `Graph` (nodes/edges + optional embedding)
- **Later**: continuous 2D (only once the discrete story is excellent)

Conceptual API:

- `neighbors(cellId) -> Iterable<cellId>`
- `distance(a, b) -> number` (optional; useful for heuristics/AI)
- `regions(...) -> Iterable<Set<cellId>>` (optional helper; territories/connectivity)

### 2) State layers: entities, tokens, resources

State is represented as **layers** that map board locations to typed values.

- `Layer<T>` can be dense (array) or sparse (maps/sets)
- Multi-layer composition (terrain + units + fog + resources) is the common case
- “Entities” are declarative: type name + attribute schema + stacking rules

Conceptual API:

- `get(layer, cell)`, `set(layer, cell, value)`, `iter(layer)`

### 3) Action primitives (operators)

Actions are generic operators with typed parameters and constraints:

- `Place(entityType, cell)`
- `Move(entityId, from, to)`
- `Remove(entityId | cell)`
- `Transform(entityId, newType)`
- `Query(region | predicate)` (for sensor / deduction games)
- `Commit(hypothesis | guess)` (for races / identification)
- `Pass`

### 4) Constraint primitives (pure legality & invariants)

Constraints are composable predicates reused across games:

- occupancy / stacking
- adjacency / reachability / movement budget (range, costs)
- connectivity (e.g. “ships contiguous”)
- phase-dependent turn legality
- resource requirements

Design rule: constraints are **pure functions**; no hidden state mutation.

### 5) Turn / phase / timing primitive

Turn logic is declarative:

- N players
- schedule: alternating, simultaneous place or move (`resolveOrder` joint | x_first | o_first; `actionsPerTurn` multi-action place rounds), or multi-step alternating
- phases: in-turn `turn.phases` (place→move, place→fire, place→move→fire with
  `connect_or_destroy`, or move→fire); game-long fleet placement → combat;
  hex-graph phase lifts still expanding
- action points / per-turn budgets

### 6) Observation primitive (high leverage; optional early, core later)

Observation is first-class for partial information games:

`ObservationModel(player, state, lastAction, rng) -> observation`

Examples:

- full
- fog-of-war radius
- hit/miss (Battleship)
- count-in-region
- predicate answer yes/no (Guess Who-like)

Even before “solving,” explicit observation unlocks correct replay with private info, spectator views, and clean bot hooks.

### 7) Objective / terminal primitive

- terminal conditions (win/lose/draw)
- scoring functions (per player)
- outcome resolution policy

## GameKernel (“engine ABI”)

Every game ultimately compiles down to a small interface. This is what the runtime, replay system, and agents talk to.

```ts
type PlayerId = number;
type Seed = number;

interface GameKernel<State, Action, Obs> {
  initialState(seed: Seed): State;

  currentPlayer(state: State): PlayerId | "simultaneous";

  legalActions(state: State, player: PlayerId): Iterable<Action>;

  step(
    state: State,
    jointAction: Action | Map<PlayerId, Action>,
    seed?: Seed
  ): {
    nextState: State;
    events: GameEvent[]; // UI/logging: what happened (decoupled from rendering)
    observations?: Map<PlayerId, Obs>; // if partial info
    rewards?: Map<PlayerId, number>;
    terminal: boolean;
    outcome?: GameOutcome;
  };

  // Optional: fast hashing for caching/transposition tables
  hash?(state: State): string;

  // Optional: canonicalization for symmetries
  canonicalize?(state: State): State;
}
```

Key points:

- **Events are crucial**: the UI should render *events*, not inspect engine internals.
- **Joint actions** enable simultaneous-move games while keeping the ABI uniform.
- **Determinism**: `seed + action log` should replay exactly.

## GameIR (solver/logging normal form)

Even if solvers are an “aside,” an IR is valuable for:

- saving/loading + replay
- deterministic tests
- analytics + debugging
- future agents/solvers without coupling to runtime internals

Constraints in the IR should be **references to named primitives + parameters**, not arbitrary code blobs. This keeps the IR portable and stable across refactors.

Suggested IR modules:

- `TopologyIR`
- `LayersIR` (typed layer schemas + sparse payload)
- `TurnIR` (schedule + phase)
- `OperatorsIR` (action types + parameters)
- `ConstraintsIR` (named constraint references + parameterization)
- `ObservationIR` (optional)
- `ObjectiveIR`

## MVP scope (to avoid “universal engine” syndrome)

The goal is to converge on a “complete-ish” primitive set by implementing a few anchor games that stress different parts of the model:

- **Battleship-lite**: hidden placement, hit/miss observation, sink objective  
  Stresses: partial info + connectivity constraints + phases
- **Guess Who-like**: predicate queries over an attribute set  
  Stresses: query operator + hypothesis/commit actions + race objective  
  **Landed (MVP):** Guess Who Lite — `deduction` input/observation,
  `identify_secret`, query + guess; **Guess Who Commit Lite** —
  `autoEliminate: false` + `{ type: "eliminate" }` (manual hypothesis commit);
  **Guess Who And Lite** — `queryShape: and` (2-clause trait conjunction);
  **Guess Who Or Lite** — `queryShape: or` (2-clause trait disjunction)
- **Go-lite / territory fill**: place + adjacency/liberty constraints + area scoring (simplified)  
  Stresses: stepping + constraints + scoring

## Performance & UX requirements (practical)

- **Determinism**: seedable RNG, strict replay (`state0 + seed + actionLog -> same transcript`)
- **Fast stepping**: avoid deep copies; prefer structural sharing / copy-on-write layers
- **Tooling**:
  - JSON schema + runtime validation (Zod / Effect Schema)
  - debug visualization: legal move heatmap, “why illegal” constraint reasons, event trace

## Agents: “solver as aside” (minimal but clean plug point)

Don’t commit to heavy theory early, but keep the seam clean:

- `Agent.act(observationOrState) -> Action`
- `Agent.reset(seed)`

Baseline agents (enough to prove the ABI):

- random legal
- greedy 1-ply (win / block / heuristics; under `simultaneous`, skips
  lookahead because a single seat action is a no-op until joint resolve)
- hunt (hit/miss observe → target after hits, parity search)
- tiny flat MCTS
- UCT tree search (UCB1 + optional tree reuse)

**Simultaneous search:** Under open `turn.schedule = simultaneous` (place or
move; any `actionsPerTurn`, including multi-action place rounds), MCTS and UCT
search the joint action cartesian (`simultaneousPlace` / `simultaneousMove`) and
cache the decision so sandbox dual-/multi-`act` stays consistent. Under
`commitReveal`, they search fresh-round reveal joints (same cartesian, evaluated
via `simultaneousPlace`) and cache sequential `commitPlace` emissions so
sandbox X-then-O clicks stay on one plan. Mid-round commits without a cached
plan fall back to per-seat search. Greedy still skips lookahead under
simultaneous.

## Suggested module structure (directional)

As the codebase matures, aim for a separation like:

- `src/spec/` — schemas + types for game specs/config
- `src/primitives/` — topology, layers, operators, constraint library
- `src/compiler/` — validate → normalize → kernel builder → IR emitter
- `src/kernel/` — kernel interfaces + helpers
- `src/ir/` — GameIR types + serializer/deserializer
- `src/runtime/` — runner, replay, RNG, event system, instrumentation
- `src/agents/` — baseline bots (optional)

For formal composition semantics and invariants, see `docs/semantics.md`.

## Roadmap

**Landed (Phase 1):** GameKernel + GameIR + compiler, observation (hit/miss + fog +
fleet place), Move (incl. sliding on rectangle), tick/Life, hex + graph topology,
liberties/ko/superko, simultaneous / multi-step / delayed / in-turn phases, library
explorer, debug overlays, baseline agents. Details: README status section +
`PLANNING.md`.

**Landed (Phase 2 so far):** composition honesty (M8), capture-by-replacement /
Replace Race (M9), Guess Who Lite query+guess / `identify_secret` (M10), joint
simultaneous sliding / Simultaneous Slide Race (M11), ordered simultaneous
sliding / Ordered Simultaneous Slide Race (M12), joint simultaneous replace /
Simultaneous Replace Race (M13), ordered simultaneous replace / Ordered
Simultaneous Replace Race (M14), simultaneous slide+replace / Simultaneous +
Ordered Slide Replace Race (M15), move→fire in-turn phases / Move & Fire Lite
(M16), vacated-origin hybrid for joint replace paths / Simultaneous Slide
Replace Flee Race (M17), joint UCT/MCTS under open simultaneous (M18), joint
UCT/MCTS under multi-action simultaneous (M19), joint UCT/MCTS under
commitReveal / Hidden Simultaneous TTT (M20), hex cube-axis sliding / Hex
Slide Race (M21), graph chain-walk sliding / Graph Slide Race (M22), Guess Who
manual commit / Guess Who Commit Lite (M23), Guess Who trait-conjunction
queries / Guess Who And Lite (M24), Guess Who trait-disjunction queries /
Guess Who Or Lite (M25), hex replace capture / Hex Replace Race (M26),
graph replace capture / Graph Replace Race (M27).

**Open (Phase 2 — see `OPEN_ISSUES.md`):**

- **Next:** pick smallest new seam under `next-missing-mechanism` (e.g.
  richer phases, 3+ clause AND, hop-ball) or P4 CI / semantics refresh
- Deferred: full Go rules; hop-ball graph range; CI workflows;
  `docs/semantics.md` refresh vs current kernel events; simultaneous
  deduction / 3+ clause AND

Future features include richer schema-driven UI, camera modes, and 3D once the 2D
path stays stable.

## Non-goals (keep scope stable)

- Not trying to be “Unity for all genres”
- Not promising optimal solving across all games
- Not supporting continuous physics initially (discrete graph games first)
- Not supporting arbitrary user code in specs (only named primitives + parameters)

## Contributing

Issues and PRs are welcome. If you’d like to add a preset or a new operator, open an issue to discuss schema/layout first so we can keep the model composable and type‑safe.
