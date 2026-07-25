# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M5+)

### reference-game-ports

Select anchors by **missing mechanism**, not by exhausting `references/` (see
project-structure rule). Covered: observation (Battleship-lite), Move/reach_row
(Step Race), tick/scheduler (Life Lite), hex topology (Hex Connect Lite).

**Next candidates** (pick one per turn): liberties/territory (Go-lite group
capture + area scoring).

**Acceptance:**

- [ ] Next port names the mechanism it unlocks in PLANNING / this issue
- [ ] Shipped as preset + transcript/simulation tests through compiler→kernel
- [ ] Not a forked per-game engine

### debug-and-agents

Legal-move overlays, “why illegal,” event trace; random/greedy/(tiny) MCTS agents on kernel only.

### library-explorer

Config sampling UI to explore playable vs unplayable space.
