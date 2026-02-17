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
- **Connect 4 (Pop Out)**
- **Gomoku (5‑in‑a‑row)**
- **Reversi / Othello** (capture enabled)

In the sandbox, click **Browse presets** (or press **⌘/Ctrl+K**) to load one.

## Tech stack

- Framework: Next.js 14 (App Router), React 18, TypeScript
- Styling: Tailwind CSS, shadcn/ui
- Validation/typing: Zod (runtime), TypeScript (static)
- State/Forms: react-hook-form, fast-deep-equal (for JSON→form sync)
- State machines: XState (to structure transitions and model compositions)
- Rendering: Three.js (board/camera), ResizeObserver
- Editor: react-simple-code-editor + Prism.js
- Package manager: pnpm
- FP runtime (planned): Effect (Effect.ts) for FP primitives in core and runtime at edges

## Usage

The canvas supports panning with mouse/touch (clamped to board) and zooming with wheel/pinch. `window.jumpPanTo(x, y)` is available for quick developer testing.

The editor provides live JSON + Zod validation. Format via the “Format” button or ⌘/Ctrl+F. Colors/theme adapt to light/dark mode (although no toggle added yet), and editor scroll position is preserved on format.

The form fields mirror the JSON schema (`metadata`, `grid`, `turn`, `rng`) with updates syncing two-ways with the editor.

## Architecture notes (directional)

The core follows pure functional principles with reducers (`State -> Event -> State`), a scheduler, and deterministic RNG. State transitions use XState statecharts to structure phases and keep compositions algebraic (operators on state always yield valid states).

The data-driven configuration uses declarative JSON as a control surface, with the dynamic form mirroring the nested schema. Adapters at the edges handle rendering (Three.js), input, and persistence.

Routing uses App Router with scroll-snap landing and URL replacement to reflect the active view. The planned “infinite library” mode will sample/randomize configs and reveal how rare playable settings are.

## Current implementation status (today)

OmniGame is actively evolving toward the “spec → compiler → kernel + IR” shape described below. The current sandbox already supports a useful (but intentionally small) slice of the primitive space:

- **Topology**: rectangular grid only (`grid.topology = "rectangle"`)
- **Inputs**: cell-click and column-activation (`input.mode = "cell" | "column"`)
- **Placement**:
  - direct placement (`placement.mode = "direct"`)
  - gravity placement with a direction (`placement.mode = "gravity"`, `gravity.direction`)
  - overflow variants (Connect-4 PopOut style): `overflow = "reject" | "pop_out_bottom" | "pop_out_top"`
- **Effects**: optional capture toggles (used for Reversi-like behavior)
- **Objectives**: n-in-a-row win detection with configurable adjacency + length
- **Determinism**: seeded RNG in config (used for reproducible runs as the runtime expands)

What’s **roadmap**, not fully realized yet: a stable `GameKernel` ABI boundary, a normalized `GameIR`, first-class observation models for partial information, and a larger library of reusable operators/constraints.

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
- greedy (simple local heuristic)
- tiny MCTS for fully observed deterministic games

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

Core development focuses on turning the current sandbox into a compiler-like pipeline (spec → kernel + IR), plus a library explorer for navigating the configuration space.

Near-term milestones:

- **Kernel/IR boundary**: formalize the `GameKernel` interface and introduce a stable `GameIR` for replay/logging
- **Compiler stages**: validate/normalize specs and expand macros into primitive operators + constraints
- **Topology generalization**: evolve from rectangular grids toward graph-based boards (while keeping grid ergonomics)
- **Observation support**: make partial information explicit (enables Battleship-lite correctly)
- **Anchor games**: implement the 2–3 “stress test” games above to validate primitive completeness
- **Debug tooling**: event trace, legal move overlays, “why illegal” explanations
- **Baseline agents**: random/greedy/tiny MCTS to prove bot play with clean interfaces

Future features include camera/perspective modes, richer multi-entity interactions, schema-driven UI generation (richer controls, constraints), and 3D functionality once the 2D path is stable.

## Non-goals (keep scope stable)

- Not trying to be “Unity for all genres”
- Not promising optimal solving across all games
- Not supporting continuous physics initially (discrete graph games first)
- Not supporting arbitrary user code in specs (only named primitives + parameters)

## Contributing

Issues and PRs are welcome. If you’d like to add a preset or a new operator, open an issue to discuss schema/layout first so we can keep the model composable and type‑safe.
