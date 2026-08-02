# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3** `next-missing-mechanism`. Do not ask which fork —
pick the smallest new seam; reject recombinations without an anchor.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Forward-only men (`promotion.menForwardOnly` + Forward Men Jump Lite) landed
as **M50**. Crowned promotion closed as M49; graph jump as M48; hex jump as
M47; memory flip as M46; mustCapture as M45; flood_reveal as M44. P4 tooling-ci
and semantics-doc-refresh already closed (M41–M42).

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- fire→move phase reorder (only if a new seam / anchor appears — otherwise
  reject as recombination)
- Flags / chord-click on flood_reveal (only if a new seam appears — otherwise
  recombination of reveal)
- Hex/graph hazard adjacency (only if a new seam appears)
- Memory bonus-turn-on-match / custom decks (schema field exists; deferred)
- commitReveal + slide/replace demos (kernel complete — preset-only unless a
  new seam appears)
- multi-action slide/replace under simultaneous (deferred composition; only if
  a new seam appears — not a recombination demo)
- `queryShape: not` (reject unless nested AST / new pruning class)
- Longest-chain mandatory / hex-graph promotion (extensions of M49/M50 —
  only if a new seam appears)
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
(`movement.capture = jump` / `mustContinueFrom`). **Mandatory Jump Race**
covers Checkers-lite turn-start mandatory capture (`mustCapture`).
**Hex Jump Race** covers jump on `hex_offset` (cube-axis). **Graph Jump Race**
covers jump on `graph` (2-edge leap-over; simultaneous jump still deferred).
**Crowned Kings Jump Lite** covers Transform-lite promotion
(`movement.promotion` / `X+`|`O+` / `piecePromoted`; rectangle jump only).
**Forward Men Jump Lite** covers Checkers-lite forward-only men
(`promotion.menForwardOnly`; uncrowned row-delta filter; crowned unrestricted).
**Minesweeper Lite** covers flood-fill region reveal (`flood_reveal` /
`clear_hazards` / `hazards`). **Memory Flip Lite** covers tile pair-matching
(`memory_flip` / `flip` / `match_pairs` / `memory`). Open simultaneous
deduction joint UCT covers agent search over query/guess(/eliminate) cartesian
(fire→move still open if an anchor appears). CI green gate:
`.github/workflows/ci.yml` (Node 20.19 + pnpm 10.5.2). Semantics draft:
`docs/semantics.md` (M42 refresh; jump in M43; flood_reveal in M44;
mustCapture in M45; memory_flip in M46; hex jump in M47; graph jump in M48;
promotion in M49; menForwardOnly in M50).
