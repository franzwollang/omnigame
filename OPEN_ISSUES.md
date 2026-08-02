# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3** `next-missing-mechanism`. Do not ask which fork —
pick the smallest new seam; reject recombinations without an anchor.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Flood-fill region reveal (`observation.mode = flood_reveal` + `clear_hazards` +
`hazards` + Minesweeper Lite) landed as **M44**. P4 tooling-ci and
semantics-doc-refresh already closed (M41–M42).

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- fire→move phase reorder (only if a new seam / anchor appears — otherwise
  reject as recombination)
- Flags / chord-click on flood_reveal (only if a new seam appears — otherwise
  recombination of reveal)
- Hex/graph hazard adjacency (only if a new seam appears)
- commitReveal + slide/replace demos (kernel complete — preset-only unless a
  new seam appears)
- multi-action slide/replace under simultaneous (deferred composition; only if
  a new seam appears — not a recombination demo)
- `queryShape: not` (reject unless nested AST / new pruning class)
- Full Go rules (large; prefer smaller seams first)
- Realtime / continuous scheduler (large)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

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
BFS. **Jump Race** covers leap-over capture + same-seat chains
(`movement.capture = jump` / `mustContinueFrom`). **Minesweeper Lite** covers
flood-fill region reveal (`flood_reveal` / `clear_hazards` / `hazards`). Open
simultaneous deduction joint UCT covers agent search over query/guess(/eliminate)
cartesian (fire→move still open if an anchor appears). CI green gate:
`.github/workflows/ci.yml` (Node 20.19 + pnpm 10.5.2). Semantics draft:
`docs/semantics.md` (M42 refresh; jump in M43; flood_reveal in M44).
