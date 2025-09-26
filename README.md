# OmniGame

A purely functional, purely data-driven engine for composing 2D grid-based games from reusable pieces. Configure checkboxes, dropdowns, and numbers to morph the same engine into Snake, Tic-Tac-Toe, Battleship, and countless in‑between variants.

## Why

- **Make functional programming tangible**: Show how pure functions, immutable state, and composability unlock clarity and power.
- **Demonstrate data-driven design**: Swap behavior by editing data, not code. Every feature is a composition of primitives.
- **One engine, many games**: Known games are just preset configurations. Everything in between is playable by interpolating those knobs.

## What this is

OmniGame is a small engine that provides a concrete implementation for this vision. It consists of:

- A core engine that runs a 2D grid world with deterministic state transitions.
- A system for encoding game mechanics as pure, composable, data-driven rules.
- A decoupled rendering system that works via adapters (e.g., for Canvas or SVG).
- A two-part user interface:
  - An extensive control panel for live-editing the game's configuration.
  - An interactive canvas for playing the resulting game.
- A collection of presets for well-known games to demonstrate the engine's capabilities and provide starting points for exploration.

## Core principles

- **Purity first**: Game logic consists of pure functions `State -> Event -> State` with explicit inputs/outputs.
- **Immutability**: State changes produce new values; no hidden mutation or shared mutable state.
- **Composability**: Small primitives compose into rules, rules compose into mechanics, mechanics compose into games.
- **Data over code**: Prefer declarative configuration that selects built-in operators over ad-hoc imperative code.
- **Determinism**: All randomness is seeded and explicit; same inputs yield the same outputs.
- **Separation of concerns**: Logic, rendering, input, and configuration are cleanly decoupled via adapters.
- **Observability**: Every transition is traceable, and time-travel/debug views are first-class.

## High-level architecture

- **Configuration**: Declarative description of grid topology, entities, components, actions, rules, win/lose conditions, and UI controls.
- **Engine core** (pure):
  - `reduce(state, event) -> state` applying a set of rules.
  - `rules` built from small operators (movement, spawn, collision, counters, line detection, etc.).
  - `scheduler` for turn-based or real-time ticks.
  - `rng` module with explicit seeds.
- Strong TypeScript typing across all primitives. Use functional data types (e.g., Option/Either/ReadonlyArray) from the Effect ecosystem while keeping core logic pure.
- **Adapters** (impure boundaries):
  - `renderer` reads state snapshot and draws (Canvas/SVG/DOM) without side effects back into logic.
  - `input` maps UI and keyboard/mouse/touch to high-level `Event`s.
  - `persistence` for saving/loading configs and seeds.
  - Effect runtime at the edges to sequence side-effects, handle concurrency/scheduling, and interop with the pure core.
- **UI panel**: Renders knobs (checkboxes, selects, sliders) that map to configuration paths; changing a control re-initializes the engine with the new config.
- **Control surface (dynamic form)**: Schema-driven, mirrors the nested JSON config (objects, arrays, tagged unions). Supports conditional fields, list/map editors, validation, and live re-init on change.
- **Interactive canvas**: The live play surface where interactions occur; user input is forwarded as pure `Event`s and frames reflect pure state.

## Configuration schema (sketch)

The schema is intentionally declarative and composed from a small vocabulary of primitives. Think JSON/YAML; examples are shown as JSON for brevity.

```json
{
	"metadata": { "name": "My Game", "version": 1 },
	"grid": {
		"width": 10,
		"height": 10,
		"topology": "rectangle",
		"wrap": false
	},
	"turn": { "mode": "turn" },
	"rng": { "seed": 42 },
	"render": { "tileSize": 32, "theme": "default" },

	"entities": [
		{
			"id": "playerX",
			"components": [{ "type": "mark", "value": "X" }]
		}
	],

	"actions": {
		"placeMark": {
			"parameters": ["cell"],
			"guards": ["cellIsEmpty"],
			"effects": [
				{ "op": "setCell", "args": { "cell": "$cell", "value": "X" } },
				{ "op": "advanceTurn" }
			]
		}
	},

	"rules": [
		{ "on": "user.placeMark", "do": ["placeMark"] },
		{ "on": "tick", "do": [] }
	],

	"winConditions": [
		{ "type": "nInARow", "args": { "n": 3, "symbols": ["X", "O"] } }
	],
	"loseConditions": [],

	"controls": [
		{
			"label": "Grid Width",
			"type": "slider",
			"path": "grid.width",
			"min": 3,
			"max": 50
		},
		{ "label": "Wrap Edges", "type": "checkbox", "path": "grid.wrap" },
		{
			"label": "Mode",
			"type": "select",
			"path": "turn.mode",
			"options": ["turn", "realtime"]
		}
	],

	"presets": ["tic-tac-toe", "snake", "battleship"]
}
```

Notes:

- `op` refers to built-in pure operators with well-defined semantics (e.g., `move`, `spawn`, `setCell`, `grow`, `destroy`, `score.add`, `line.detect`).
- `rules` bind triggers (`on`) to lists of operators. Triggers include `tick`, `user.*`, `collision`, `spawned`, `turnStarted`, etc.
- `controls.path` points into the configuration tree; changing a control reboots the engine with the new config.

## Example presets (minimal sketches)

### Tic‑Tac‑Toe

```json
{
	"metadata": { "name": "Tic‑Tac‑Toe" },
	"grid": { "width": 3, "height": 3, "wrap": false },
	"turn": { "mode": "turn", "players": ["X", "O"] },
	"actions": {
		"place": {
			"parameters": ["cell"],
			"guards": ["cellIsEmpty"],
			"effects": [
				{
					"op": "setCell",
					"args": { "cell": "$cell", "value": "$currentPlayer" }
				},
				{ "op": "advanceTurn" }
			]
		}
	},
	"rules": [{ "on": "user.place", "do": ["place"] }],
	"winConditions": [{ "type": "nInARow", "args": { "n": 3 } }]
}
```

