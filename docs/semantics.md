# OmniGame Formal Semantics (Draft)

This document sketches a minimal formal model to reason about feature composition, conflicts, and invariants in OmniGame. It is intentionally compact and will evolve with new mechanics.

## 1. Core Syntax

- Players: P = {X, O}
- Grid: G = (W, H, cells) with cells ∈ (P ∪ {∅})^{W×H}
- Status: S ∈ {playing, won(p), draw}
- State: σ = (G, p∈P, S, m∈ℕ)  // grid, current player, game status, move count
- Events: ε ∈ { place(r,c), activateColumn(c), reset }

## 2. Small-step Transition Relation

We define a labeled transition σ —ε→ σ'. Transitions are partial; guards constrain applicability.

Conceptual phases:
- validateInput(σ, ε) ⇒ ok | err
- applyPlacement(σ, ε) ⇒ σ1
- applyEffects(σ1) ⇒ σ2  // e.g., capture, overflow
- checkEnd(σ2) ⇒ σ3      // win/draw
- nextTurn(σ3) ⇒ σ'

Reducer semantics factors these phases sequentially when guards hold; otherwise state is unchanged.

## 3. Features as Machine Slices

A feature F is a tuple (Req, Prov, Slot, Pre, Post, Inv, Hooks):
- Req: required capabilities (e.g., ResolvedCell, Adjacency)
- Prov: provided capabilities (e.g., ResolvedCell)
- Slot: claimed exclusive roles (e.g., PlacementPolicy=gravity)
- Pre: precondition predicate over (σ, ε)
- Post: postcondition relation between (σ, ε) and σ'
- Inv: invariant predicate preserved across its steps
- Hooks: subset of phases it participates in with deterministic pure functions

Examples (informal):
- PlacementPolicy=gravity
  - Req: TargetLine, CellsWritable; Prov: ResolvedCell
  - Slot: {PlacementPolicy=gravity}; Hooks: applyPlacement
  - Pre: exists empty cell along scan; Post: writes exactly one cell
- Capture (Reversi)
  - Req: ResolvedCell, Adjacency, CellsWritable; Hooks: applyEffects
  - Pre: ≥1 flippable path; Post: flips captured opponent stones only
- WinCheck (n-in-a-row)
  - Req: Adjacency; Slot: {EndCondition}; Hooks: checkEnd

## 4. Composition

Composition F ⊕ G is valid iff:
- Req_F ⊆ Prov_G ∪ Base and Req_G ⊆ Prov_F ∪ Base
- Slot claims are disjoint (or an explicit composition order is given)
- Pre_F ∧ Pre_G is satisfiable (under machine guards)
- Inv_F and Inv_G are preserved by both features' Hooks

If any condition fails, composition is invalid.

## 5. Conflict Definition

A set of features 𝔽 conflicts iff one holds:
- Capability unsatisfied: ∃F∈𝔽. Req_F ⊄ (⋃Prov_𝔽 ∪ Base)
- Slot contention: ∃F≠G. Slot_F ∩ Slot_G ≠ ∅ without ordering
- Unsat pre/post: Pre_𝔽 ∧ machine guards is UNSAT (SMT)
- Invariant violation: ∃F. ¬Inv_F(σ') for some σ —ε→ σ'
- Protocol violation: a required phase Hook is missing

## 6. Base Invariants

- I1: grid bounds preserved
- I2: cells ∈ P ∪ {∅}
- I3: ≤ 1 cell changes during placement (before effects)
- I4: moveCount increments iff a valid move is applied
- I5: status ∈ {playing, won(p), draw} and is terminal if won/draw

## 7. Shared Primitives

- Adjacency decomposition: enabled directions + linear/composite traversal
- Placement policies: direct vs gravity (line-scan → resolved cell)
- Effects: capture (flips), overflow policies
- End conditions: n-in-a-row, draw

These are consumed by phase Hooks to ensure consistent semantics.

## 8. Validation Strategy

- Static typing/refinements (TypeScript): shapes and slot exclusivity
- Schema refinements (Zod): reject invalid config combos early
- Machine guards (XState): temporal/protocol enforcement
- Bounded model checking (optional): SMT/TLA+ instances for specific 𝔽
- Property-based tests: random valid configs + invariants

## 9. Roadmap

- Define formal Hook signatures (pre/post) for each phase
- Encode feature contracts in code (`src/engine/contracts.ts`)
- Build a typed machine factory from selected features
- Add SMT export for config+features to check UNSAT/liveness on demand

> This draft is intentionally pragmatic: it supports strong guarantees via types and checks, while leaving a clear path to stronger formal methods if required.
