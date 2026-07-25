# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M5+)

### reference-game-ports

Select anchors by **missing mechanism**, not by exhausting `references/` (see
project-structure rule). Observation (Battleship-lite) and Move/reach_row
(Step Race) are covered.

**Next candidates** (pick one per turn): tick/scheduler, liberties/territory,
hex/graph (`topology-beyond-rectangle`).

**Acceptance:**

- [ ] Next port names the mechanism it unlocks in PLANNING / this issue
- [ ] Shipped as preset + transcript/simulation tests through compiler→kernel
- [ ] Not a forked per-game engine

### topology-beyond-rectangle

Hex and/or general graph boards while keeping grid ergonomics.

**Acceptance:**

- [ ] Schema admits at least one non-rectangle topology
- [ ] Kernel/legalActions/win or movement path works on that topology
- [ ] Preset or transcript test proves the mechanism

### debug-and-agents

Legal-move overlays, “why illegal,” event trace; random/greedy/(tiny) MCTS agents on kernel only.

### library-explorer

Config sampling UI to explore playable vs unplayable space.
