# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### next-missing-mechanism

M0–M7 and library-explorer-depth landed. Pick the **smallest** game/mechanism that
unlocks something the engine still lacks — not another recombination of covered
primitives (see project-structure selection principle).

Candidates only when they force a new seam, e.g.:

- `grid.wrap` / toroidal adjacency
- non-down gravity behind Kernel
- ko (or superko) for liberties games
- simultaneous / hidden simultaneous actions
- delayed actions / multi-step turns

**Acceptance:**

- [ ] Name the mechanism and why existing primitives cannot express it
- [ ] Schema + Kernel path + preset (or library family) + transcript tests
- [ ] No forked per-game engine

---

## Later

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties,
graph). Fleet placement + library depth also landed. Further ports only when a
**new** missing mechanism appears — not a backlog.
