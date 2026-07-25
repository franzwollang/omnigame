# OmniGame Planning

Roadmap and coordination only. Concrete open work lives in `OPEN_ISSUES.md`.
Vision / non-goals: `README.md`. Formal composition draft: `docs/semantics.md`.

## Status board

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

**Optimizing for this phase:** Horizontal pop-out landed (Connect 4 Right Pop
Out). Hand off to the next **missing mechanism** (see `OPEN_ISSUES.md`).

## Decisions (locked)

| Topic | Decision |
|---|---|
| FP runtime | **Effect.ts** — core + edge services; keep Zod at the JSON/UI boundary until Effect Schema migration is deliberate |
| M0 vs Kernel | **Hybrid:** short honesty pass (narrow/label), then Kernel+Effect — do **not** expand the plain reducer for every unused knob first |
| Product surface (near-term) | **Sandbox composer** + **Library explorer** (sample/classify/score; share links; load finds). |

### Why this sequencing

Implementing full gravity/wrap/realtime in today’s plain reducer, then redoing it under Effect +
Kernel, doubles work. Better:

1. **M0** — make the UI honest (remove or mark unsupported fields); install Effect; add
   transcript tests for what already works; label Reversi accurately.
2. **M1** — introduce `GameKernel` and move stepping/legal-actions into Effect-backed core;
   UI reads `step` events. New mechanics land here, not in the old reducer.

## Product surfaces (what they are)

Two different UIs, same engine:

| Surface | Question it answers | Interaction |
|---|---|---|
| **Sandbox (composer)** | “Can I author *this* game and play it?” | You edit JSON/form for one config; board updates; browse presets |
| **Library explorer** | “What’s out there in config-space?” | System samples/randomizes many configs; most are junk; you hunt for rare playable hybrids |

Near-term focus = sandbox composer + library explorer (graph sampling, scores, share links).

## What exists today

Working sandbox slice (see README “Current implementation status”):

- Rectangular grid; cell / column / row input
- Direct + gravity placement (down | up | left | right; column ↔ vertical, row ↔ horizontal)
- Capture (flip demo); n-in-a-row wins
- Column/row pop-out: bottom↔down, top↔up, right↔right, left↔left
- Presets: Tic-Tac-Toe, Connect 4, Connect 4 Up, Connect 4 Right, Connect 4 Pop Out,
  Connect 4 Up Pop Out, Connect 4 Right Pop Out, Gomoku, Capture / Flip Demo,
  Battleship Lite (hit/miss observation), Battleship Place (fleet placement phase),
  Step Race (Move + reach_row),
  Life Lite (manual tick + B3/S23)
- Zod schema + JSON/form sandbox + Three.js canvas
- Effect dependency + seeded RNG foothold (`src/engine/rng.ts`)
- Vitest transcript + kernel + validateConfig + GameIR replay tests
- Sandbox play through `GameKernel` (`useGameEngine` → `stepSync` + event log)
- GameIR v0 (`src/ir/gameIr.ts`): `seed + actions` transcript + sandbox Replay
- Client Zod + contract validation in sandbox; Z3 server action optional/experimental
- Compiler (`src/compiler/`): validate → macros → normalize → GameKernel; sandbox via `compileToGameConfig`
- Observation hit/miss (`src/engine/observation.ts`) + Battleship-lite preset; `fire` + `StepResult.observations`
- Move foothold (`src/engine/movement.ts`): orthogonal step + `reach_row`; Step Race preset
- Tick/scheduler foothold (`src/engine/scheduler.ts`): `manual_tick` + Life B3/S23; Life Lite preset
- Hex topology foothold (`src/engine/topology.ts`): `hex_offset` odd-r + Hex Connect Lite
- Graph topology foothold: `grid.topology = "graph"` + nodes/edges + Graph Connect Lite
- **Wrap foothold:** `grid.wrap` toroidal adjacency (rectangle); Toroidal TTT preset
- Liberties/territory foothold (`src/engine/liberties.ts`): group capture + area_control + Go Lite
- **Simple (point) ko:** `placement.capture.ko` + `GameState.koPoint`; illegal reason `"ko"`
- **Positional superko:** `capture.ko = "positional"` + `GameState.positionHistory`;
  illegal reason `"superko"`; Go Lite Superko preset
- **Situational superko:** `capture.ko = "situational"` + `(board|side)` history
  hashes; Go Lite Situational Superko preset
