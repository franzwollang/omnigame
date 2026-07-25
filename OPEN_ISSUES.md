# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M1 in progress)

### game-kernel-abi

Scaffold exists (`src/engine/kernel.ts`: `initialState` / `legalActions` / `step` +
`stepSync`). Remaining work to close M1:

- Wire sandbox play through the kernel (thin `useGameEngine` to consume `step` events)
- Prefer Effect composition at edges; keep reducer pure until features migrate
- Deferred knobs (wrap, non-down gravity, etc.) implement behind this ABI—not the old path

**Acceptance:** See `PLANNING.md` M1 exit criteria.

### contract-validation-coverage

**Problem:** `src/engine/contracts.ts` defines input/overflow-related contracts, but
`buildFeatureContracts()` in `src/engine/validateConfig.ts` only wires placement mode,
capture, and n-in-a-row—so composition checks under-claim.

**Acceptance:**

- [ ] Validation builds contracts for the features actually selected by a config (input mode, overflow, etc.)
- [ ] Invalid compositions surface clear errors via `validateConfig` / Zod refine

### server-validation-unwired

**Problem:** `app/actions/validate-config.ts` (Zod + contracts + Z3) is not imported by the
sandbox UI; client only runs `zConfig.safeParse`.

**Acceptance:**

- [ ] Decide: wire into sandbox (e.g. on Format / Validate) **or** document as optional CLI/dev tool and stop implying server validation in architecture notes
- [ ] If wired: user-visible errors for contract/Z3 failures

---

## Near-term (M2)

### game-ir-replay

Serializable IR / action log + deterministic replay from seed.

**Acceptance:** See `PLANNING.md` M2 exit criteria.

---

## Later (M3+)

### observation-partial-info

First-class observation models (fog, hit/miss) enabling Battleship-lite.

### topology-beyond-rectangle

Hex and/or general graph boards while keeping grid ergonomics.

### reference-game-ports

Select anchors by **missing mechanism**, not by exhausting `references/` (see
project-structure rule). Candidates only earn a slot when they unlock something
new (e.g. observation, tick, Move, liberties, hex). Ship as presets + tests—not
forked engines.

### debug-and-agents

Legal-move overlays, “why illegal,” event trace; random/greedy/(tiny) MCTS agents on kernel only.

### library-explorer

Config sampling UI to explore playable vs unplayable space.
