# OmniGame Planning

Roadmap and coordination only. Concrete open work lives in `OPEN_ISSUES.md`.
Vision / non-goals: `README.md`. Formal composition draft: `docs/semantics.md`.

## Status board

| ID | Milestone | Status |
|---|---|---|
| M0 | Honesty pass + Effect foothold | `done` |
| M1 | GameKernel ABI + Effect core + event transcripts | `not started` |
| M2 | GameIR + deterministic replay | `not started` |
| M3 | Compiler / normalize / macro expansion | `not started` |
| M4 | Observation primitive + Battleship-lite | `not started` |
| M5 | Anchor / reference-game ports | `not started` |
| M6 | Debug tooling + baseline agents | `not started` |
| M7 | Infinite library / config explorer | `not started` |

**Optimizing for this phase:** land `GameKernel` + Effect-backed `step` / `legalActions`;
sandbox plays through the kernel; deferred knobs wait for that ABI.

## Decisions (locked)

| Topic | Decision |
|---|---|
| FP runtime | **Effect.ts** — core + edge services; keep Zod at the JSON/UI boundary until Effect Schema migration is deliberate |
| M0 vs Kernel | **Hybrid:** short honesty pass (narrow/label), then Kernel+Effect — do **not** expand the plain reducer for every unused knob first |
| Product surface (near-term) | **Sandbox composer** (edit one config, play it). Library explorer is later (M7) |

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

Near-term focus = sandbox. Library explorer needs a solid kernel + playability heuristics first
(that’s why it’s M7).

## What exists today

Working sandbox slice (see README “Current implementation status”):

- Rectangular grid; cell / column input
- Direct + gravity placement (engine: gravity **down** only; schema narrowed)
- Capture (flip demo); n-in-a-row wins
- Presets: Tic-Tac-Toe, Connect 4, Connect 4 Pop Out, Gomoku, Capture / Flip Demo
- Zod schema + JSON/form sandbox + Three.js canvas
- Effect foothold (`src/engine/rng.ts`); Vitest transcript tests
- Unsupported knobs deferred (wrap, realtime, non-down gravity, `pop_out_top`)

Not yet: `GameKernel` / `GameIR`, compiler, observation, hex/graph, play-loop RNG,
wired XState, library explorer.

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

### M3 — Compiler / normalize

- Validate → normalize → kernel builder; macros → named primitives only.

### M4 — Observation + Battleship-lite

- Hit/miss (+ hidden placement) observation; Battleship-lite preset.

### M5 — Anchor / reference ports

- Port or invent anchors **only when each unlocks a new mechanism** (see selection
  principle in `.cursor/rules/project-structure.mdc`). Not “finish `references/`.”
- Each port has transcript/simulation tests for the mechanism it claims to prove.

### M6 — Debug tooling + agents

- Legal-move / “why illegal” / event trace; random/greedy/(tiny) MCTS on kernel only.

### M7 — Library explorer

- Sample/randomize configs; surface playable vs noise (Library of Babel framing).

## Sequencing notes

1. M0 honesty = **label/narrow**, not “implement every knob in the old reducer.”
2. M1 before M4–M6 — observation, agents, and new mechanics sit on the ABI.
3. Effect Schema migration is optional later; Zod can remain the sandbox JSON validator initially.
4. `references/` is a design corpus, not a backlog — select by missing mechanism.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous physics
first; no arbitrary user code in specs.
