# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M22 graph sliding closed).
Do not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Graph chain-walk sliding (`movement.range` 1..8 on `graph`) landed as M22
with `graph-slide-race` (strict edge chains; no junction turns).

Pick the smallest remaining new seam that existing primitives cannot express, e.g.:

- Further phase sequences beyond place→* and move→fire (only if a new seam appears)
- Richer Guess Who commit/hypothesis beyond query+guess MVP
- Hex/graph `capture: replace` (only if a new seam forces it)
- Hop-ball graph range (distinct from chain-walk — only if a game needs it)

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
      replace, simultaneous slide+replace, joint replace vacated-origin hybrid,
      joint UCT under open + multi-action + commitReveal simultaneous,
      hex cube-axis sliding, graph chain-walk sliding)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite
covers the README query/guess MVP seam (richer commit/hypothesis still open).
