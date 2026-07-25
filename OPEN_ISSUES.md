# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### hit-miss-aware-agents

UCT landed for full-info games. Hit/miss configs still fall back to uniform
random inside MCTS/UCT. Optional: a baseline that uses `kernel.observe` (hunt
mode after hits, parity shooting, etc.).

**Acceptance:**

- [ ] Agent uses observations (not full hidden fleet) to choose `fire` actions
- [ ] Kernel-only (`legalActions` + `stepSync` + `observe`)
- [ ] Smoke test on Battleship-lite

### observation-placement-phase

Fog radius landed (`observation.mode = fog` + Fog Connect Lite). Remaining
Battleship depth: placement-phase / multi-ship authoring if still desired.

**Acceptance:**

- [ ] Schema + kernel path for a placement phase (or multi-ship) model
- [ ] Preset or transcript proving the seam
- [ ] Sandbox can author / play the phase without a forked engine

---

## Later

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties,
graph). Further ports only when a **new** missing mechanism appears — not a backlog.

### library-explorer-depth

M7 foothold landed (sample + classify + load). Optional later: larger search
UI, playability scoring beyond random playout, saved finds / share links;
optionally sample `graph` topology configs.
