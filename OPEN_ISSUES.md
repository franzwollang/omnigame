# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-stack review)

### next-missing-mechanism

**Sliding movement** landed on tip `#47` (merged to main) — `movement.range` 1..8
on rectangle (blocker-aware ray walk) + Slide Race + tests. Hex/graph stay at
range 1. Pick the **next smallest** unlock the engine still lacks — not another
recombination of covered primitives (see project-structure selection principle).

Candidates only when they force a new seam, e.g.:

- capture-by-replacement (or capture piece tables) on move
- richer multi-phase game machines beyond fleet + in-turn phases
- hex/graph sliding (only if a new seam appears; range>1 deferred there)

**Acceptance:**

- [ ] Name the mechanism and why existing primitives cannot express it
- [ ] Schema + Kernel path + preset (or library family) + transcript tests
- [ ] No forked per-game engine

### simultaneous-sliding-path-integrity

**Problem (code review after `#47`):** Schema allows `movement.range > 1` together
with simultaneous move. Legality uses pre-round `canMove` (ray clear), but
`applySimultaneousMovePair` in `src/engine/reducer.ts` only re-checks `from`
ownership and `to` emptiness on ordered resolve — not intermediate path cells.
Confirmed hole: ordered (`resolveOrder`) + `range > 4` can let a later seat
teleport past a piece that landed on its ray. Joint simultaneous can also
“pass through” rays when destinations differ.

Presets (Slide Race alternating; Simultaneous Step Race `range: 1`) do not hit
this; the composition is still schema-legal.

**Acceptance:**

- [ ] Either re-validate path blockers at apply time (ordered + joint), **or**
      schema/contracts forbid `range > 1` under `schedule = simultaneous`
- [ ] Regression test covering ordered simultaneous + sliding path conflict
- [ ] Document the chosen policy in README / semantics

### sandbox-form-movement-gap

**Problem:** Engine + JSON support `movement.adjacency` / `movement.range`, but
`app/sandbox/form.tsx` does not expose them (JSON/presets only). Same class of
honesty gap as earlier schema↔UI drift; README’s “form mirrors schema” claim is
overstated for piece tables.

**Acceptance:**

- [ ] Form controls for adjacency + range when `input.mode = move`, **or**
      README/UI explicitly mark movement as JSON-only
- [ ] No silent impression that the form covers the full schema

### tooling-node-pnpm

Lockfile/`engines` fix landed on main (`pnpm@10.5.2`, Node `>=20.19.0`). Cloud
agent tip ran 288 tests green. Remaining:

- [ ] Add CI (if desired) pinning Node ≥20.19 and pnpm 10.5.2 — no `.github`
      workflows yet

---

## Later

### reference-game-ports

Mechanism anchors through sliding `movement.range` are landed (see
`PLANNING.md` “What exists today”). Further ports only when a **new** missing
mechanism appears — not a backlog of `references/`.
