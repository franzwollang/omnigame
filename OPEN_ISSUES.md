# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### next-missing-mechanism

**place→move→fire + connect_or_destroy** landed — `turn.phases:
["place","move","fire"]` with dual end routing (n-in-a-row after place/move,
sink fleet after fire); Place, Move & Fire Lite preset + tests. Pick the
**next smallest** unlock the engine still lacks — not another recombination of
covered primitives (see project-structure selection principle).

Candidates only when they force a new seam, e.g.:

- longer-range / sliding / capture piece tables
- richer multi-phase game machines beyond fleet + in-turn phases
- phases hex/graph lift (only if a new seam appears; kernel already topology-aware)

**Acceptance:**

- [ ] Name the mechanism and why existing primitives cannot express it
- [ ] Schema + Kernel path + preset (or library family) + transcript tests
- [ ] No forked per-game engine

### tooling-node-pnpm

**Problem (diagnosed):** After the CVE Next bump, `pnpm-lock.yaml` was rewritten with
**pnpm 9** (`lockfileVersion: 6.0`) while `packageManager` pins **pnpm@10.5.2**
(`lockfileVersion: 9.0`). That caused “lockfile not compatible” warnings and flaky
installs. Separately, Vitest 4 / Vite 8 need Node APIs (`util.styleText`) that
Node 18 lacks — `engines.node` was still `>=18.18.0`.

**Fix / acceptance:**

- [x] Regenerate lockfile with `pnpm@10.5.2` (`lockfileVersion: 9.0`)
- [x] Raise `engines.node` to `>=20.19.0`; align `@types/node` / `eslint-config-next`
- [x] Local/default installs use pnpm 10.5.2 (Volta); avoid rewriting lockfile with pnpm 9
- [ ] Confirm CI (if any) uses Node ≥20.19 and pnpm 10.5.2 — no `.github` workflows yet

When CI exists, pin Node/pnpm there; until then this issue can stay as a reminder
or be closed after the next agent green run on cloud.

## Later

### reference-game-ports

M5 planned mechanism anchors landed (observation, Move, tick, hex, liberties,
graph). Fleet placement, library depth, rectangle wrap, gravity-up, gravity-row,
simple ko, positional/situational superko, `pop_out_top`, horizontal pop-out,
hex wrap, simultaneous schedule (rectangle + hex + graph), multi-step
`actionsPerTurn` (rectangle + hex + graph), delayed `delayTurns` (direct cell +
delayed gravity), hidden simultaneous `commitReveal`, ordered simultaneous
`resolveOrder`, multi-action simultaneous (rectangle + hex + graph), in-turn
`turn.phases` place→move / place→fire / place→move→fire (`connect_or_destroy`),
simultaneous move (joint move resolve), diagonal/king movement adjacency, and
topology-aware movement (hex/graph move + simultaneous) also landed. Further
ports only when a **new** missing mechanism appears — not a backlog.
