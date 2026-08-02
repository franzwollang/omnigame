# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M28 compoundArity / 3-clause AND closed).
Do not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Guess Who And3 Lite (`deduction.compoundArity = 3` + 3-clause AND) landed as
M28. Compound query arity is parameterized (default 2 keeps And/Or Lite).

Pick the smallest remaining new seam that existing primitives cannot express, e.g.:

- Further phase sequences beyond place→* and move→fire (only if a new seam appears)
- Hop-ball graph range (distinct from chain-walk — only if a game needs it)
- Deduction + simultaneous / phases (only if forced)
- Higher compoundArity demos / OR-arity presets only if a new seam appears

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

### P4 — tooling-ci

- [ ] Optional `.github/workflows` pinning Node ≥20.19 + pnpm 10.5.2
      (`typecheck` + `test`)

### P4 — semantics-doc-refresh

**Problem:** `docs/semantics.md` still uses pre-simultaneous event vocabulary.

**Acceptance:**

- [ ] Sync compact draft with current kernel events/state/phases (incl.
      `pieceCaptured`, `queryAnswered` / `guessResult` / `candidateEliminated`,
      simultaneous, phases incl. move→fire, joint + ordered sliding, joint +
      ordered simultaneous replace, simultaneous slide+replace, joint replace
      vacated-origin hybrid, joint UCT under open + multi-action + commitReveal
      simultaneous, hex cube-axis sliding, graph chain-walk sliding, hex +
      graph replace capture, Guess Who manual eliminate / `autoEliminate`,
      trait-conjunction `queryShape: and`, trait-disjunction `queryShape: or`,
      `compoundArity` / 3-clause AND)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite +
Commit Lite + And Lite + Or Lite + And3 Lite cover query/guess + hypothesis
eliminate + 2-clause AND/OR + N-clause AND via `compoundArity` (simultaneous
deduction / richer phases / hop-ball still open).
