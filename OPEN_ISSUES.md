# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (M1 residual → M2)

### server-validation-unwired

**Problem:** `app/actions/validate-config.ts` (Zod + contracts + Z3) is not imported by the
sandbox UI; client only runs `zConfig.safeParse`. Contract composition via
`validateConfig` is now covered client-side, but the server action / Z3 path is still
orphaned.

**Acceptance:**

- [ ] Decide: wire into sandbox (e.g. on Format / Validate) **or** document as optional CLI/dev tool and stop implying server validation in architecture notes
- [ ] If wired: user-visible errors for contract/Z3 failures

---

## Near-term (M2)

### game-ir-replay

Serializable IR / action log + deterministic replay from seed. Sandbox already accumulates
kernel `eventLog`; promote that into a stable GameIR transcript and `seed + actions → same state`.

**Acceptance:** See `PLANNING.md` M2 exit criteria.

---

## Later (M3+)

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
