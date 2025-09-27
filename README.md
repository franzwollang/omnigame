# OmniGame

Compose every grid game from data & pure functions.

OmniGame is a pure functional, data-driven engine for 2D grid-based games. Known games (Snake, Tic-Tac-Toe, Battleship, etc...) act as presets built from shared composable primitives. Most configurations are unplayable (akin to the [Library of Babel](https://libraryofbabel.info/) where most books and images are pure noise), which makes the playable ones interesting to discover.

Live demo: [omnigame.vercel.app](https://omnigame.vercel.app/)

## Motivation

OmniGame aims to show the power of functional and data-driven patterns in a highly visual, intuitive way. It lets people search for strange, hybrid interpolations of beloved classic games. The project also exposes the exponential asymptotics of the design space, demonstrating how strong code foundations let producers focus on design combinatorics with low development friction.

## Confirmed presets (constructive examples)

None yet. This section will list known games that have been reproduced via concrete configuration, with links to the JSON and notes on any constraints.

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

## Usage

The canvas supports panning with mouse/touch (clamped to board) and zooming with wheel/pinch. `window.jumpPanTo(x, y)` is available for quick developer testing.

The editor provides live JSON + Zod validation. Format via the “Format” button or ⌘/Ctrl+F. Colors/theme adapt to light/dark mode (although no toggle added yet), and editor scroll position is preserved on format.

The form fields mirror the JSON schema (`metadata`, `grid`, `turn`, `rng`) with updates syncing two-ways with the editor.

## Architecture notes (directional)

The core follows pure functional principles with reducers (`State -> Event -> State`), scheduler, and deterministic RNG. State transitions use XState statecharts to structure transitions and ensure compositions are algebraic (operations on entities always yield valid states).

The data-driven configuration uses declarative JSON as a control surface, with the dynamic form mirroring the nested schema. Adapters at the edges handle rendering (Three.js), input, and persistence.

Routing uses App Router with scroll-snap landing and URL replacement to reflect the active view. The planned “infinite library” mode will sample/randomize configs and reveal how rare playable settings are.

## Roadmap

Core development focuses on engine slices (reduce, scheduler, rng) with Effect primitives, presets for common games plus generalized operators, and a library explorer for randomizing/filtering presets with bookmark/sharing capabilities.

Future features include camera/perspective modes, collision/interaction operators, multi-entity composition, schema-driven UI generation (richer controls, constraints), and 3D functionality once the 2D path is stable. As grids increase in size, they approximate continuous space (within machine precision). The same approach may extend to 3D; a clear target is a simplified Minecraft-style sandbox as a demonstrator.
Future features include camera/perspective modes, collision/interaction operators, multi-entity composition, schema-driven UI generation (richer controls, constraints), continuous space, and 3D support (e.g. a simplified Minecraft-style sandbox).

## Contributing

Issues and PRs are welcome. If you’d like to add a preset or a new operator, open an issue to discuss schema/layout first so we can keep the model composable and type‑safe.
