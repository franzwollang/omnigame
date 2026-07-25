# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### topology-beyond-rectangle

Hex foothold landed (`hex_offset`). Remaining: **general graph boards** while
keeping grid ergonomics (arbitrary adjacency / irregular maps).

**Acceptance:**

- [ ] Schema + topology helpers for a graph (or adjacency-list) board mode
- [ ] At least one small preset that is not expressible as rectangle/hex_offset
- [ ] Kernel legalActions / win/capture paths honor graph neighbors
- [ ] Transcript or simulation tests for the graph mechanism

---

## Later

### observation-partial-info

Hit/miss + Battleship-lite landed. Remaining: fog radius, placement-phase /
multi-ship Battleship if still desired.

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties).
Further ports only when a **new** missing mechanism appears — not a backlog.

### richer-mcts-agents

M6 landed random / greedy / tiny flat MCTS. Optional later: UCT tree search,
partial-info agents for hit/miss games.

### library-explorer-depth

M7 foothold landed (sample + classify + load). Optional later: larger search
UI, playability scoring beyond random playout, saved finds / share links.
