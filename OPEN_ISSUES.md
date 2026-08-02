# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3 → P4** in order (P4 tooling-ci closed). Do not ask
which fork — pick the smallest new seam under `next-missing-mechanism`, or
finish **P4 semantics-doc-refresh**.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

CommitReveal + multi-action simultaneous move (`actionsPerTurn > 1` under
`commitReveal` move / Hidden Double Simultaneous Step Race) landed as M40.
P4 tooling-ci landed (`.github/workflows/ci.yml`).

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- fire→move phase reorder (only if a new seam / anchor appears — otherwise
  reject as recombination)
- commitReveal + slide/replace demos (kernel complete — preset-only unless a
  new seam appears)
- multi-action slide/replace under simultaneous (deferred composition; only if
  a new seam appears — not a recombination demo)
- `queryShape: not` (reject unless nested AST / new pruning class)
- Full Go rules (large; prefer smaller seams first)
- Realtime / continuous scheduler (large)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

### P4 — semantics-doc-refresh

**Problem:** `docs/semantics.md` still uses pre-simultaneous event vocabulary.

**Acceptance:**

- [ ] Sync compact draft with current kernel events/state/phases (incl.
      `pieceCaptured`, `queryAnswered` / `guessResult` / `candidateEliminated`,
      simultaneous, phases incl. move→fire + deduction query→eliminate, joint
      + ordered sliding, joint + ordered simultaneous replace, simultaneous
      slide+replace, joint replace vacated-origin hybrid, joint UCT under open
      + multi-action + commitReveal simultaneous, **joint UCT under open
      simultaneous deduction**, **simultaneous deduction manual eliminate /
      simultaneousEliminate**, **commitReveal deduction joint UCT**,
      **commitEliminate / commitReveal + manual eliminate**, **commitMove /
      commitReveal under simultaneous move**, **multi-action simultaneous
      move / actionsPerTurn under open simultaneous move**, **commitReveal +
      multi-action simultaneous move / Hidden Double Simultaneous Step Race**,
      hex cube-axis sliding, graph chain-walk sliding, graph hop-ball
      (`graphReach`), hex + graph replace capture, Guess Who manual eliminate /
      `autoEliminate`, trait-conjunction `queryShape: and`, trait-disjunction
      `queryShape: or`, `compoundArity` / 3-clause AND, deduction in-turn
      phases, simultaneous deduction joint query/guess, simultaneous compound
      deduction, simultaneous deduction commitReveal / `commitQuery` /
      `commitGuess` / `commitEliminate`)

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Full Go remains a candidate under `next-missing-mechanism`. Guess Who Lite +
Commit Lite + Commit Phases Lite + And Lite + Or Lite + And3 Lite +
Simultaneous Guess Who Lite + Simultaneous Guess Who Commit Lite +
Simultaneous Guess Who And Lite + Hidden Simultaneous Guess Who Lite +
**Hidden Simultaneous Guess Who Commit Lite** cover query/guess + hypothesis
eliminate + same-turn query→eliminate + 2-clause AND/OR + N-clause AND via
`compoundArity` + joint simultaneous query/guess + joint simultaneous manual
eliminate + joint simultaneous compound AND + hidden commitReveal under
simultaneous deduction + commitReveal deduction joint UCT + **commitReveal +
manual eliminate (`commitEliminate`)**. **Hidden Simultaneous Step Race**
covers commitReveal under simultaneous move / `commitMove`. **Double
Simultaneous Step Race** covers `actionsPerTurn > 1` under open simultaneous
move. **Hidden Double Simultaneous Step Race** covers commitReveal +
`actionsPerTurn > 1` under simultaneous move. Graph Hop Race covers hop-ball
BFS. Open simultaneous deduction joint UCT covers agent search over
query/guess(/eliminate) cartesian (fire→move still open if an anchor appears).
CI green gate: `.github/workflows/ci.yml` (Node 20.19 + pnpm 10.5.2).
