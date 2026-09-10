# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

**Marathon rule:** Work **P3** `next-missing-mechanism`. Do not ask which fork —
pick the smallest new seam; reject recombinations without an anchor.

---

## Immediate (prioritized)

### P3 — next-missing-mechanism

Double Simultaneous Jump Race (`double-simultaneous-jump-race` /
`actionsPerTurn > 1` × simultaneous jump; same-piece double-hop without
`mustContinueFrom`) landed as **M84**. Hidden Simultaneous Jump Race closed
as M83; Ordered Simultaneous Jump Race as M82; Simultaneous Jump Race as
M81; Go Lite Approach Net as M80; Sente Ladder as M79; Loose Net as M78;
Net as M77; Nakade as M76; Semeai as M75; Territory Prisoners as M74;
Ladders as M73; Mark Dead Resume as M72; Mark Dead as M71; Dame Fill as
M70; Benson as M69; dead stones as M68; seki as M67; komi as M66; hub-graph
forward-only men as M65; graph forward-only men as M64; hex forward-only
men as M63; graph flying capture as M62; hex flying capture as M61;
hub-graph promotion as M60; graph promotion as M59; hex promotion as M58;
graph liberties as M57; hex liberties as M56; flying jump capture as M55;
graph flood_reveal as M54; hex flood_reveal as M53; flying kings as M52;
longest mandatory capture as M51; forward-only men as M50; crowned
promotion as M49; graph jump as M48; hex jump as M47; memory flip as M46;
mustCapture as M45; rectangle flood_reveal as M44. P4 tooling-ci and
semantics-doc-refresh already closed (M41–M42; semantics notes continue
per mechanism).

Pick the smallest remaining new seam that existing primitives cannot express,
e.g.:

- Fuller Go remainder (throw-in / snapback / connect-and-die) — only if a
  board uniquely escapes ladder/net/sente/approach (prior probe did not)
- Hidden multi-action simultaneous jump (`commitReveal` + `actionsPerTurn > 1`
  + `capture=jump`) — schema-allowed; preset/tests if a new seam appears
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
- Hex/graph simultaneous jump ports (topology ports — only if a new seam
  appears)
- Hex/graph seki, dead-stone, Benson, dame-fill, mark-dead, mark-dead-resume,
  ladderDeath, territoryPrisoners, semeaiDeath, nakadeDeath, netDeath,
  looseNetDeath, senteLadderDeath, or approachNetDeath presets (topology
  ports — only if a new seam appears)

**Acceptance:** schema + kernel + preset + tests; mechanism-first (do not
exhaust `references/` or recombine covered primitives).

---

## Later

### reference-game-ports

Further ports only for **new** mechanisms — not exhausting `references/`.

### deferred-mvp-anchors

Guess Who-like remainder / full Go remain deferred under
`next-missing-mechanism` (post-multi-action-jump; prefer hidden multi-action
jump follow-ons or a uniquely expressible Go seam over topology ports).
