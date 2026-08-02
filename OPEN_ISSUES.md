# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (M31 graph hop-ball closed). Do
not ask which fork — pick the smallest new seam under
`next-missing-mechanism`, then P4 tooling/docs.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Graph hop-ball (`movement.graphReach = hop` + Graph Hop Race) landed as M31.
Chain-walk remains the default; hop BFS may turn at junctions.

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- fire→move phase reorder (only if a new seam / anchor appears)
- Simultaneous deduction compound / commitReveal / joint UCT (extensions of M30)
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
      simultaneous, phases incl. move→fire + deduction query→eliminate, joint
      + ordered sliding, joint + ordered simultaneous replace, simultaneous
      slide+replace, joint replace vacated-origin hybrid, joint UCT under open
      + multi-action + commitReveal simultaneous, hex cube-axis sliding, graph
      chain-walk sliding, **graph hop-ball** (`graphReach`), hex + graph replace
      capture, Guess Who manual eliminate / `autoEliminate`, trait-conjunction
      `queryShape: and`, trait-disjunction `queryShape: or`, `compoundArity` /
      3-clause AND, deduction in-turn phases, simultaneous deduction joint
      query/guess)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite +
Commit Lite + Commit Phases Lite + And Lite + Or Lite + And3 Lite +
**Simultaneous Guess Who Lite** cover query/guess + hypothesis eliminate +
same-turn query→eliminate + 2-clause AND/OR + N-clause AND via `compoundArity`
+ joint simultaneous query/guess. **Graph Hop Race** covers hop-ball BFS
(fire→move / simultaneous deduction extensions still open).
