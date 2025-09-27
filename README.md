# OmniGame

Compose every grid game from data & pure functions.

OmniGame is a pure functional, data-driven engine aimed at 2D grid-based games. Known games (Snake, Tic‑Tac‑Toe, Battleship, …) become presets over a shared set of composable primitives; most configurations are unplayable—akin to a Library of Babel—making the few playable ones interesting to explore. As grids grow, they approximate continuous space, and the approach can extend to 3D in the future.

- Live demo: [omnigame.vercel.app](https://omnigame.vercel.app/)

## Current status

- App shell with Next.js App Router, Tailwind, and shadcn/ui
- Split sandbox view:
  - Interactive canvas (Three.js) with board-like grid and clamped pan/zoom
  - JSON editor (react-simple-code-editor + Prism) with JSON + Zod validation, formatter, and scroll preservation
  - Form mode (react-hook-form + shadcn/ui) mirroring the JSON schema; two‑way sync JSON ⇄ form
- Smooth scroll-snap landing → sandbox with URL replacement ("/" ⇄ "/sandbox")
- Loading states (lazy editor/canvas) with centered spinners

## Tech stack

- Framework: Next.js 14 (App Router), React 18, TypeScript
- Styling: Tailwind CSS, shadcn/ui
- Validation/typing: Zod (runtime), TypeScript (static)
- State/Forms: react-hook-form, fast-deep-equal (for JSON→form sync)
- State machines: XState (to structure transitions and model compositions)
- Rendering: Three.js (board/camera), ResizeObserver
- Editor: react-simple-code-editor + Prism.js
- Package manager: pnpm
- FP runtime (planned): Effect (Effect.ts) for FP primitives in core and runtime at edges

## Getting started

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000 and click “Open the sandbox,” or go directly to /sandbox.

### Available scripts

- `pnpm dev` — start the Next.js development server
- `pnpm build` — create a production build
- `pnpm start` — run the production server locally
- `pnpm lint` — run ESLint
- `pnpm typecheck` — TypeScript in noEmit mode
- `pnpm components:add` — sync shadcn/ui registry components

## Project structure

```
app/                 # App Router routes (landing, sandbox)
  sandbox/           # Canvas, JSON editor, form (split components)
src/components/      # shadcn/ui components + shared UI primitives
src/lib/             # Utilities (e.g., className helper)
next.config.js       # Next.js configuration
```

## Usage

- Canvas
  - Pan with mouse/touch (clamped to board). Zoom with wheel/pinch.
  - `window.jumpPanTo(x, y)` is available for quick developer testing.
- Editor
  - Live JSON + Zod validation. Format via the “Format” button or ⌘/Ctrl+F.
  - Colors/theme adapt to light/dark; editor scroll position is preserved on format.
- Form (WIP)
  - Fields mirror the JSON schema (`metadata`, `grid`, `turn`, `rng`); updates sync two‑ways with the editor.

## Architecture notes (directional)

- Pure core: reducers (`State -> Event -> State`), scheduler, deterministic RNG
- State transitions: XState statecharts to structure transitions and ensure compositions are algebraic (operations on entities always yield valid states)
- Data-driven configuration: declarative JSON forms a control surface; dynamic form mirrors nested schema
- Adapters at the edges: rendering (Three.js), input, persistence
- Routing: App Router with scroll-snap landing and URL replacement to reflect the active view
- Exploration: “infinite library” mode to sample/randomize configs and reveal how rare playable settings are
- 3D: planned extension as an optional adapter layer once 2D is solid

## Roadmap

- Core engine slices (reduce, scheduler, rng) with Effect primitives
- Presets for common games + generalized operators
- Library explorer (randomize/filter presets; bookmark/sharing)
- Camera/perspective modes, collision/interaction operators, multi-entity composition
- Schema‑driven UI generation (richer controls, constraints)
- 3D adapter (Three.js) once the 2D path is stable

## Contributing

Issues and PRs are welcome. If you’d like to add a preset or a new operator, open an issue to discuss schema/layout first so we can keep the model composable and type‑safe.
