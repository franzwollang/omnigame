# Open Issues

Current open work only. History: `OPEN_ISSUES_LOG.jsonl`. Roadmap: `PLANNING.md`.

---

## Immediate (post-M7)

### next-missing-mechanism

`pop_out_top` landed — exit-side symmetric to gravity up + Connect 4 Up Pop
Out preset + tests. Point/positional ko and rectangle wrap unchanged.
Pick the **next smallest** unlock the engine still lacks — not another
recombination of covered primitives (see project-structure selection principle).

Candidates only when they force a new seam, e.g.:

- situational superko (history includes side-to-move)
- simultaneous / hidden simultaneous actions
- delayed actions / multi-step turns
- hex/graph wrap (follow-on to rectangle wrap)
- horizontal pop-out (`pop_out_left` / `pop_out_right`)

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
simple ko, positional superko, and `pop_out_top` also landed. Further ports only
when a **new** missing mechanism appears — not a backlog.
