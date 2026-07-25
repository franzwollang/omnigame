# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M4+)

### observation-partial-info

**Problem:** No first-class observation / fog / hit-miss model. Battleship-lite and
other partial-info games cannot be expressed as config.

**Pointers:** `PLANNING.md` M4, `README.md` observation primitive, `docs/semantics.md`

**Acceptance:**

- [ ] Observation primitive (at least hit/miss + hidden placement) in schema + kernel path
- [ ] Battleship-lite (or smaller) preset that unlocks the mechanism
- [ ] Transcript / simulation tests for the observation behavior

---

## Near-term (M5+)

### topology-beyond-rectangle

Hex and/or general graph boards while keeping grid ergonomics.

### reference-game-ports

Select anchors by **missing mechanism**, not by exhausting `references/` (see
project-structure rule). Candidates only earn a slot when they unlock something
new (e.g. observation, tick, Move, liberties, hex). Ship as presets + tests—not
forked engines.

### debug-and-agents

Legal-move overlays, “why illegal,” event trace; random/greedy/(tiny) MCTS agents on kernel only.

### library-explorer

Config sampling UI to explore playable vs unplayable space.
