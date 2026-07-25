# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### richer-mcts-agents

M6 landed random / greedy / tiny flat MCTS. Optional depth: UCT tree search
and/or partial-info agents for hit/miss games.

**Acceptance:**

- [ ] At least one stronger agent than flat MCTS (e.g. UCT with tree reuse) **or**
      a hit/miss-aware baseline that uses observations
- [ ] Agents remain kernel-only (`legalActions` + `stepSync`)
- [ ] Tests cover a short scripted match or playout smoke

### observation-fog-radius

Hit/miss + Battleship-lite landed. Remaining observation depth: fog radius and/or
placement-phase / multi-ship Battleship if still desired.

**Acceptance:**

- [ ] Schema + kernel observation path for a fog/radius (or placement-phase) model
- [ ] Preset or transcript proving the new observation seam
- [ ] Sandbox or agent path can consume the richer observation

---

## Later

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties,
graph). Further ports only when a **new** missing mechanism appears — not a backlog.

### library-explorer-depth

M7 foothold landed (sample + classify + load). Optional later: larger search
UI, playability scoring beyond random playout, saved finds / share links;
optionally sample `graph` topology configs.