- **Top pop-out:** `overflow = "pop_out_top"` ↔ gravity up; Connect 4 Up Pop Out
- **Horizontal pop-out:** `pop_out_right` / `pop_out_left` + `popOutRow`;
  Connect 4 Right Pop Out
- Debug + agents (M6): legal-move overlay, `explainAction` why-illegal, event trace;
  `src/agents/` random / greedy / tiny MCTS / UCT on kernel only
- Library explorer (M7): `src/library/` sample + playability classify; sandbox Library modal

Not yet: full Go rules, hex/graph wrap, simultaneous/delayed actions.

## Milestone exit criteria

### M0 — Honesty pass + Effect foothold

- Unsupported schema fields are removed from the form **or** marked unsupported (no silent no-ops).
- Prefer narrowing schema for `realtime`, non-down gravity, `pop_out_top`, `wrap` until Kernel+Effect — unless a one-liner is trivial and tested.
- Reversi preset labeled honestly (or endgame fixed — prefer label in M0).
- `effect` package installed; one small pure module (e.g. seeded RNG or Option helpers) proves the dependency.
- Minimal test harness + transcript tests for TTT / Connect 4 / one capture sequence.
- Docs: README stack says Effect is in use / being adopted; drop false claims (`jumpPanTo`, “XState transitions” until true).

Related: Immediate issues in `OPEN_ISSUES.md`.

### M1 — GameKernel + Effect core + events

- Typed `GameKernel` with `initialState` / `legalActions` / `step` (events out).
- Core stepping lives under Effect (pure logic; Effect at composition/runtime edges as needed).
- Sandbox plays presets through the kernel; old ad-hoc hook thins down.
- Schema↔engine parity work for *kept* knobs happens as features move behind the kernel.

### M2 — GameIR + replay

- Serializable action/event transcript; `seed + actions → same state`.
- Minimal replay path in sandbox.

**Done:** `src/ir/gameIr.ts` + tests; sandbox Replay button re-runs action log.

### M3 — Compiler / normalize

- Validate → normalize → kernel builder; macros → named primitives only.

**Done:** `src/compiler/` (`compile` / macros / `normalizeConfig`); sandbox +
presets play through it; `gravity.enabled` and `placements→initial` macros.

### M4 — Observation + Battleship-lite

- Hit/miss (+ hidden placement) observation; Battleship-lite preset.

**Done:** `observation.mode` / `objective.mode` in schema; hidden fleet layer;
`fire` action; per-player `observe()` on kernel steps; Battleship-lite preset +
tests. Fleet placement phase (`fleet.ships` + Battleship Place) landed post-M7.

### M5 — Anchor / reference ports

- Port or invent anchors **only when each unlocks a new mechanism** (see selection
  principle in `.cursor/rules/project-structure.mdc`). Not “finish `references/`.”
- Each port has transcript/simulation tests for the mechanism it claims to prove.

**Done:** Step Race (Move), Life Lite (tick), Hex Connect Lite
(`hex_offset`), Go Lite (liberties + area_control + simple ko), Graph Connect Lite
(`graph`). Planned M5 mechanism slots covered; optional later anchors still
allowed by selection principle.

### M6 — Debug tooling + agents

- Legal-move / “why illegal” / event trace; random/greedy/(tiny) MCTS on kernel only.

**Done:** `explainAction` + `highlightCellsForActions`; sandbox legal overlay +
why-illegal + full event log; `src/agents/` random/greedy/tiny MCTS + Agent step.
Post-M6 depth: UCT (`createUctAgent`) with tree reuse landed; hit/miss-aware
agents still open.

### M7 — Library explorer

- Sample/randomize configs; surface playable vs noise (Library of Babel framing).

**Done:** `src/library/` (`sample` / `assessPlayability` / `exploreLibrary`) +
sandbox Library modal (load playable finds). Heuristics: compile → opening
legality → short random playout. Post-M7: graph topology + UCT agent landed;
hand off to fog observation / hit-miss agents / library depth.

## Sequencing notes

1. M0 honesty = **label/narrow**, not “implement every knob in the old reducer.”
2. M1 before M4–M6 — observation, agents, and new mechanics sit on the ABI.
3. Effect Schema migration is optional later; Zod can remain the sandbox JSON validator initially.
4. `references/` is a design corpus, not a backlog — select by missing mechanism.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous physics
first; no arbitrary user code in specs.
