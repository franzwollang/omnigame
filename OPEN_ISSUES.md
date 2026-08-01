# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (P0–P2 / M8 closed). Do not ask
which fork — start capture-by-replacement (M9).

---

## Immediate (prioritized)

### P3 — capture-by-replacement (default next mechanism)

**Why existing primitives fail:** Move only allows empty destinations.
Chess-like / attrition races need **move onto enemy → remove occupant**.
Liberties/flip capture are place-centric, not move-replace.

**Mini-spec:**

- Schema: e.g. `movement.capture = "none" | "replace"` (name OK if documented);
  rectangle foothold; require `input.mode = move`
- Kernel/reducer: enemy cells legal destinations when replace on; apply clears
  occupant then lands; emit events
- Illegal: own-piece destination; sliding path empty except destination
- Preset: **Replace Race** (reach_row + replace)
- Tests: transcript, replay, validateConfig rejects bad combos
- Out of scope: multi-jump checkers, capture chains, hex/graph (unless free)

**Acceptance:**

- [ ] Schema + contracts + kernel path
- [ ] Preset + transcript/replay tests
- [ ] PLANNING M9 → `done`; hand off next mechanism

### P3 — next-missing-mechanism (after capture)

Only after capture-by-replacement. Pick smallest new seam, e.g.:

- Guess Who-like query / commit (README MVP anchor)
- Richer multi-phase machines beyond current `turn.phases`
- Apply-time simultaneous sliding (re-open composition)
- Hex/graph `range > 1` (only if a new seam appears)
- Joint UCT / MCTS over simultaneous actions (deeper than P2 label)

**Acceptance:** schema + kernel + preset + tests; mechanism-first.

### P4 — tooling-ci

- [ ] Optional `.github/workflows` pinning Node ≥20.19 + pnpm 10.5.2
      (`typecheck` + `test`)

### P4 — semantics-doc-refresh

**Problem:** `docs/semantics.md` still uses pre-simultaneous event vocabulary.

**Acceptance:**

- [ ] Sync compact draft with current kernel events/state/phases

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Guess Who-like / full Go remain deferred under post-capture
`next-missing-mechanism`.
