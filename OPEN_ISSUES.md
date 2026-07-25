# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M6)

### debug-and-agents

Legal-move overlays, “why illegal,” event trace; random/greedy/(tiny) MCTS agents on kernel only.

**Acceptance:** See `PLANNING.md` M6 exit criteria. Prefer kernel-only agents;
surface why-illegal from existing legality probes where possible.

### library-explorer

Config sampling UI to explore playable vs unplayable space (M7; listed early so
it is not forgotten).

---

## Later (M3+)

### topology-beyond-rectangle

Hex foothold landed (`hex_offset`). Remaining: general graph boards while keeping
grid ergonomics.

### observation-partial-info

Hit/miss + Battleship-lite landed. Remaining: fog radius, placement-phase /
multi-ship Battleship if still desired.

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties).
Further ports only when a **new** missing mechanism appears — not a backlog.
