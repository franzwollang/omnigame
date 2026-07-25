# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M3+)

### compiler-normalize

**Problem:** Specs still go Zod → flat `toGameConfig` → kernel with no normalize /
macro-expansion stage. README targets `validate → normalize → kernel builder`.

**Pointers:** `src/engine/validateConfig.ts`, `src/engine/toGameConfig.ts`,
`src/schemas/config.ts`, `PLANNING.md` M3

**Acceptance:**

- [ ] A `src/compiler/` (or equivalent) stage validates + normalizes a `Config` into
      kernel-ready input without sandbox-specific adapters owning that logic
- [ ] At least one “macro” or sugar field expands into named primitives (or documented
      non-goal if deferred)
- [ ] Presets still play through the normalized path

---

## Near-term (M4–M5)

### observation-partial-info

First-class observation models (fog, hit/miss) enabling Battleship-lite.

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
