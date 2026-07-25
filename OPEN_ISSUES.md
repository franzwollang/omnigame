# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M7)

### library-explorer

Config sampling UI to explore playable vs unplayable space (M7). Needs playability
heuristics on top of GameKernel + agents from M6.

**Acceptance:** See `PLANNING.md` M7 exit criteria.

---

## Later

### topology-beyond-rectangle

Hex foothold landed (`hex_offset`). Remaining: general graph boards while keeping
grid ergonomics.

### observation-partial-info

Hit/miss + Battleship-lite landed. Remaining: fog radius, placement-phase /
multi-ship Battleship if still desired.

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties).
Further ports only when a **new** missing mechanism appears — not a backlog.

### richer-mcts-agents

M6 landed random / greedy / tiny flat MCTS. Optional later: UCT tree search,
partial-info agents for hit/miss games.
