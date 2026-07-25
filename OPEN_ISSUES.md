# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (pre-M1 hygiene)

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

### sandbox-type-looseness

**Problem:** Sandbox / engine hook use `(config as any)` and `@ts-ignore` (e.g. pop-out),
weakening the typed-config story.

**Pointers:** `app/sandbox/page.tsx`, `src/engine/useGameEngine.ts`

**Acceptance:**

- [ ] Engine config type covers pop-out and other used fields without ignores
- [ ] Sandbox maps `Config` → engine input without `any` (or with a single typed adapter)

---

## Near-term (M1–M2)

### game-kernel-abi

Introduce a stable `GameKernel`-shaped boundary (`initialState`, `legalActions`, `step`
returning events). Move stepping into Effect-backed core; sandbox consumes events.
Deferred schema knobs (wrap, gravity dirs, etc.) implement here—not in the pre-kernel reducer.

**Acceptance:** See `PLANNING.md` M1 exit criteria.

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
