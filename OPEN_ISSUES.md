# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M9 capture-by-replacement closed).
Do not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Pick the smallest new seam that existing primitives cannot express, e.g.:

- Guess Who-like query / commit (README MVP anchor)
- Richer multi-phase machines beyond current `turn.phases`
- Apply-time simultaneous sliding (re-open composition)
- Hex/graph `range > 1` (only if a new seam appears)
- Joint UCT / MCTS over simultaneous actions (deeper than labeled random)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

### P4 — tooling-ci

- [ ] Optional `.github/workflows` pinning Node ≥20.19 + pnpm 10.5.2
      (`typecheck` + `test`)

### P4 — semantics-doc-refresh

**Problem:** `docs/semantics.md` still uses pre-simultaneous event vocabulary.

**Acceptance:**

- [ ] Sync compact draft with current kernel events/state/phases (incl.
      `pieceCaptured`, simultaneous, phases)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Guess Who-like / full Go remain candidates under `next-missing-mechanism`.
