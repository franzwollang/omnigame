# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M14 ordered simultaneous replace
closed). Do not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Ordered simultaneous replace (sequential capture apply, range 1) landed as M14.

Pick the smallest remaining new seam that existing primitives cannot express, e.g.:

- Simultaneous slide + replace (range > 1 with capture targets)
- Richer multi-phase machines beyond current `turn.phases`
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
      `pieceCaptured`, `queryAnswered` / `guessResult`, simultaneous, phases,
      joint + ordered sliding, joint + ordered simultaneous replace)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite
covers the README query/guess MVP seam (richer commit/hypothesis still open).
