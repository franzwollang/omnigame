# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M0 — honesty + Effect foothold)

### schema-engine-parity

**Problem:** Several Zod/schema knobs are accepted (and often editable in the form) but
ignored or only partially implemented in `src/engine/reducer.ts`.

Known gaps:

- Gravity `direction`: schema allows `up|left|right`; engine only implements `down`
- `placement.overflow = "pop_out_top"`: schema + form; no reducer path (bottom pop-out exists as a separate action)
- `grid.wrap`: unused by reducer / win / capture
- `turn.mode = "realtime"`: unused (`turnMachine.ts` is a manual scaffold)
- `rng.seed`: present in config; not consumed for deterministic simulation

**Policy (locked):** M0 prefers **narrow/remove/mark unsupported** over implementing in the
plain reducer. Full behavior for deferred knobs lands in M1+ behind GameKernel + Effect.

**Pointers:** `src/schemas/config.ts`, `src/engine/reducer.ts`, `src/engine/useGameEngine.ts`, `app/sandbox/form.tsx`

**Acceptance:**

- [ ] Each field above is either deferred (schema/UI narrowed or marked unsupported) or trivially implemented + tested
- [ ] Sandbox cannot present a config that “looks valid” but silently no-ops an advertised mechanic

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

### reversi-endgame-wrong

**Problem:** Reversi preset enables capture but still uses `win.length` n-in-a-row (5). Real
Othello ends when neither player can move; score by disc count.

**Pointers:** `src/presets/registry.ts`, `src/engine/capture.ts`, `src/engine/rules.ts`

**Acceptance:**

- [ ] Either implement pass / no-moves terminal + majority scoring for capture games, **or** rename/describe preset as “capture / flip demo” until endgame exists
- [ ] README preset list matches behavior

### no-core-tests

**Problem:** No `*.test.ts` / `*.spec.ts` harness. README and `docs/semantics.md` call for
property/transcript tests; none exist.

**Acceptance:**

- [ ] Test runner configured (project choice: Vitest or Jest-compatible)
- [ ] Transcript tests for at least Tic-Tac-Toe win + Connect 4 gravity drop + one capture flip sequence
- [ ] `pnpm` script (e.g. `test`) documented in README or package.json scripts

### effect-foothold

**Problem:** Decision is to work in Effect.ts, but `effect` is not a dependency and core is
plain TS reducers. Need a real foothold before M1 Kernel migration.

**Acceptance:**

- [ ] `effect` added via pnpm; version pinned in lockfile
- [ ] At least one small core helper uses Effect (e.g. seeded RNG service boundary or Option/Either-style result for illegal moves)
- [ ] README tech stack: Effect is adopted / in progress (not merely “planned”)

### dead-deps-and-docs-drift

**Problem:** Docs/stack claims drift from code.

- `xstate` in `package.json` with zero app imports; `turnMachine.ts` is hand-rolled
- README mentions `window.jumpPanTo` (not found in canvas) and XState-structured transitions
- Effect was “planned”; now directed — docs must catch up after foothold

**Acceptance:**

- [ ] XState: wire for real in M1+ **or** remove dependency and demote claim in README
- [ ] Remove or implement `jumpPanTo` claim
- [ ] README “Tech stack” / architecture notes match reality after M0

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
