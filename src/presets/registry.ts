import { zConfig, type Config, type ConfigInput } from "@/schemas/config";

export interface ExamplePreset {
	id: string;
	name: string;
	tags: string[];
	description: string;
	config: Config;
	thumbnail?: string; // Optional base64 image or path
}

function definePreset(
	preset: Omit<ExamplePreset, "config"> & { config: ConfigInput }
): ExamplePreset {
	return { ...preset, config: zConfig.parse(preset.config) };
}

// Current examples registry
export const examplePresets: Record<string, ExamplePreset> = {
	"tic-tac-toe": definePreset({
		id: "tic-tac-toe",
		name: "Tic-Tac-Toe",
		tags: ["classic", "3x3", "linear", "turn-based"],
		description:
			"The timeless 3x3 grid game. Get three in a row horizontally, vertically, or diagonally.",
		config: {
			metadata: { name: "Tic-Tac-Toe", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"simultaneous-ttt": definePreset({
		id: "simultaneous-ttt",
		name: "Simultaneous TTT",
		tags: ["simultaneous", "schedule", "3x3", "n-in-a-row", "mechanism"],
		description:
			"Both players choose a cell each round; joint resolve. Same-cell conflict places neither. Unlocks turn.schedule = simultaneous.",
		config: {
			metadata: { name: "Simultaneous TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"double-place-simultaneous-ttt": definePreset({
		id: "double-place-simultaneous-ttt",
		name: "Double-Place Simultaneous TTT",
		tags: [
			"simultaneous",
			"actionsPerTurn",
			"multi-action",
			"3x3",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each seat submits two cells per simultaneous round; indexed pairs resolve jointly. Unlocks actionsPerTurn > 1 under simultaneous.",
		config: {
			metadata: { name: "Double-Place Simultaneous TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2
			},
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"ordered-simultaneous-ttt": definePreset({
		id: "ordered-simultaneous-ttt",
		name: "Ordered Simultaneous TTT",
		tags: [
			"simultaneous",
			"resolveOrder",
			"ordered",
			"3x3",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Simultaneous places resolve X-first: on same-cell conflict X wins the cell (joint would place neither). Unlocks turn.resolveOrder.",
		config: {
			metadata: { name: "Ordered Simultaneous TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				resolveOrder: "x_first"
			},
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"hidden-simultaneous-ttt": definePreset({
		id: "hidden-simultaneous-ttt",
		name: "Hidden Simultaneous TTT",
		tags: [
			"simultaneous",
			"commitReveal",
			"hidden",
			"3x3",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each seat commits a cell privately; board reveals when both have committed. Same-cell conflict places neither. Unlocks turn.commitReveal.",
		config: {
			metadata: { name: "Hidden Simultaneous TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			},
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"simultaneous-hex-connect-lite": definePreset({
		id: "simultaneous-hex-connect-lite",
		name: "Simultaneous Hex Connect Lite",
		tags: [
			"simultaneous",
			"hex",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Joint-place rounds on odd-r hex: both seats place each round; wins use hex adjacency. Unlocks simultaneous + hex_offset composition (rectangle simultaneous alone cannot).",
		config: {
			metadata: { name: "Simultaneous Hex Connect Lite", version: 1 },
			grid: { width: 3, height: 3, topology: "hex_offset", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [
				{
					id: "shex-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "shex-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"double-place-simultaneous-hex": definePreset({
		id: "double-place-simultaneous-hex",
		name: "Double-Place Simultaneous Hex",
		tags: [
			"simultaneous",
			"actionsPerTurn",
			"multi-action",
			"hex",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each seat submits two cells per simultaneous round on odd-r hex; indexed pairs resolve jointly with hex adjacency wins. Unlocks actionsPerTurn > 1 under simultaneous on hex_offset.",
		config: {
			metadata: { name: "Double-Place Simultaneous Hex", version: 1 },
			grid: { width: 3, height: 3, topology: "hex_offset", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [
				{
					id: "dpshex-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "dpshex-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"simultaneous-graph-connect-lite": definePreset({
		id: "simultaneous-graph-connect-lite",
		name: "Simultaneous Graph Connect Lite",
		tags: [
			"simultaneous",
			"graph",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Joint-place rounds on an irregular graph: only active nodes are legal; wins follow composite edges. Unlocks simultaneous + graph composition.",
		config: {
			metadata: { name: "Simultaneous Graph Connect Lite", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 0, col: 2, x: 2, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0.25, y: 2 },
					{ row: 2, col: 2, x: 1.75, y: 2 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "0,2"],
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"],
					["2,0", "2,2"]
				]
			},
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			tokens: [
				{
					id: "sgraph-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "sgraph-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"double-place-simultaneous-graph": definePreset({
		id: "double-place-simultaneous-graph",
		name: "Double-Place Simultaneous Graph",
		tags: [
			"simultaneous",
			"actionsPerTurn",
			"multi-action",
			"graph",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each seat submits two nodes per simultaneous round on an irregular graph; indexed pairs resolve jointly along composite edges. Unlocks actionsPerTurn > 1 under simultaneous on graph.",
		config: {
			metadata: { name: "Double-Place Simultaneous Graph", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 0, col: 2, x: 2, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0.25, y: 2 },
					{ row: 2, col: 2, x: 1.75, y: 2 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "0,2"],
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"],
					["2,0", "2,2"]
				]
			},
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			tokens: [
				{
					id: "dpsgraph-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "dpsgraph-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"double-move-ttt": definePreset({
		id: "double-move-ttt",
		name: "Double Move TTT",
		tags: ["multi-step", "actionsPerTurn", "3x3", "n-in-a-row", "mechanism"],
		description:
			"Each player places two stones per turn before handoff. Win checked after each stone. Unlocks turn.actionsPerTurn multi-step budget.",
		config: {
			metadata: { name: "Double Move TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"double-move-hex": definePreset({
		id: "double-move-hex",
		name: "Double Move Hex",
		tags: [
			"multi-step",
			"actionsPerTurn",
			"hex",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each player places two stones per turn on odd-r hex before handoff; wins use hex adjacency. Unlocks actionsPerTurn > 1 under alternating on hex_offset.",
		config: {
			metadata: { name: "Double Move Hex", version: 1 },
			grid: { width: 3, height: 3, topology: "hex_offset", wrap: false },
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [
				{
					id: "dmhex-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "dmhex-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"double-move-graph": definePreset({
		id: "double-move-graph",
		name: "Double Move Graph",
		tags: [
			"multi-step",
			"actionsPerTurn",
			"graph",
			"topology",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Each player places two stones per turn on an irregular graph before handoff; wins follow composite edges. Unlocks actionsPerTurn > 1 under alternating on graph.",
		config: {
			metadata: { name: "Double Move Graph", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 0, col: 2, x: 2, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0.25, y: 2 },
					{ row: 2, col: 2, x: 1.75, y: 2 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "0,2"],
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"],
					["2,0", "2,2"]
				]
			},
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			tokens: [
				{
					id: "dmgraph-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "dmgraph-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"delayed-ttt": definePreset({
		id: "delayed-ttt",
		name: "Delayed TTT",
		tags: ["delayed", "queue", "delayTurns", "3x3", "n-in-a-row", "mechanism"],
		description:
			"Places queue as intents and land after one intervening place. Pending cells are reserved. Unlocks placement.delayTurns.",
		config: {
			metadata: { name: "Delayed TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject", delayTurns: 1 },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"toroidal-ttt": definePreset({
		id: "toroidal-ttt",
		name: "Toroidal TTT",
		tags: ["wrap", "topology", "3x3", "n-in-a-row", "mechanism"],
		description:
			"Tic-Tac-Toe on a torus — lines wrap across opposite edges. Unlocks grid.wrap for rectangle boards.",
		config: {
			metadata: { name: "Toroidal TTT", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: true },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"connect-4": definePreset({
		id: "connect-4",
		name: "Connect 4",
		tags: ["classic", "7x6", "gravity", "column-activation"],
		description: "Drop tokens into columns; first to connect four wins.",
		config: {
			metadata: { name: "Connect 4", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "column" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"connect-4-up": definePreset({
		id: "connect-4-up",
		name: "Connect 4 (Up)",
		tags: ["classic", "7x6", "gravity", "column-activation", "gravity-up"],
		description:
			"Gravity inverted: discs rise and stack toward the top; first to connect four wins.",
		config: {
			metadata: { name: "Connect 4 Up", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "column" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "up", wrap: false },
				overflow: "reject"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"connect-4-up-popout": definePreset({
		id: "connect-4-up-popout",
		name: "Connect 4 (Up Pop Out)",
		tags: ["classic", "7x6", "gravity", "gravity-up", "pop-out"],
		description:
			"Gravity up with top pop-out: eject your topmost token to shift the column toward the exit side.",
		config: {
			metadata: { name: "Connect 4 Up Pop Out", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "column" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "up", wrap: false },
				overflow: "pop_out_top"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"connect-4-right": definePreset({
		id: "connect-4-right",
		name: "Connect 4 (Right)",
		tags: ["classic", "7x6", "gravity", "row-activation", "gravity-right"],
		description:
			"Horizontal gravity: activate a row and discs slide right; first to connect four wins.",
		config: {
			metadata: { name: "Connect 4 Right", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "row" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "right", wrap: false },
				overflow: "reject"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"connect-4-right-popout": definePreset({
		id: "connect-4-right-popout",
		name: "Connect 4 (Right Pop Out)",
		tags: [
			"classic",
			"7x6",
			"gravity",
			"row-activation",
			"gravity-right",
			"pop-out"
		],
		description:
			"Horizontal gravity with right pop-out: eject your rightmost token to shift the row toward the exit side. Unlocks popOutRow.",
		config: {
			metadata: { name: "Connect 4 Right Pop Out", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "row" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "right", wrap: false },
				overflow: "pop_out_right"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	gomoku: definePreset({
		id: "gomoku",
		name: "Gomoku",
		tags: ["classic", "15x15", "n-in-a-row", "direct"],
		description: "Place stones on a 15x15 board; first to five in a row wins.",
		config: {
			metadata: { name: "Gomoku", version: 1 },
			grid: { width: 15, height: 15, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			tokens: [
				{
					id: "stone-black",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/stone-black.png" }
				},
				{
					id: "stone-white",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/stone-white.png" }
				}
			],
			placement: { mode: "direct", overflow: "reject" },
			win: {
				length: 5,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	reversi: definePreset({
		id: "reversi",
		name: "Capture / Flip Demo",
		tags: ["capture", "8x8", "demo"],
		description:
			"Sandwich-and-flip capture demo (Reversi-style). Uses n-in-a-row win — not full Othello endgame/scoring.",
		config: {
			metadata: { name: "Capture Flip Demo", version: 1 },
			grid: { width: 8, height: 8, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			tokens: [
				{
					id: "disk-black",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/stone-black.png" }
				},
				{
					id: "disk-white",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/stone-white.png" }
				}
			],
			placement: {
				mode: "direct",
				overflow: "reject",
				capture: { enabled: true }
			},
			win: {
				length: 5,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: [
				{ row: 3, col: 3, player: "O" },
				{ row: 3, col: 4, player: "X" },
				{ row: 4, col: 3, player: "X" },
				{ row: 4, col: 4, player: "O" }
			]
		}
	}),
	"connect-4-popout": definePreset({
		id: "connect-4-popout",
		name: "Connect 4 (Pop Out)",
		tags: ["classic", "7x6", "gravity", "pop-out"],
		description:
			"Connect Four with Pop Out: eject your bottom token to shift the column.",
		config: {
			metadata: { name: "Connect 4 Pop Out", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "column" },
			tokens: [
				{
					id: "disc-red",
					label: "R",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disc-red.png" }
				},
				{
					id: "disc-yellow",
					label: "Y",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disc-yellow.png" }
				}
			],
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "pop_out_bottom"
			},
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"battleship-lite": definePreset({
		id: "battleship-lite",
		name: "Battleship Lite",
		tags: ["observation", "hit-miss", "partial-info", "5x5"],
		description:
			"Minimal partial-info demo: fixed hidden fleets, fire for hit/miss, sink to win. Unlocks observation — not a full Battleship port.",
		config: {
			metadata: { name: "Battleship Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "hit_miss" },
			objective: { mode: "destroy_hidden" },
			tokens: [
				{ id: "fleet-x", label: "X", players: ["X"] },
				{ id: "fleet-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: [
				{ row: 0, col: 0, player: "X", visibility: "owner" },
				{ row: 0, col: 1, player: "X", visibility: "owner" },
				{ row: 4, col: 3, player: "O", visibility: "owner" },
				{ row: 4, col: 4, player: "O", visibility: "owner" }
			]
		}
	}),
	"battleship-place": definePreset({
		id: "battleship-place",
		name: "Battleship Place",
		tags: [
			"observation",
			"hit-miss",
			"placement-phase",
			"multi-ship",
			"5x5",
			"mechanism"
		],
		description:
			"Place contiguous ships (lengths 2+3) onto the hidden layer, then fire. Unlocks fleet placement phase — still not full Battleship.",
		config: {
			metadata: { name: "Battleship Place", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "hit_miss" },
			fleet: { ships: [2, 3] },
			objective: { mode: "destroy_hidden" },
			tokens: [
				{ id: "fleet-x", label: "X", players: ["X"] },
				{ id: "fleet-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: []
		}
	}),
	"fog-connect-lite": definePreset({
		id: "fog-connect-lite",
		name: "Fog Connect Lite",
		tags: ["observation", "fog", "radius", "partial-info", "5x5", "mechanism"],
		description:
			"n-in-a-row with fog-of-war: after your first stone, only cells within Chebyshev radius 1 of your pieces are visible. Unlocks fog radius observation.",
		config: {
			metadata: { name: "Fog Connect Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "fog", radius: 1, metric: "chebyshev" },
			objective: { mode: "n_in_a_row" },
			tokens: [
				{
					id: "X",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "O",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"place-move-lite": definePreset({
		id: "place-move-lite",
		name: "Place & Move Lite",
		tags: ["phases", "place", "move", "5x5", "n-in-a-row", "mechanism"],
		description:
			"Each turn: place one stone, then move one of yours one step. Unlocks turn.phases (in-turn action sequence) — not multi-step same-action budget.",
		config: {
			metadata: { name: "Place & Move Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "alternating",
				phases: ["place", "move"]
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			movement: { adjacency: "orthogonal", range: 1 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			tokens: [
				{
					id: "x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			placements: [],
			initial: []
		}
	}),
	"place-fire-lite": definePreset({
		id: "place-fire-lite",
		name: "Place & Fire Lite",
		tags: [
			"phases",
			"place",
			"fire",
			"hit-miss",
			"5x5",
			"destroy-hidden",
			"mechanism"
		],
		description:
			"Each turn: place one public spotter, then fire one shot. Fixed hidden fleets; sink to win. Unlocks turn.phases + fire — not fleet setup or place→move→fire.",
		config: {
			metadata: { name: "Place & Fire Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "alternating",
				phases: ["place", "fire"]
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "hit_miss" },
			objective: { mode: "destroy_hidden" },
			tokens: [
				{ id: "fleet-x", label: "X", players: ["X"] },
				{ id: "fleet-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: [
				{ row: 0, col: 0, player: "X", visibility: "owner" },
				{ row: 0, col: 1, player: "X", visibility: "owner" },
				{ row: 4, col: 3, player: "O", visibility: "owner" },
				{ row: 4, col: 4, player: "O", visibility: "owner" }
			]
		}
	}),
	"step-race": definePreset({
		id: "step-race",
		name: "Step Race",
		tags: ["move", "reach-row", "5x5", "mechanism"],
		description:
			"Orthogonal step race: move your token one cell at a time; first to the far row wins. Unlocks Move + reach_row — not a full chase game.",
		config: {
			metadata: { name: "Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "runner-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"life-lite": definePreset({
		id: "life-lite",
		name: "Life Lite",
		tags: ["scheduler", "tick", "life", "b3s23", "mechanism"],
		description:
			"Conway B3/S23 on a small grid with a manual tick action. Unlocks discrete scheduler — not a full Life port or realtime loop.",
		config: {
			metadata: { name: "Life Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "manual_tick" },
			scheduler: { rules: "life_b3s23", neighborhood: "moore" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "none" },
			tokens: [
				{
					id: "cell-alive",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				}
			],
			placements: [],
			// Horizontal blinker centered on 5×5
			initial: [
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "X", visibility: "public" }
			]
		}
	}),
	"hex-connect-lite": definePreset({
		id: "hex-connect-lite",
		name: "Hex Connect Lite",
		tags: ["hex", "topology", "n-in-a-row", "mechanism"],
		description:
			"N-in-a-row on an odd-r hex board (pointy-top offset). Unlocks hex_offset topology — not a full hex strategy game.",
		config: {
			metadata: { name: "Hex Connect Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [
				{
					id: "hex-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"toroidal-hex-connect-lite": definePreset({
		id: "toroidal-hex-connect-lite",
		name: "Toroidal Hex Connect Lite",
		tags: ["wrap", "hex", "topology", "n-in-a-row", "mechanism"],
		description:
			"Hex n-in-a-row on a torus — cube-axis lines wrap across opposite edges. Unlocks grid.wrap for hex_offset (graph wrap remains explicit edges).",
		config: {
			metadata: { name: "Toroidal Hex Connect Lite", version: 1 },
			grid: { width: 4, height: 3, topology: "hex_offset", wrap: true },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [
				{
					id: "thex-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "thex-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"graph-connect-lite": definePreset({
		id: "graph-connect-lite",
		name: "Graph Connect Lite",
		tags: ["graph", "topology", "n-in-a-row", "mechanism"],
		description:
			"N-in-a-row along an irregular adjacency graph (bridge + triangle). Unlocks graph topology — not expressible as a uniform rectangle/hex lattice.",
		config: {
			metadata: { name: "Graph Connect Lite", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				// Layout (y-down): top bar + hub + bottom triangle — missing lattice edges
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 0, col: 2, x: 2, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0.25, y: 2 },
					{ row: 2, col: 2, x: 1.75, y: 2 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "0,2"],
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"],
					["2,0", "2,2"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			tokens: [
				{
					id: "graph-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"go-lite": definePreset({
		id: "go-lite",
		name: "Go Lite",
		tags: ["liberties", "territory", "area-control", "ko", "mechanism"],
		description:
			"Orthogonal group capture by liberties + simple (point) ko + pass-to-score area control. Unlocks liberties/territory/ko — not full Go (simplified scoring). See Go Lite Superko / Situational Superko for history rules.",
		config: {
			metadata: { name: "Go Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control" },
			tokens: [
				{
					id: "stone-x",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "stone-o",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"go-lite-superko": definePreset({
		id: "go-lite-superko",
		name: "Go Lite Superko",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"superko",
			"mechanism"
		],
		description:
			"Go Lite with positional superko: any prior public-board position is illegal to recreate (regardless of side-to-move). Unlocks history-aware legality beyond point ko.",
		config: {
			metadata: { name: "Go Lite Superko", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: {
					enabled: true,
					mode: "liberties",
					ko: "positional"
				},
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control" },
			tokens: [
				{
					id: "stone-x",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "stone-o",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	}),
	"go-lite-situational-superko": definePreset({
		id: "go-lite-situational-superko",
		name: "Go Lite Situational Superko",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"superko",
			"situational",
			"mechanism"
		],
		description:
			"Go Lite with situational superko: forbids repeating a prior (board, side-to-move) pair. Same stones with a different player to move remain legal — unlike positional superko.",
		config: {
			metadata: { name: "Go Lite Situational Superko", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: {
					enabled: true,
					mode: "liberties",
					ko: "situational"
				},
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control" },
			tokens: [
				{
					id: "stone-x",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "stone-o",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: []
		}
	})
};

// Helper to get all presets as array
export const allPresets = Object.values(examplePresets);

// Helper to get preset by ID
export function getPreset(id: string): ExamplePreset | undefined {
	return examplePresets[id];
}

// Helper to search presets (fuzzy by name/tags/description)
export function searchPresets(query: string): ExamplePreset[] {
	if (!query) return allPresets;

	const lowerQuery = query.toLowerCase();
	return allPresets.filter(
		(preset) =>
			preset.name.toLowerCase().includes(lowerQuery) ||
			preset.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
			preset.description.toLowerCase().includes(lowerQuery)
	);
}
