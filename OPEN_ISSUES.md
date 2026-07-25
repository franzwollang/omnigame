# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### next-missing-mechanism

Gravity **up** landed — Connect 4 (Up) + settle/entry invert + tests.
Pick the **next smallest** unlock the engine still lacks — not another
recombination of covered primitives (see project-structure selection principle).

Candidates only when they force a new seam, e.g.:

- gravity left/right (needs `input.mode = "row"` / `activateRow`)
- ko (or superko) for liberties games
- simultaneous / hidden simultaneous actions
- delayed actions / multi-step turns
- hex/graph wrap (follow-on to rectangle wrap)
- `pop_out_top` (exit-side symmetric to gravity up)

**Acceptance:**

- [ ] Name the mechanism and why existing primitives cannot express it
- [ ] Schema + Kernel path + preset (or library family) + transcript tests
- [ ] No forked per-game engine

---

## Later

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties,
graph). Fleet placement, library depth, rectangle wrap, and gravity-up also
landed. Further ports only when a **new** missing mechanism appears — not a
backlog.
