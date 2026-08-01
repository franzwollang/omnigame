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
| M8 | Composition honesty (debt + sandbox/agent truth) | `in progress` |
| M9 | Next missing mechanism (default: capture-by-replacement) | `not started` |

**Optimizing for this marathon:** P0 debt closed; **P1 form honesty closed**
(movement + phases controls + in-UI coverage callout). Continue **P2 → P3**
in `OPEN_ISSUES.md` without asking which fork.

## Marathon runbook (cloud agents)

### Environment

- Node `>=20.19.0`, package manager **`pnpm@10.5.2`** (`package.json#packageManager`)
- Green gate (every PR / before handoff):

```bash
pnpm install
pnpm typecheck
pnpm test
```

Optional: `pnpm lint`, `pnpm build`. Baseline: **≥289** Vitest tests (do not
delete or weaken tests — see `.cursor/rules/testing-integrity.mdc`).

### Read order (cold start)

1. `SCRATCHPAD.json` → current focus / next_step  
2. `OPEN_ISSUES.md` → **Immediate (prioritized)** top item  
3. This file → Phase 2 board + Do-not-do  
4. `README.md` status only for vocabulary — not as a task list  

### Task selection (no user ask)

1. Work the highest unfinished **P2 → P3 → P4** item in `OPEN_ISSUES.md`
   (P0–P1 closed).  
2. When P2 composition/honesty items are done, start **P3**
   `capture-by-replacement` using its mini-spec in OPEN_ISSUES.  
3. If blocked on environment only, fix tooling and continue — do not invent
   parallel roadmaps.  
4. After each landed item: update OPEN_ISSUES (resolve + log), PLANNING status,
   SCRATCHPAD, run green gate, checkpoint commit if policy allows.

### Do not do (this phase)

- No new n-in-a-row / gravity-only preset recombinations  
- No exhausting `references/` as a checklist (mechanism-first only)  
- No Effect Schema migration; no arbitrary user code in specs  
- No weakening / skipping tests to go green  
- No hex/graph `movement.range > 1` until a new seam forces it  
- No simultaneous × sliding re-enable until apply-time path integrity exists  
- Do not treat `docs/scratchpad.md` as current backlog  

## Decisions (locked)

| Topic | Decision |
|---|---|
| FP runtime | **Effect.ts** — core + edges; Zod at JSON/UI until Effect Schema is deliberate |
| Product surfaces | Sandbox composer + Library explorer |
| Reference games | Mechanism-first only (`.cursor/rules/project-structure.mdc`) |
| Simultaneous × sliding | **Forbidden** in schema (`range > 1` under simultaneous move) until apply-time path checks exist |
| Marathon priority | Composition honesty **before** new mechanism |

## Product surfaces

| Surface | Question | Interaction |
|---|---|---|
| **Sandbox** | Author *this* game? | JSON/form + play + presets |
| **Library explorer** | What’s in config-space? | Sample / score / share / load finds |

## What exists today (summary)

Kernel + compiler + GameIR + library explorer + agents (random/greedy/hunt/MCTS/UCT).
Mechanisms include: rect/hex/graph topology, wrap (rect+hex), gravity + pop-out
variants, flip + liberties capture, point/positional/situational ko, observation
(hit/miss + fog), fleet placement, Move (orthogonal/diagonal/king + sliding
range on rectangle), tick/Life, simultaneous place/move (incl. ordered, hidden
commit-reveal, multi-action), multi-step turns, delayed place/gravity, in-turn
phases (place→move / place→fire / place→move→fire + `connect_or_destroy`).

Presets: see `src/presets/registry.ts` and README status (includes Fog Connect
Lite, Slide Race, Simultaneous Step Race, Place Move & Fire Lite, Go Lite
variants, etc.).

**Form honesty:** form exposes turn schedule/budget/delay/**phases**,
`movement.adjacency` / `movement.range`, placement, win, observation, etc.,
plus an in-UI “Form coverage” callout for remaining JSON/preset-only fields
(`scheduler`, graph nodes/edges, `initial`, capture, …).

**Not yet:** capture-by-replacement; full Go; hex/graph sliding; joint UCT under
simultaneous; CI workflows; Guess Who / query operator (deferred).

## Phase 2 exit criteria

### M8 — Composition honesty

- Simultaneous × sliding closed (schema forbid **or** apply-time path check + tests)
- Sandbox Agent step works for simultaneous **move** (joint move)
- Form exposes movement (+ phases) **or** README explicitly marks JSON-only — **done** (controls + in-UI coverage callout)
- `isNoop` includes phase budget / ko / positionHistory fields
- Known agent-search limitation under simultaneous documented or improved

### M9 — Capture-by-replacement

- Schema + kernel path for move onto occupied enemy cell (replace)
- Preset + transcript/replay tests
- Contracts/validation; no forked per-game engine

## Sequencing notes

1. Mechanism-first ports only — not “finish `references/`.”  
2. Effect Schema optional later; Zod remains sandbox validator.  
3. Prefer schema honesty over silent no-ops when composition is unsafe.

## Non-goals (keep stable)

From README: not Unity-for-all-genres; not universal optimal solving; no continuous
physics first; no arbitrary user code in specs.
