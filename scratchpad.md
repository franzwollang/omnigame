# OmniGame Planning Notes

## Repository Vision and Architectural Priorities

- OmniGame aspires to be a purely functional, data-driven engine that can morph into many 2D grid games via configuration knobs alone; core loops are pure `State -> Event -> State` reducers with deterministic RNG and composable rule primitives.【F:README.md†L1-L84】
- Logic, rendering, input, persistence, and configuration editing are decoupled via adapters. Core stays pure TypeScript leveraging Effect data types (Option/Either/ReadonlyArray) while edges run in an Effect runtime to sequence IO, scheduling, and interop.【F:README.md†L40-L78】
- Configuration schema covers metadata, grid topology, turn/tick scheduling, entity/component definitions, action DSL (guards + effect ops), rules, win/lose conditions, UI controls, and presets, emphasizing data selection over imperative code.【F:README.md†L86-L173】

## Core Engine & Typing Plan

- Define algebraic data types for `State`, `Event`, `Entity`, `Component`, `Action`, `Rule`, `EffectOp`, `Condition`, using TypeScript discriminated unions backed by Effect `Schema` for runtime validation.
- Implement core reducer `reduce: (state: State, event: Event) => State` as a pure function composed from smaller reducers (movement, spawn, collision, counters, line detection) encoded as Effect `Layer`s for dependency injection.
- Model scheduling via a pure `SchedulerState` plus Effect-managed drivers (`TickDriver`, `TurnQueue`). Deterministic RNG flows through explicit seeds in state, using Effect `Random` service boundaries.
- Expose DSL helpers that lift effect primitives into declarative JSON (e.g., `op: "move"`, `op: "spawn"`, `op: "set"`). Map these to pure interpreter functions returning `ReadonlyArray<EffectOpResult>`.
- Provide typed guards `Guard = (ctx: RuleContext) => boolean` and `EffectOp = (ctx: RuleContext) => State`. Use Effect `Context` to pass dependencies (grid topology, entity indexers).
- Introduce module boundaries: `core/state`, `core/events`, `core/rules`, `core/effects`, `core/scheduler`, `core/rng`, `core/topology`. Each module exports pure functions plus associated `Schema`s for config parsing.

## Effect Layering Strategy

- Wrap impure edges (rendering, input, persistence, audio) inside Effect `Layer`s providing services to React components. Core modules remain framework-agnostic.
- Provide `EngineRuntime` module that interprets configuration into a running Effect `Fiber`, orchestrating tick loops, event queues, and snapshot streaming to adapters.
- Create effect modules for: `Clock` (tick scheduling), `InputBus` (UI events -> Engine events), `Persistence` (config load/save), and `Audio` (optional feedback). Each service exposes typed interfaces that the UI can request via Effect `Context`.

## UI & Rendering Foundations

- Build front-end with Next.js + React for routing/presets, Tailwind CSS + shadcn/ui for theming and control panel widgets, ensuring dynamic form generation from config schema.
- Default render adapter targets `<canvas>` using Three.js scene graph for future composability; abstract `RendererAdapter` interface to allow swapping (Canvas2D, WebGL/Three, SVG). Provide minimal wrappers to preserve pure snapshots -> draw commands flow.
- Compose UI into two panes: configuration panel (schema-driven form) and play canvas. React components subscribe to engine snapshots via Effect-provided hooks (e.g., `useEngineState`), with Suspense boundaries for loading.

## Reference Game Implementation Notes

### Tic-Tac-Toe Variant【F:references/tic-tac-toe/src/main.ts†L1-L211】【F:references/tic-tac-toe/src/main.ts†L211-L320】【F:references/tic-tac-toe/src/main.ts†L320-L403】

- Grid size configurable (3-100) with adjustable win length and selectable adjacency modes (linear combinations of horizontal/vertical/diagonal). Need config knobs for `grid.width/height`, `winConditions.nInARow.n`, and adjacency toggles.
- Maintain markers keyed by cell id; guard prevents overwriting marked cells; actions alternate players and append X/O render instructions.
- Win detection uses recursive adjacency traversal with memoization; encode as effect primitive `detectLine(playerId, adjacencySet, length)` working over entity placement components.
- UI requires slider/select controls mapped to config paths (`grid.size`, `win.n`, adjacency checkboxes) and message surface for win/draw states.

### Snake【F:references/snake/src/main.ts†L1-L200】【F:references/snake/src/main.ts†L200-L296】

