# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3** `next-missing-mechanism`. Do not ask which fork —
pick the smallest new seam; reject recombinations without an anchor.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Go Lite Benson (`go-lite-benson` / `objective.bensonLife` vital-region
unconditional life) landed as **M69**. Go Lite Dead Stones closed as M68;
seki as M67; komi as M66; hub-graph forward-only men as M65; graph forward-only
men as M64; hex forward-only men as M63; graph flying capture as M62; hex
flying capture as M61; hub-graph promotion as M60; graph promotion as M59; hex
promotion as M58; graph liberties as M57; hex liberties as M56; flying jump
capture as M55; graph flood_reveal as M54; hex flood_reveal as M53; flying
kings as M52; longest mandatory capture as M51; forward-only men as M50;
crowned promotion as M49; graph jump as M48; hex jump as M47; memory flip as
M46; mustCapture as M45; rectangle flood_reveal as M44. P4 tooling-ci and
semantics-doc-refresh already closed (M41–M42; semantics notes continue per
mechanism).

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- Fuller Go remainder beyond Benson (e.g. semantic life/death / damezukai)
- fire→move phase reorder (only if a new seam / anchor appears — otherwise
  reject as recombination)
- Flags / chord-click on flood_reveal (only if a new seam appears — otherwise
  recombination of reveal)
- Memory bonus-turn-on-match / custom decks (schema field exists; deferred —
  bonusTurnOnMatch is kernel-complete / preset-only)
- commitReveal + slide/replace demos (kernel complete — preset-only unless a
  new seam appears)
- multi-action slide/replace under simultaneous (deferred composition; only if
  a new seam appears — not a recombination demo)
- `queryShape: not` (reject unless nested AST / new pruning class)
- Realtime / continuous scheduler (large)
- Simultaneous jump (large composition; deferred)
- Hex/graph seki, dead-stone, or Benson presets (topology ports — only if a
  new seam appears)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Fuller Go remains a candidate under `next-missing-mechanism` (komi M66 + seki
M67 + dead-stone lite M68 + Benson M69 landed; semantic life/death still open).
Guess Who Lite + Commit Lite + Commit
Phases Lite + And Lite + Or Lite + And3 Lite + Simultaneous Guess Who Lite +
Simultaneous Guess Who Commit Lite + Simultaneous Guess Who And Lite + Hidden
Simultaneous Guess Who Lite + **Hidden Simultaneous Guess Who Commit Lite**
cover query/guess + hypothesis eliminate + same-turn query→eliminate +
2-clause AND/OR + N-clause AND via `compoundArity` + joint simultaneous
query/guess + joint simultaneous manual eliminate + joint simultaneous
compound AND + hidden commitReveal under simultaneous deduction +
commitReveal deduction joint UCT + **commitReveal + manual eliminate
(`commitEliminate`)**. **Hidden Simultaneous Step Race** covers commitReveal
under simultaneous move / `commitMove`. **Double Simultaneous Step Race**
covers `actionsPerTurn > 1` under open simultaneous move. **Hidden Double
Simultaneous Step Race** covers commitReveal + `actionsPerTurn > 1` under
simultaneous move. Graph Hop Race covers hop-ball BFS. **Jump Race** covers
leap-over capture + same-seat chains (`movement.capture = jump` /
`mustContinueFrom`). **Mandatory Jump Race** covers Checkers-lite turn-start
mandatory capture (`mustCapture`). **Mandatory Longest Jump Lite** covers
Draughts-lite max-length capture (`mustLongestCapture`). **Hex Jump Race**
covers jump on `hex_offset` (cube-axis). **Graph Jump Race** covers jump on
`graph` (2-edge leap-over; simultaneous jump still deferred). **Crowned Kings
Jump Lite** covers Transform-lite promotion (`movement.promotion` / `X+`|`O+`
/ `piecePromoted`; rectangle jump only). **Hex Crowned Jump Lite** covers
promotion on `hex_offset` (orthogonal crownedAdjacency + `crownedRange`; no
menForwardOnly). **Graph Crowned Jump Lite** covers promotion via
`targetRows` (lane graphs; orthogonal crownedAdjacency + `crownedRange`).
**Graph Hub Crowned Jump Lite** covers promotion via `targetNodes` (hub vs
same-row decoy; graph-only). **Forward Men Jump Lite** covers Checkers-lite
forward-only men (`promotion.menForwardOnly`; uncrowned row-delta filter;
crowned unrestricted). **Hex Forward Men Jump Lite** covers the same on
`hex_offset` (cube-axis lands filtered by offset-row sign). **Graph Forward
Men Jump Lite** covers the same on `graph` (edge-distance toward promo row).
**Graph Hub Forward Men Jump Lite** covers the same on `graph` via hub-key
edge-distance (`targetNodes`; same-row decoy blocked). **Flying Kings Jump
Lite** covers Draughts-lite flying kings (`promotion.crownedRange` — crowned
quiet slides longer than men; jump leaps unchanged without flying capture).
**Flying Capture Jump Lite** covers Draughts-lite flying jump capture
(`promotion.crownedFlyingCapture` — crowned ray leap with empty approach +
long land). **Hex Flying Capture Jump Lite** covers the same on `hex_offset`
(cube-axis flying leap). **Graph Flying Capture Jump Lite** covers the same
on `graph` (chain-walk flying leap). **Minesweeper Lite** covers flood-fill
region reveal (`flood_reveal` / `clear_hazards` / `hazards`) on rectangle.
**Hex Minesweeper Lite** covers hex cube-axis-6 hazard adjacency. **Graph
Minesweeper Lite** covers graph explicit-edge hazard adjacency (max degree ≤
8). **Memory Flip Lite** covers tile pair-matching (`memory_flip` / `flip` /
`match_pairs` / `memory`). **Hex Go Lite** covers liberties + area_control on
`hex_offset` (cube-axis-6). **Graph Go Lite** covers liberties + area_control
on `graph` (explicit-edge). **Go Lite Komi** covers `objective.komi`
second-player scoring offset. **Go Lite Seki** covers `objective.seki`
shared-life territory exclusion. **Go Lite Dead Stones** covers
`objective.deadStones` pass-alive lite interior corpse removal. **Go Lite
Benson** covers `objective.bensonLife` vital-region unconditional life.
Open simultaneous deduction joint UCT covers
agent search over query/guess(/eliminate) cartesian (fire→move still open if
an anchor appears). CI green gate: `.github/workflows/ci.yml` (Node 20.19 +
pnpm 10.5.2). Semantics draft: `docs/semantics.md` (M42 refresh; through M69
bensonLife).
