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
- **Life Lite** (manual `tick` + Conway B3/S23 scheduler)
- **Hex Connect Lite** (odd-r `hex_offset` topology + n-in-a-row)
- **Toroidal Hex Connect Lite** (`grid.wrap` on hex_offset)
- **Go Lite** (liberties group capture + simple point ko + pass-to-score area control)
- **Go Lite Superko** (positional superko — forbids repeating any prior board position)
- **Go Lite Situational Superko** (situational superko — forbids repeating a prior board+side-to-move)
- **Graph Connect Lite** (explicit `graph` topology + n-in-a-row)
- **Toroidal TTT** (`grid.wrap` rectangle)
- **Simultaneous TTT** (`turn.schedule = simultaneous` joint place; same-cell conflict)
- **Hidden Simultaneous TTT** (`turn.commitReveal`; private commits then reveal)
- **Double Move TTT** (`turn.actionsPerTurn = 2` multi-step budget before handoff)
- **Delayed TTT** (`placement.delayTurns = 1` queued place; pending cells reserved)

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

The form fields mirror the JSON schema (`metadata`, `grid`, `turn`, `rng`) with updates syncing two-ways with the editor.

## Scripts

- `pnpm run dev` — Next.js sandbox
- `pnpm run build` / `start` — production
- `pnpm run typecheck` / `lint`
- `pnpm test` — Vitest engine transcripts

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
- **Inputs**: cell-click, column-activation, row-activation, and piece move (`input.mode = "cell" | "column" | "row" | "move"`)
- **Placement**:
  - direct placement (`placement.mode = "direct"`)
  - gravity placement **down | up | left | right** (`placement.mode = "gravity"`, `gravity.direction`; column ↔ vertical, row ↔ horizontal)
  - overflow: `reject` | `pop_out_bottom` | `pop_out_top` | `pop_out_left` |
    `pop_out_right` (paired with gravity direction; horizontal uses `popOutRow`)
  - delayed place (`placement.delayTurns` > 0 → queue intent; Delayed TTT)
- **Movement**: orthogonal step (`movement.adjacency = "orthogonal"`, `range = 1`) via `{ type: "move", from, to }`
- **Scheduler**: `turn.schedule = "manual_tick"` + `scheduler.rules = "life_b3s23"` → `{ type: "tick" }` (Life Lite); `turn.actionsPerTurn` multi-step budget on alternating (Double Move TTT); `turn.schedule = "simultaneous"` joint place (Simultaneous TTT); `turn.commitReveal` hidden commits until both seats commit (Hidden Simultaneous TTT)
- **Effects**: optional capture toggles (Capture / Flip Demo)
- **Objectives**: n-in-a-row (rectangle or hex axes); `destroy_hidden` (hit/miss); `reach_row` (Step Race); `none` (open-ended / tick demos)
- **Observation**: `full` (identity), `hit_miss` (own fleet + public shots), or `fog` (radius around own pieces + `visible[]` mask); Battleship-lite / Battleship Place (`fleet.ships`) / Fog Connect Lite presets
- **Determinism**: GameIR v0 replays `seed + actions → same state`; Effect RNG helpers exist (`rng.seed` in config / transcript)
- **Kernel**: sandbox plays presets through `GameKernel.step` (with per-player observations), legal-move overlay, why-illegal reasons, event trace, Replay, and Agent step (random/greedy/hunt/tiny MCTS/UCT)
- **Compiler**: `src/compiler/` validates, expands macros, normalizes to `GameConfig`, builds the kernel
- **Agents**: `src/agents/` — kernel-only bots (`legalActions` + `stepSync` + `observe`), including hunt (hit/miss) and UCT tree search
- **Library explorer**: `src/library/` samples configs (incl. graph), scores playability (compile → opening → random + greedy probes), share links (`?find=` / `?librarySeed=`), sandbox Library modal loads finds

What’s **roadmap**, not fully realized yet: full Go rules, hex/graph
simultaneous, and a larger set of reusable operators/constraints.

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
- schedule: alternating, simultaneous, or ordered simultaneous resolution
- phases: place → move → attack (etc.)
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
- greedy 1-ply (win / block / heuristics)
- hunt (hit/miss observe → target after hits, parity search)
- tiny flat MCTS
- UCT tree search (UCB1 + optional tree reuse)

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

Core development focuses on turning the current sandbox into a compiler-like pipeline (spec → kernel + IR). Library explorer foothold landed (`src/library/` + sandbox Library modal).

Near-term milestones:

- **Kernel/IR boundary**: formalize the `GameKernel` interface and introduce a stable `GameIR` for replay/logging
- **Compiler stages**: validate/normalize specs and expand macros into primitive operators + constraints
- **Topology generalization**: evolve from rectangular grids toward graph-based boards (while keeping grid ergonomics)
- **Observation support**: hit/miss + fog radius + fleet placement phase landed (Battleship-lite / Fog Connect Lite / Battleship Place)
- **Move foothold**: orthogonal step + reach_row (Step Race) landed; richer piece tables / chase games still open
- **Tick/scheduler foothold**: Life Lite (`manual_tick` + B3/S23) landed; realtime loops stay at UI edge
- **Hex topology foothold**: `hex_offset` (odd-r) + Hex Connect Lite landed; general graph boards still open
- **Liberties / territory foothold**: `capture.mode=liberties` + `area_control` + Go Lite landed; **point ko** (`capture.ko` / `ko: true`) + **positional superko** (`ko: "positional"`) + **situational superko** (`ko: "situational"` + `board|side` history)
- **Library explorer foothold**: sample/classify playable vs noise; load finds into sandbox
- **Anchor games**: mechanism-first ports only — not exhausting `references/`
- **Debug tooling**: event trace, legal move overlays, “why illegal” explanations
- **Baseline agents**: random/greedy/hunt/tiny MCTS/UCT on kernel only; hunt uses `observe` for hit/miss

Future features include camera/perspective modes, richer multi-entity interactions, schema-driven UI generation (richer controls, constraints), and 3D functionality once the 2D path is stable.

## Non-goals (keep scope stable)

- Not trying to be “Unity for all genres”
- Not promising optimal solving across all games
- Not supporting continuous physics initially (discrete graph games first)
- Not supporting arbitrary user code in specs (only named primitives + parameters)

## Contributing

Issues and PRs are welcome. If you’d like to add a preset or a new operator, open an issue to discuss schema/layout first so we can keep the model composable and type‑safe.