- Grid fixed 21x21; snake body is ordered list of coordinates, apples spawn randomly avoiding snake, wrap-around movement using modular arithmetic.
- Player input adjusts direction with prevention of 180° turns; tick loop moves head, handles apple consumption (growth, speed increase), and collision with self triggers reset.
- Engine needs components: `Body` (ordered deque), `Direction`, `Speed`, `Consumable`. Actions: `user.turn` to update direction, `tick.move` to shift body, `tick.consume` to handle apples, `tick.reset` on collision.
- RNG service selects spawn cells; scheduler decreases delay (increase tick rate) as score rises. Canvas adapter highlights snake/apples.

### Minesweeper【F:references/minesweeper/src/main.ts†L1-L200】【F:references/minesweeper/src/main.ts†L200-L347】

- Board 11x11 with random mine placement (unique cells). Field squares track status (`mine`, `no-mine`, `visible`), adjacency count, and flags. Recursive flood fill reveals contiguous safe areas and numbers for boundary cells.
- Need operators: `spawnRandomEntities(count, exclude)`, `floodReveal(start, adjacencyFn, minePredicate)`, `countNeighbors(coord, predicate)`, `setStatus` and `fail` on mine click.
- User actions: left-click reveal; future extension for right-click flags. Win when all non-mine cells visible; lose on mine reveal.

### Conway's Game of Life【F:references/life/src/main.ts†L1-L200】【F:references/life/src/main.ts†L200-L348】

- Infinite-ish grid derived from viewport size; live cells tracked in `Set`. Adjustable neighborhood via adjacency checkboxes and radius. Rules evaluate counts and apply kill/revive updates.
- Engine requirements: `Cell` entities tracked sparsely; scheduler tick applies rule evaluation over active frontier (live cells + neighbors). Provide effect primitive `evaluateNeighborhood(coord, adjacencySet, radius)` returning transition actions.
- UI controls for adjacency set, neighborhood radius, start/stop, reset. Canvas adapter toggles cell fill classes.

### Cell Dodger (Grid Dodger)【F:references/cell-dodger/src/main.ts†L1-L200】【F:references/cell-dodger/src/main.ts†L200-L400】【F:references/cell-dodger/src/main.ts†L400-L520】

- Parameterized grid with adjustable counts for players, enemies, coins, delay, and minimum enemy distance. Entities wrap around toroidal grid. Players controlled via configurable key maps; enemies chase nearest player with stochastic step.
- Need multi-actor state: players with control bindings, enemies with chasing AI, coins as pickups. Provide actions: `user.move` keyed by player, `tick.enemyChase` selecting movement vector via distance metric (torus-aware), `tick.spawnCoin` when collected.
- Score increments when coin collected; maintain scoreboard. Provide config UI for numeric inputs and key mapping (later extension). Ensure deterministic RNG for enemy randomness.

### Match and Memory【F:references/match-and-memory/src/main.ts†L1-L200】【F:references/match-and-memory/src/main.ts†L200-L400】

- Deck sourced from JSON; duplicate deck, shuffle, render flip cards. Players take turns (supports multiple players) with scoring per match and round counter after each full turn cycle.
- Selected cards tracked to enforce sequence length (pairs). Matching predicate compares base card id; success marks matched, increments score; failure schedules delayed flip-back with audio feedback.
- Engine support: `Deck` component with `cards`, `matched` flags; actions `user.flip` with guard `!matched && selection < n`. Use scheduler to enqueue delayed actions (for flip-back). Multi-player turn order management with scoreboard UI.

### Battleship【F:references/battleship/app.ts†L1-L60】【F:references/battleship/grid.ts†L1-L200】【F:references/battleship/grid.ts†L200-L321】【F:references/battleship/ship.ts†L1-L60】

- Two grids (player/computer) on 10x10 coordinate system (A-J,1-10). Player places ships via drag/drop with rotation; computer randomly positions ships ensuring no overlaps. Gameplay alternates shots; hits mark squares, track ship health, declare sunk and end game when fleet destroyed.
- Engine modules: `Fleet` entity per player containing ships with length/hits. Actions: `setup.placeShip`, `user.fire` applying `hit`/`miss` updates, `ai.fireRandom`. Rules include guard preventing repeated shots and checking game end when `ships.length === 0`.
- Need adjacency/topology for linear ship placement, occupancy checks, and event-driven UI for drag/drop (impure adapter). Scoreboard messages update per hit/miss.

## Implementation Sequencing

1. Finalize configuration schema + Effect Schemas; build parser/validator.
2. Implement pure core modules (state, reducer, scheduler, RNG, rule interpreter, effect ops).
3. Create Canvas/Three renderer adapter and React-based config panel (Tailwind + shadcn forms).
4. Build engine runtime bridging UI (Effect layers) and pure core.
5. Encode presets for Tic-Tac-Toe, Snake, Minesweeper, Life, Cell Dodger, Match & Memory, Battleship using schema and confirm behaviors via automated simulations/tests.