### Snake

```json
{
  "metadata": { "name": "Snake" },
  "grid": { "width": 20, "height": 20, "wrap": true },
  "turn": { "mode": "realtime", "tickRate": 8 },
  "entities": [
    { "id": "snake", "components": [ { "type": "body", "segments": 3 }, { "type": "direction", "value": "right" } ] },
    { "id": "foodSpawner", "components": [ { "type": "spawner", "of": "food", "rate": 0.1 } ] }
  ],
  "actions": {
    "step": {
      "effects": [
        { "op": "move", "args": { "entity": "snake", "direction": "$snake.direction" } },
        { "op": "onCollision", "args": { "with": "food", "do": [ { "op": "grow", "args": { "entity": "snake" } }, { "op": "destroy", "args": { "entity": "$collider" } ] } } },
        { "op": "failIf", "args": { "predicate": "hitSelfOrWall" } }
      ]
    }
  },
  "rules": [ { "on": "tick", "do": ["step"] }, { "on": "user.turn", "do": [ { "op": "set", "args": { "path": "entities.snake.direction", "value": "$event.direction" } } ] } ]
}
```

### Battleship (abstracted)

```json
{
	"metadata": { "name": "Battleship" },
	"grid": { "width": 10, "height": 10 },
	"turn": { "mode": "turn", "players": ["A", "B"] },
	"entities": [
		{ "id": "fleetA", "components": [{ "type": "fleet", "owner": "A" }] },
		{ "id": "fleetB", "components": [{ "type": "fleet", "owner": "B" }] }
	],
	"actions": {
		"fire": {
			"parameters": ["cell"],
			"effects": [
				{ "op": "mark", "args": { "cell": "$cell", "value": "hitOrMiss" } },
				{ "op": "advanceTurn" }
			]
		}
	},
	"rules": [{ "on": "user.fire", "do": ["fire"] }],
	"winConditions": [{ "type": "allSunk" }]
}
```

These sketches are illustrative; the actual operator set will be small, orthogonal, and composable.

## Getting started

This repository is currently in ideation/prototyping. The initial milestones will include:

1. Define the minimal operator vocabulary and rule DSL.
2. Implement the pure engine core (`reduce`, `scheduler`, `rng`).
3. Build a basic Canvas renderer adapter.
4. Create the configuration-driven UI panel.
5. Ship first presets (Tic‑Tac‑Toe, Snake) and a sandbox.

Dev notes (tentative):

- Language: TypeScript, browser-first.
- Zero side effects in the core. Adapters isolate IO.
- Strong emphasis on determinism, testing, and reproducibility.

## Scope and future directions

- **3D as an extension**: The core favors 2D grids initially. A future adapter/topology could generalize to 3D lattices (and beyond) while preserving the same pure operators and rule model.
- **Generalization grows with presets**: As more presets are implemented, recurring patterns will push operators and schema to become more general and orthogonal.
- **Approximating continuity**: Sufficiently large grids recover a quantized approximation of continuous space (as is true under finite machine precision anyway). Higher tick rates and finer grids enable more “continuous” dynamics.
- **Pragmatic scope**: How far-reaching OmniGame becomes depends on time and interest. In principle, the approach could express all known games; in practice we’ll start with simple 2D games and expand outward.

## Exploration: Infinite library of configurations

Inspired by the "Library of Babel" idea, OmniGame will prioritize an exploration mode that samples the vast configuration space:

- **Infinite library**: Randomly generate configurations across the control surface/JSON schema to surface surprising, chaotic, and occasionally brilliant behaviors.
- **Rarity of known games**: As in the Library of Babel, well-formed artifacts (here: playable, recognizable games like Snake/Tic-Tac-Toe) are exponentially rare amidst unstructured noise. This feature highlights the expressiveness of the engine and the sparsity of elegant design points.
- **Guided search**: Seeded RNG, filters (e.g., minimal action set, bounded rule depth), and user ratings help converge on islands of playability.
- **One-click promote**: Any discovered configuration can be saved as a named preset and shared.

## Contributing

- Open a discussion/issue to propose primitives, operators, or schema changes.
- Prefer data-first designs. If a feature can be expressed as data selecting existing operators, do that.
- Keep logic pure; avoid hidden state. Every operator should be referentially transparent.
- Add tests alongside new operators/rules; ensure determinism via seeded RNG.
- Small PRs welcome. Clear commit messages. Document new config fields in the README.

## FAQ

- **Is this a full game engine?**
  Not in the heavyweight sense. It is a small, pedagogical engine focused on purity and data-driven composition.

- **Why pure functional?**
  Predictability, testability, and composability. It also makes the UI panel truly powerful: changing data reconfigures behavior without patching code.

- **Can I add my own operators?**
  Yes. Operators are pluggable. The goal is a tiny, orthogonal core set; extensions live as separate modules.

- **Will it support arbitrary topologies?**
  Start with rectangular grids, then consider toroidal wrapping, hex grids, and layered boards.

- **How are known games represented?**
  As presets that pin specific config values. The same engine runs them; no bespoke logic per game.

- **Will this support 3D?**
  Potentially, yes. The architecture is intended to be topology-agnostic; adding a 3D grid topology and compatible operators would enable 3D variants.

- **Does a large grid approximate continuous space?**
  Yes. Increasing resolution and tick rate yields a quantized approximation to continuous dynamics, consistent with finite machine precision.

## License

TBD
