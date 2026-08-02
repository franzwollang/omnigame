# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M17 joint replace hybrid closed).
Do not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Vacated-origin hybrid for joint replace paths (slide through fleeing blockers)
landed as M17 (`simultaneous-slide-replace-flee-race`).

Pick the smallest remaining new seam that existing primitives cannot express, e.g.:

- Joint UCT / MCTS over simultaneous actions (deeper than labeled random)
- Further phase sequences beyond place→* and move→fire (only if a new seam appears)
- Hex/graph `range > 1` (only if a new seam appears)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

### P4 — tooling-ci

- [ ] Optional `.github/workflows` pinning Node ≥20.19 + pnpm 10.5.2
      (`typecheck` + `test`)

### P4 — semantics-doc-refresh

**Problem:** `docs/semantics.md` still uses pre-simultaneous event vocabulary.

**Acceptance:**

- [ ] Sync compact draft with current kernel events/state/phases (incl.
      `pieceCaptured`, `queryAnswered` / `guessResult`, simultaneous, phases
      incl. move→fire, joint + ordered sliding, joint + ordered simultaneous
      replace, simultaneous slide+replace, joint replace vacated-origin hybrid)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite
covers the README query/guess MVP seam (richer commit/hypothesis still open).
