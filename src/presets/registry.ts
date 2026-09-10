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
	"delayed-connect-4": definePreset({
		id: "delayed-connect-4",
		name: "Delayed Connect 4",
		tags: [
			"delayed",
			"gravity",
			"delayTurns",
			"7x6",
			"n-in-a-row",
			"mechanism"
		],
		description:
			"Column drops queue as gravity intents and settle after one intervening place. Landing cell is computed at resolve time. Unlocks delayed gravity resolution.",
		config: {
			metadata: { name: "Delayed Connect 4", version: 1 },
			grid: { width: 7, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
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
				overflow: "reject",
				delayTurns: 1
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
	"minesweeper-lite": definePreset({
		id: "minesweeper-lite",
		name: "Minesweeper Lite",
		tags: [
			"observation",
			"flood-reveal",
			"hazards",
			"partial-info",
			"8x8",
			"mechanism"
		],
		description:
			"Shared-board flood-fill reveal: click opens zero-count regions and numbered frontiers. Mine loses; clear all safe cells draws. Unlocks flood_reveal — not full Minesweeper (no flags/chords).",
		config: {
			metadata: { name: "Minesweeper Lite", version: 1 },
			grid: { width: 8, height: 8, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 10, firstRevealSafe: true },
			objective: { mode: "clear_hazards" },
			tokens: [
				{ id: "probe-x", label: "X", players: ["X"] },
				{ id: "probe-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: []
		}
	}),
	"hex-minesweeper-lite": definePreset({
		id: "hex-minesweeper-lite",
		name: "Hex Minesweeper Lite",
		tags: [
			"observation",
			"flood-reveal",
			"hazards",
			"hex",
			"partial-info",
			"6x6",
			"mechanism"
		],
		description:
			"Flood-fill reveal on hex_offset: cube-axis-6 adjacency for hazard counts and zero-region expansion (not Chebyshev-8). Mine loses; clear all safe cells draws. Unlocks hex flood_reveal — no flags/chords.",
		config: {
			metadata: { name: "Hex Minesweeper Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 8, firstRevealSafe: true },
			objective: { mode: "clear_hazards" },
			tokens: [
				{ id: "probe-x", label: "X", players: ["X"] },
				{ id: "probe-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: []
		}
	}),
	"graph-minesweeper-lite": definePreset({
		id: "graph-minesweeper-lite",
		name: "Graph Minesweeper Lite",
		tags: [
			"observation",
			"flood-reveal",
			"hazards",
			"graph",
			"partial-info",
			"mechanism"
		],
		description:
			"Flood-fill reveal on an explicit-edge graph: hazard counts and zero-region expansion follow undirected edges (not Chebyshev-8). Mine loses; clear all safe nodes draws. Unlocks graph flood_reveal (max degree ≤ 8) — no flags/chords.",
		config: {
			metadata: { name: "Graph Minesweeper Lite", version: 1 },
			grid: {
				width: 4,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 0, col: 2, x: 2, y: 0 },
					{ row: 0, col: 3, x: 3, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 1, col: 3, x: 3, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 2, col: 2, x: 2, y: 2 },
					{ row: 2, col: 3, x: 3, y: 2 },
					{ row: 1, col: 0, x: 0, y: 1 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "0,2"],
					["0,2", "0,3"],
					["0,0", "1,0"],
					["0,1", "1,1"],
					["0,3", "1,3"],
					["1,0", "1,1"],
					["1,1", "2,1"],
					["1,3", "2,3"],
					["2,1", "2,2"],
					["2,2", "2,3"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 3, firstRevealSafe: true },
			objective: { mode: "clear_hazards" },
			tokens: [
				{ id: "probe-x", label: "X", players: ["X"] },
				{ id: "probe-o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: []
		}
	}),
	"memory-flip-lite": definePreset({
		id: "memory-flip-lite",
		name: "Memory Flip Lite",
		tags: [
			"observation",
			"memory-flip",
			"match-pairs",
			"partial-info",
			"4x4",
			"mechanism"
		],
		description:
			"Classic pair-matching: flip two tiles per turn; match stays and scores; mismatch re-hides. Unlocks memory_flip — not full Memory (no bonus turn / custom decks).",
		config: {
			metadata: { name: "Memory Flip Lite", version: 1 },
			grid: { width: 4, height: 4, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			rng: { seed: 42 },
			input: { mode: "flip" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "memory_flip" },
			memory: { pairCount: 8, bonusTurnOnMatch: false },
			objective: { mode: "match_pairs" },
			tokens: [
				{ id: "pair-0", label: "A", players: ["X", "O"] },
				{ id: "pair-1", label: "B", players: ["X", "O"] },
				{ id: "pair-2", label: "C", players: ["X", "O"] },
				{ id: "pair-3", label: "D", players: ["X", "O"] },
				{ id: "pair-4", label: "E", players: ["X", "O"] },
				{ id: "pair-5", label: "F", players: ["X", "O"] },
				{ id: "pair-6", label: "G", players: ["X", "O"] },
				{ id: "pair-7", label: "H", players: ["X", "O"] }
			],
			placements: [],
			initial: []
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
	"place-move-fire-lite": definePreset({
		id: "place-move-fire-lite",
		name: "Place, Move & Fire Lite",
		tags: [
			"phases",
			"place",
			"move",
			"fire",
			"hit-miss",
			"connect-or-destroy",
			"5x5",
			"mechanism"
		],
		description:
			"Each turn: place a public stone, move one of yours, then fire. Win by n-in-a-row or by sinking the hidden fleet. Unlocks place→move→fire + connect_or_destroy dual-objective routing.",
		config: {
			metadata: { name: "Place, Move & Fire Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "alternating",
				phases: ["place", "move", "fire"]
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			movement: { adjacency: "orthogonal", range: 1 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "hit_miss" },
			objective: { mode: "connect_or_destroy" },
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
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			placements: [],
			initial: [
				{ row: 0, col: 0, player: "X", visibility: "owner" },
				{ row: 0, col: 1, player: "X", visibility: "owner" },
				{ row: 4, col: 3, player: "O", visibility: "owner" },
				{ row: 4, col: 4, player: "O", visibility: "owner" }
			]
		}
	}),
	"move-fire-lite": definePreset({
		id: "move-fire-lite",
		name: "Move & Fire Lite",
		tags: [
			"phases",
			"move",
			"fire",
			"hit-miss",
			"5x5",
			"destroy-hidden",
			"mechanism"
		],
		description:
			"Each turn: move your public spotter one step, then fire one shot. Fixed hidden fleets; sink to win. Unlocks turn.phases starting with move (no place) — not place→fire or place→move→fire.",
		config: {
			metadata: { name: "Move & Fire Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "alternating",
				phases: ["move", "fire"]
			},
			rng: { seed: 42 },
			input: { mode: "cell" },
			movement: { adjacency: "orthogonal", range: 1 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "hit_miss" },
			objective: { mode: "destroy_hidden" },
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
			placements: [],
			initial: [
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "O", visibility: "public" },
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
	"replace-race": definePreset({
		id: "replace-race",
		name: "Replace Race",
		tags: ["move", "capture", "replace", "reach-row", "5x5", "mechanism"],
		description:
			"Orthogonal step race with capture-by-replacement: move onto an enemy cell to remove it, then land. Unlocks movement.capture = replace — empty-dest Move cannot express attrition.",
		config: {
			metadata: { name: "Replace Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X one step from O on the target row — capture lands and wins.
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"jump-race": definePreset({
		id: "jump-race",
		name: "Jump Race",
		tags: ["move", "capture", "jump", "chain", "reach-row", "5x5", "mechanism"],
		description:
			"Diagonal step race with jump capture: leap over an adjacent enemy to the empty cell beyond, clearing the mid cell. Further jumps from the landing keep the same seat (mustContinueFrom chain). Unlocks movement.capture = jump — replace lands on the enemy; hop-ball walks empties; neither expresses leap-over capture chains.",
		config: {
			metadata: { name: "Jump Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "diagonal", range: 1, capture: "jump" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Diagonal chain: X(4,0) → jump O(3,1) → (2,2) → jump O(1,3) → (0,4) wins.
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 3, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-jump-race": definePreset({
		id: "hex-jump-race",
		name: "Hex Jump Race",
		tags: [
			"move",
			"capture",
			"jump",
			"chain",
			"reach-row",
			"hex",
			"topology",
			"5x5",
			"mechanism"
		],
		description:
			"Cube-axis jump race on odd-r hex: leap over an adjacent enemy along a cube direction to the empty cell beyond. Further jumps from the landing keep the same seat (mustContinueFrom). Unlocks movement.capture = jump on hex_offset — rectangle Jump Race cannot express hex leap-over geometry; Graph Jump Race covers explicit-edge leaps.",
		config: {
			metadata: { name: "Hex Jump Race", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "jump" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "hex-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Cube-axis chain (q:0,r:-1): X(4,2) → jump O(3,1) → (2,1) → jump O(1,0) → (0,0) wins.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-crowned-jump-lite": definePreset({
		id: "hex-crowned-jump-lite",
		name: "Hex Crowned Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"crowned-range",
			"reach-row",
			"hex",
			"topology",
			"6x6",
			"mechanism"
		],
		description:
			"Cube-axis jump race on odd-r hex with Transform-lite promotion: land on promo row 2 to crown (X+/O+), then quiet-slide with crownedRange 2 to win row 0 — men stay range 1. mustCapture forces the opening leap that promotes (promo row ≠ win row). Unlocks movement.promotion on hex_offset — rectangle Crowned / Flying Kings cannot express hex post-crown movement; Hex Jump Race jumps without transforming piece type.",
		config: {
			metadata: { name: "Hex Crowned Jump Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// Promo row ≠ win row so a crowned 2-step cube slide is playable.
					targetRows: { X: 2, O: 3 },
					crownedAdjacency: "orthogonal",
					crownedRange: 2
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 5 }
			},
			tokens: [
				{
					id: "hex-crowned-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-crowned-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,2) mustCapture-jumps O(3,1)→(2,1): promotes to X+.
				// Men / crownedRange=1 from (2,1) only reach row 1; crownedRange=2
				// reaches (0,0) or (0,2) for the win after O's quiet reply.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-forward-men-jump-lite": definePreset({
		id: "hex-forward-men-jump-lite",
		name: "Hex Forward Men Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"forward-only",
			"men",
			"reach-row",
			"hex",
			"topology",
			"6x6",
			"mechanism"
		],
		description:
			"Hex Checkers-lite forward-only men: uncrowned pieces may only quiet-move or jump with offset-row delta toward their promotion side (same targetRows sign as rectangle Forward Men Jump Lite; cube-axis lands filtered). After crowning, pieces ignore the filter and quiet-slide with crownedRange 2 — including retreat. mustCapture forces the opening forward leap that promotes (promo row ≠ win row). Unlocks promotion.menForwardOnly on hex_offset — rectangle Forward Men cannot express cube-axis forward geometry; Hex Crowned Jump Lite crowns without restricting men direction.",
		config: {
			metadata: { name: "Hex Forward Men Jump Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// X advances −row toward 2; O advances +row toward 4.
					targetRows: { X: 2, O: 4 },
					crownedAdjacency: "orthogonal",
					crownedRange: 2,
					menForwardOnly: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 5 }
			},
			tokens: [
				{
					id: "hex-forward-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-forward-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,2) mustCapture-jumps O(3,1)→(2,1): forward + promotes.
				// Backward cube steps from (4,2) to row 5 are illegal under
				// menForwardOnly; same-row E/W neighbors (dr=0) also blocked.
				// Spare O at (3,4) has a forward reply (4,4) or (4,5) toward
				// promo row 4. After O replies, X+ at (2,1) walks crownedRange
				// 2 to (0,0) to win — and could also retreat (crowned ignores
				// the forward filter).
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-flying-capture-jump-lite": definePreset({
		id: "hex-flying-capture-jump-lite",
		name: "Hex Flying Capture Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"flying",
			"flying-capture",
			"crowned-range",
			"reach-row",
			"hex",
			"topology",
			"6x6",
			"mechanism"
		],
		description:
			"Hex Draughts-lite flying jump capture: after crowning on odd-r hex, kings may leap over an enemy along a clear cube-axis ray and land beyond the immediate past-mid cell (within crownedRange). mustCapture forces the opening leap onto promo row 3 (≠ win row 0); mustContinueFrom then requires a second jump from the crowned piece. Adjacent-only continuation lands at (1,1); flying capture reaches (0,1) for the win. Unlocks promotion.crownedFlyingCapture on hex_offset — Hex Crowned Jump Lite extends quiet slides only; rectangle Flying Capture Jump Lite cannot express cube-axis rays.",
		config: {
			metadata: { name: "Hex Flying Capture Jump Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					targetRows: { X: 3, O: 2 },
					crownedAdjacency: "orthogonal",
					crownedRange: 4,
					crownedFlyingCapture: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 5 }
			},
			tokens: [
				{
					id: "hex-flycap-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-flycap-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(5,3) mustCapture-jumps O(4,3)→(3,2): promotes to X+.
				// mustContinueFrom: O(2,2) is the next mid; adjacent land is
				// (1,1); crownedFlyingCapture also reaches (0,1) for the win.
				{ row: 5, col: 3, player: "X", visibility: "public" },
				{ row: 4, col: 3, player: "O", visibility: "public" },
				{ row: 2, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-flying-capture-jump-lite": definePreset({
		id: "graph-flying-capture-jump-lite",
		name: "Graph Flying Capture Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"flying",
			"flying-capture",
			"crowned-range",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Lane-graph Draughts-lite flying jump capture: after crowning on a chain-walk lane, kings may leap over an enemy along a clear unique-forward edge ray and land beyond the immediate past-mid node (within crownedRange). mustCapture forces the opening leap onto promo row 4 (≠ win row 0); mustContinueFrom then requires a second jump from the crowned piece. Adjacent-only continuation lands at (2,0); flying capture reaches (0,0) for the win. Unlocks promotion.crownedFlyingCapture on graph — Graph Crowned Jump Lite extends quiet chain-walks only; rectangle/hex Flying Capture presets cannot express explicit-edge chain-walk rays.",
		config: {
			metadata: { name: "Graph Flying Capture Jump Lite", version: 1 },
			grid: {
				width: 2,
				height: 7,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 5, col: 0, x: 0, y: 5 },
					{ row: 6, col: 0, x: 0, y: 6 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 },
					{ row: 5, col: 1, x: 1, y: 5 },
					{ row: 6, col: 1, x: 1, y: 6 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["4,0", "5,0"],
					["5,0", "6,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"],
					["4,1", "5,1"],
					["5,1", "6,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					targetRows: { X: 4, O: 5 },
					crownedAdjacency: "orthogonal",
					crownedRange: 4,
					crownedFlyingCapture: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 6 }
			},
			tokens: [
				{
					id: "graph-flycap-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-flycap-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(6,0) mustCapture-jumps O(5,0)→(4,0): promotes to X+.
				// mustContinueFrom: O(3,0) is the next mid; adjacent land is
				// (2,0); crownedFlyingCapture also reaches (0,0) for the win.
				{ row: 6, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "O", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-crowned-jump-lite": definePreset({
		id: "graph-crowned-jump-lite",
		name: "Graph Crowned Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"crowned-range",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Lane graph jump race with Transform-lite promotion: land on promo row 2 to crown (X+/O+), then chain-walk with crownedRange 2 to win row 0 — men stay range 1. mustCapture forces the opening leap that promotes (promo row ≠ win row). Unlocks movement.promotion on graph — rectangle/hex Crowned presets cannot express post-crown edge chain-walks; Graph Jump Race leaps without transforming piece type.",
		config: {
			metadata: { name: "Graph Crowned Jump Lite", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// Promo row ≠ win row so a crowned 2-edge chain walk is playable.
					targetRows: { X: 2, O: 3 },
					crownedAdjacency: "orthogonal",
					crownedRange: 2
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-crowned-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-crowned-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,0) mustCapture-jumps O(3,0)→(2,0): promotes to X+.
				// Men / crownedRange=1 from (2,0) only reach (1,0); crownedRange=2
				// reaches (0,0) for the win after O's quiet reply on lane 1.
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-forward-men-jump-lite": definePreset({
		id: "graph-forward-men-jump-lite",
		name: "Graph Forward Men Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"forward-only",
			"men",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Lane-graph Checkers-lite forward-only men: uncrowned pieces may only quiet-move or jump when the land strictly decreases shortest-path edge distance to their promotion row (targetRows). After crowning, pieces ignore the filter and chain-walk with crownedRange 2 — including retreat. mustCapture forces the opening forward leap that promotes (promo row ≠ win row). Unlocks promotion.menForwardOnly on graph — rectangle/hex Forward Men use row-delta; Graph Crowned Jump Lite crowns without restricting men direction. Hub-node forward geometry is Graph Hub Forward Men Jump Lite (targetNodes).",
		config: {
			metadata: { name: "Graph Forward Men Jump Lite", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// X advances toward row 2; O toward row 3 (edge-distance).
					targetRows: { X: 2, O: 3 },
					crownedAdjacency: "orthogonal",
					crownedRange: 2,
					menForwardOnly: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-forward-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-forward-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,0) mustCapture-jumps O(3,0)→(2,0): forward + promotes.
				// Quiet retreat toward row 4 is illegal under menForwardOnly
				// (edge distance to promo row 2 increases). Spare O at (4,1)
				// has a forward reply (3,1) toward promo row 3. After O
				// replies, X+ at (2,0) walks crownedRange 2 to (0,0) to win.
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-hub-crowned-jump-lite": definePreset({
		id: "graph-hub-crowned-jump-lite",
		name: "Graph Hub Crowned Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"crowned-range",
			"target-nodes",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Hub-graph jump race with node-key promotion: land on hub (2,1) to crown (X+/O+), not the same-row decoy (2,0). After crowning, crownedRange 2 chain-walks through (1,1) to win row 0 — men stay range 1. mustCapture forces the opening leap onto the hub (promo node ≠ win row). Unlocks movement.promotion.targetNodes — Graph Crowned Jump Lite's targetRows cannot distinguish co-row hub vs decoy nodes.",
		config: {
			metadata: { name: "Graph Hub Crowned Jump Lite", version: 1 },
			grid: {
				width: 3,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 3, col: 2, x: 2, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 4, col: 2, x: 2, y: 4 }
				],
				edges: [
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "2,0"],
					["2,1", "3,0"],
					["3,0", "4,0"],
					// O dangling lane — not hub-adjacent, so O's quiet reply
					// cannot create a mustCapture jump from the crowned hub.
					["3,2", "4,2"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// Hub vs same-row decoy (2,0) — targetRows cannot express this.
					targetNodes: { X: "2,1", O: "2,0" },
					crownedAdjacency: "orthogonal",
					crownedRange: 2
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-hub-crowned-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-hub-crowned-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,0) mustCapture-jumps O(3,0)→hub(2,1): promotes to X+.
				// Men from hub only reach (1,1); crownedRange=2 reaches (0,1).
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-hub-forward-men-jump-lite": definePreset({
		id: "graph-hub-forward-men-jump-lite",
		name: "Graph Hub Forward Men Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"forward-only",
			"men",
			"target-nodes",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Hub-graph Checkers-lite forward-only men: uncrowned pieces may only quiet-move or jump when the land strictly decreases shortest-path edge distance to their promotion hub (targetNodes). Same-row decoy (2,0) is not forward for X hub (2,1) — row-based menForwardOnly cannot express this. O's hub is dangling-lane (3,2) so the spare reply stays hub-reachable. After crowning, pieces ignore the filter and chain-walk with crownedRange 2 — including retreat. mustCapture forces the opening forward leap onto the hub (promo node ≠ win row). Unlocks promotion.menForwardOnly + targetNodes — Graph Forward Men Jump Lite uses targetRows edge-distance; Graph Hub Crowned Jump Lite crowns without restricting men direction.",
		config: {
			metadata: { name: "Graph Hub Forward Men Jump Lite", version: 1 },
			grid: {
				width: 3,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 3, col: 2, x: 2, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 4, col: 2, x: 2, y: 4 }
				],
				edges: [
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "2,0"],
					["2,1", "3,0"],
					["3,0", "4,0"],
					// O dangling lane — not hub-adjacent, so O's quiet reply
					// cannot create a mustCapture jump from the crowned hub.
					["3,2", "4,2"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// X hub vs same-row decoy (2,0). O's hub is the dangling-lane
					// node so (4,2)→(3,2) is hub-forward (main-graph hub "2,0"
					// is unreachable from the isolated lane under edge-distance).
					targetNodes: { X: "2,1", O: "3,2" },
					crownedAdjacency: "orthogonal",
					crownedRange: 2,
					menForwardOnly: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-hub-forward-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-hub-forward-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,0) mustCapture-jumps O(3,0)→hub(2,1): forward + promotes.
				// Quiet to same-row decoy (2,0) from (1,1) is not hub-forward.
				// Spare O at (4,2) has a dangling-lane reply. After O replies,
				// X+ at (2,1) walks crownedRange 2 to (0,1) to win.
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-jump-race": definePreset({
		id: "graph-jump-race",
		name: "Graph Jump Race",
		tags: [
			"move",
			"capture",
			"jump",
			"chain",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Two-lane graph jump race: leap over an edge-adjacent enemy node to the empty node two hops away. Further jumps from the landing keep the same seat (mustContinueFrom). Unlocks movement.capture = jump on graph — Graph Replace lands on the enemy; Graph Hop walks empties; neither expresses leap-over capture chains on explicit edges.",
		config: {
			metadata: { name: "Graph Jump Race", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "jump" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Lane 0 chain: X(4,0) → jump O(3,0) → (2,0) → jump O(1,0) → (0,0) wins.
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"mandatory-jump-race": definePreset({
		id: "mandatory-jump-race",
		name: "Mandatory Jump Race",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"chain",
			"reach-row",
			"5x5",
			"mechanism"
		],
		description:
			"Jump Race with Checkers-lite mandatory capture: when any jump exists for the acting seat, quiet diagonal steps are illegal at turn start (mustCapture). Opening X has both a quiet escape and a jump — only the jump is legal. Mid-chain still uses mustContinueFrom. Unlocks movement.mustCapture — optional jump (Jump Race) still allows quiet moves when jumps exist.",
		config: {
			metadata: { name: "Mandatory Jump Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "mandatory-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "mandatory-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,2): quiet (3,3) exists AND jump over O(3,1)→(2,0).
				// mustCapture forbids quiet; chain (2,0)→jump O(1,1)→(0,2) wins.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"mandatory-longest-jump-lite": definePreset({
		id: "mandatory-longest-jump-lite",
		name: "Mandatory Longest Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"must-longest",
			"chain",
			"reach-row",
			"5x5",
			"mechanism"
		],
		description:
			"Draughts-lite longest mandatory capture: mustCapture forbids quiet moves, and mustLongestCapture keeps only jumps that begin a maximum-length chain. Opening X has a 1-capture jump from (3,0) and a 2-capture chain from (4,4) — only the longer start is legal. Mid-chain branches also prefer max remaining captures. Unlocks movement.mustLongestCapture — mustCapture alone still allows shorter jumps.",
		config: {
			metadata: { name: "Mandatory Longest Jump Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				mustLongestCapture: true
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "longest-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "longest-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Short: X(3,0) jumps O(2,1)→(1,2) — length 1 only.
				// Long: X(4,4) jumps O(3,3)→(2,2), then O(1,1)→(0,0) wins.
				// mustCapture alone would allow both starts; mustLongest keeps only the 2-chain.
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "X", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 4, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"crowned-jump-race": definePreset({
		id: "crowned-jump-race",
		name: "Crowned Kings Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"reach-row",
			"5x5",
			"mechanism"
		],
		description:
			"Diagonal jump race with Transform-lite promotion: land on promotion row 1 to crown (X+/O+), then use crowned king adjacency (orthogonal) to reach win row 0 — a step men cannot take. mustCapture forces the opening leap that promotes (promo row ≠ win row so crowning does not end the game). Unlocks movement.promotion — jump/mustCapture alone cannot change piece type in place.",
		config: {
			metadata: { name: "Crowned Kings Jump Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// Promo row ≠ win row so a crowned orthogonal step is playable.
					targetRows: { X: 1, O: 3 },
					crownedAdjacency: "king"
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "crowned-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "crowned-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(3,2) mustCapture-jumps O(2,1)→(1,0): promotes to X+ (still playing).
				// After O's reply, X+ at (1,0) walks orthogonal (0,0) to win — men
				// (diagonal-only) have no (1,0)→(0,0) quiet step.
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"forward-men-jump-lite": definePreset({
		id: "forward-men-jump-lite",
		name: "Forward Men Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"forward-only",
			"men",
			"reach-row",
			"5x5",
			"mechanism"
		],
		description:
			"Checkers-lite forward-only men: uncrowned pieces may only quiet-move or jump toward their promotion side (row-delta from the two targetRows). After crowning, pieces ignore the filter and use crownedAdjacency (king) — including retreat. mustCapture forces the opening forward leap that promotes (promo row ≠ win row). Unlocks promotion.menForwardOnly — promotion alone changes adjacency, not direction.",
		config: {
			metadata: { name: "Forward Men Jump Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					targetRows: { X: 1, O: 3 },
					crownedAdjacency: "king",
					menForwardOnly: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "forward-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "forward-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(3,2) mustCapture-jumps O(2,1)→(1,0): forward + promotes.
				// Backward quiet diagonals from (3,2) are illegal under menForwardOnly.
				// Spare O sits above its promo row so a forward reply exists (2,4)→(3,3).
				// After O replies, X+ at (1,0) walks orthogonal (0,0) to win — and could
				// also retreat (crowned ignores the forward filter).
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"flying-kings-jump-lite": definePreset({
		id: "flying-kings-jump-lite",
		name: "Flying Kings Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"flying",
			"crowned-range",
			"reach-row",
			"6x6",
			"mechanism"
		],
		description:
			"Draughts-lite flying kings: men stay diagonal range 1; after crowning, pieces keep diagonal adjacency but quiet-slide with crownedRange 2. mustCapture forces the opening leap onto promo row 2 (≠ win row 0). From (2,4) only a 2-step diagonal reaches win row 0 — Crowned Kings Jump Lite changes adjacency, not slide depth. Jump leaps stay single-step (no flying capture). Unlocks promotion.crownedRange.",
		config: {
			metadata: { name: "Flying Kings Jump Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					// Promo row ≠ win row so a crowned 2-step quiet is playable.
					targetRows: { X: 2, O: 3 },
					crownedAdjacency: "diagonal",
					crownedRange: 2
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 5 }
			},
			tokens: [
				{
					id: "flying-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "flying-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(4,2) mustCapture-jumps O(3,3)→(2,4): promotes to X+.
				// Men / crownedRange=1 from (2,4) only reach row 1; crownedRange=2
				// reaches (0,2) for the win after O's quiet reply.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" }
			]
		}
	}),
	"flying-capture-jump-lite": definePreset({
		id: "flying-capture-jump-lite",
		name: "Flying Capture Jump Lite",
		tags: [
			"move",
			"capture",
			"jump",
			"must-capture",
			"promotion",
			"crown",
			"flying",
			"flying-capture",
			"crowned-range",
			"reach-row",
			"6x6",
			"mechanism"
		],
		description:
			"Draughts-lite flying jump capture: after crowning, kings may leap over an enemy along a clear diagonal ray and land beyond the immediate past-mid cell (within crownedRange). mustCapture forces the opening leap onto promo row 3 (≠ win row 0); mustContinueFrom then requires a second jump from the crowned piece. Adjacent-only continuation lands at (1,3); flying capture reaches (0,2) for the win. Unlocks promotion.crownedFlyingCapture — Flying Kings Jump Lite extends quiet slides only.",
		config: {
			metadata: { name: "Flying Capture Jump Lite", version: 1 },
			grid: { width: 6, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				mustCapture: true,
				promotion: {
					targetRows: { X: 3, O: 2 },
					crownedAdjacency: "diagonal",
					crownedRange: 4,
					crownedFlyingCapture: true
				}
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 5 }
			},
			tokens: [
				{
					id: "flycap-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "flycap-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(5,3) mustCapture-jumps O(4,4)→(3,5): promotes to X+.
				// mustContinueFrom: O(2,4) is the next mid; adjacent land is
				// (1,3); crownedFlyingCapture also reaches (0,2) for the win.
				{ row: 5, col: 3, player: "X", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-replace-race": definePreset({
		id: "hex-replace-race",
		name: "Hex Replace Race",
		tags: [
			"move",
			"capture",
			"replace",
			"reach-row",
			"hex",
			"topology",
			"5x5",
			"mechanism"
		],
		description:
			"Cube-axis step race on odd-r hex with capture-by-replacement: move onto an enemy cell to remove it, then land. Unlocks movement.capture = replace on hex_offset — rectangle Replace Race cannot express hex attrition; graph replace is Graph Replace Race.",
		config: {
			metadata: { name: "Hex Replace Race", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "hex-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Odd-r: (1,2) is a cube-axis neighbor of (0,2) — capture lands and wins.
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-replace-race": definePreset({
		id: "graph-replace-race",
		name: "Graph Replace Race",
		tags: [
			"move",
			"capture",
			"replace",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Chain-walk step race on two parallel graph lanes with capture-by-replacement: move onto an enemy node to remove it, then land. Unlocks movement.capture = replace on graph — rectangle/hex Replace Race cannot express graph-edge attrition.",
		config: {
			metadata: { name: "Graph Replace Race", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// Lane 0: X one edge from O on the target row — capture lands and wins.
				{ row: 1, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"guess-who-lite": definePreset({
		id: "guess-who-lite",
		name: "Guess Who Lite",
		tags: ["deduction", "query", "observation", "mechanism", "mvp"],
		description:
			"4-character roster; ask yes/no trait queries; guess opponent secret to win. Unlocks query + guess operators (README Guess Who-like MVP).",
		config: {
			metadata: { name: "Guess Who Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"simultaneous-guess-who-lite": definePreset({
		id: "simultaneous-guess-who-lite",
		name: "Simultaneous Guess Who Lite",
		tags: [
			"deduction",
			"query",
			"simultaneous",
			"observation",
			"mechanism"
		],
		description:
			"Both seats ask one single-trait query (or both guess) per round; joint resolve against opponent secrets with auto-prune. Unlocks turn.schedule = simultaneous + input.mode = deduction — not commitReveal (compound covered by Simultaneous Guess Who And Lite; hidden commits by Hidden Simultaneous Guess Who Lite; manual eliminate by Simultaneous Guess Who Commit Lite; open joint UCT by M34).",
		config: {
			metadata: { name: "Simultaneous Guess Who Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				queryShape: "single",
				autoEliminate: true,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"simultaneous-guess-who-commit-lite": definePreset({
		id: "simultaneous-guess-who-commit-lite",
		name: "Simultaneous Guess Who Commit Lite",
		tags: [
			"deduction",
			"query",
			"eliminate",
			"simultaneous",
			"observation",
			"mechanism"
		],
		description:
			"Same roster as Simultaneous Guess Who Lite, but queries only answer — both seats manually eliminate (or guess) on separate joint rounds. Unlocks autoEliminate = false under open simultaneous deduction + simultaneousEliminate — not commitReveal (see Hidden Simultaneous Guess Who Commit Lite), not in-turn phases.",
		config: {
			metadata: {
				name: "Simultaneous Guess Who Commit Lite",
				version: 1
			},
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "end_turn",
				queryShape: "single",
				autoEliminate: false,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"hidden-simultaneous-guess-who-lite": definePreset({
		id: "hidden-simultaneous-guess-who-lite",
		name: "Hidden Simultaneous Guess Who Lite",
		tags: [
			"deduction",
			"query",
			"simultaneous",
			"commitReveal",
			"observation",
			"mechanism"
		],
		description:
			"Same roster as Simultaneous Guess Who Lite, but each seat commits a query (or guess) privately; answers and auto-prune reveal only when both have committed. Unlocks turn.commitReveal under simultaneous deduction + fresh-round joint UCT/MCTS over reveal plans (M36). Manual eliminate under commitReveal: see Hidden Simultaneous Guess Who Commit Lite.",
		config: {
			metadata: {
				name: "Hidden Simultaneous Guess Who Lite",
				version: 1
			},
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			},
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				queryShape: "single",
				autoEliminate: true,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"hidden-simultaneous-guess-who-commit-lite": definePreset({
		id: "hidden-simultaneous-guess-who-commit-lite",
		name: "Hidden Simultaneous Guess Who Commit Lite",
		tags: [
			"deduction",
			"query",
			"eliminate",
			"simultaneous",
			"commitReveal",
			"observation",
			"mechanism"
		],
		description:
			"CommitReveal + manual eliminate: each seat privately commits query, guess, or eliminate; matching-kind reveal when both ready. Unlocks commitEliminate under simultaneous deduction commitReveal (M37) + fresh-round joint UCT over 48 reveal plans (16 query + 16 guess + 16 eliminate).",
		config: {
			metadata: {
				name: "Hidden Simultaneous Guess Who Commit Lite",
				version: 1
			},
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			},
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "end_turn",
				queryShape: "single",
				autoEliminate: false,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"simultaneous-guess-who-and-lite": definePreset({
		id: "simultaneous-guess-who-and-lite",
		name: "Simultaneous Guess Who And Lite",
		tags: [
			"deduction",
			"query",
			"conjunction",
			"simultaneous",
			"observation",
			"mechanism"
		],
		description:
			"Both seats ask one 2-clause AND query (or both guess) per round; joint resolve with independent compound prune. Unlocks simultaneous deduction + queryShape = and — not or-arity demos or commitReveal (see Hidden Simultaneous Guess Who Lite); open joint UCT covered by M34.",
		config: {
			metadata: { name: "Simultaneous Guess Who And Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				queryShape: "and",
				autoEliminate: true,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"guess-who-commit-lite": definePreset({
		id: "guess-who-commit-lite",
		name: "Guess Who Commit Lite",
		tags: ["deduction", "query", "eliminate", "observation", "mechanism"],
		description:
			"Same roster as Guess Who Lite, but queries only answer yes/no — players manually eliminate candidates (Commit hypothesis). Wrong guess ends the turn (no instant loss).",
		config: {
			metadata: { name: "Guess Who Commit Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "end_turn",
				autoEliminate: false,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"guess-who-commit-phases-lite": definePreset({
		id: "guess-who-commit-phases-lite",
		name: "Guess Who Commit Phases Lite",
		tags: [
			"deduction",
			"query",
			"eliminate",
			"phases",
			"observation",
			"mechanism"
		],
		description:
			"Same Commit Lite roster, but each turn is query→eliminate in-turn phases — ask, then flip a candidate before handoff. Unlocks deduction turn.phases (cannot mix with place/move/fire).",
		config: {
			metadata: { name: "Guess Who Commit Phases Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "alternating",
				phases: ["query", "eliminate"]
			},
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "end_turn",
				autoEliminate: false,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"guess-who-and-lite": definePreset({
		id: "guess-who-and-lite",
		name: "Guess Who And Lite",
		tags: ["deduction", "query", "conjunction", "observation", "mechanism"],
		description:
			"Same 4-character roster as Guess Who Lite, but each query is a 2-clause AND (e.g. glasses and hat?). Unlocks deduction.queryShape = and — compound pruning atomic queries cannot express in one turn.",
		config: {
			metadata: { name: "Guess Who And Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				queryShape: "and",
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"guess-who-or-lite": definePreset({
		id: "guess-who-or-lite",
		name: "Guess Who Or Lite",
		tags: ["deduction", "query", "disjunction", "observation", "mechanism"],
		description:
			"Same 4-character roster as Guess Who And Lite, but each query is a 2-clause OR (e.g. glasses or hat?). Unlocks deduction.queryShape = or — compound disjunction pruning neither atomics nor AND can express in one turn.",
		config: {
			metadata: { name: "Guess Who Or Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat"],
				wrongGuess: "lose",
				queryShape: "or",
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } },
					{ id: "cara", traits: { glasses: true, hat: true } },
					{ id: "dan", traits: { glasses: false, hat: false } }
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"guess-who-and3-lite": definePreset({
		id: "guess-who-and3-lite",
		name: "Guess Who And3 Lite",
		tags: [
			"deduction",
			"query",
			"conjunction",
			"compound-arity",
			"observation",
			"mechanism"
		],
		description:
			"8-character 3-trait roster; each query is a 3-clause AND. Unlocks deduction.compoundArity > 2 — one-turn triple prune that no 2-clause AND can express.",
		config: {
			metadata: { name: "Guess Who And3 Lite", version: 1 },
			grid: { width: 1, height: 1, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating" },
			rng: { seed: 42 },
			input: { mode: "deduction" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "deduction" },
			objective: { mode: "identify_secret" },
			deduction: {
				traits: ["glasses", "hat", "beard"],
				wrongGuess: "lose",
				queryShape: "and",
				compoundArity: 3,
				roster: [
					{
						id: "ann",
						traits: { glasses: true, hat: true, beard: true }
					},
					{
						id: "bob",
						traits: { glasses: true, hat: true, beard: false }
					},
					{
						id: "cara",
						traits: { glasses: true, hat: false, beard: true }
					},
					{
						id: "dan",
						traits: { glasses: true, hat: false, beard: false }
					},
					{
						id: "eve",
						traits: { glasses: false, hat: true, beard: true }
					},
					{
						id: "fran",
						traits: { glasses: false, hat: true, beard: false }
					},
					{
						id: "gus",
						traits: { glasses: false, hat: false, beard: true }
					},
					{
						id: "hal",
						traits: { glasses: false, hat: false, beard: false }
					}
				]
			},
			tokens: [
				{
					id: "guess-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "guess-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			]
		}
	}),
	"simultaneous-step-race": definePreset({
		id: "simultaneous-step-race",
		name: "Simultaneous Step Race",
		tags: ["move", "reach-row", "simultaneous", "5x5", "mechanism"],
		description:
			"Both runners step each round (joint resolve). Same destination → neither moves. Unlocks simultaneous move — not multi-action or hidden commit.",
		config: {
			metadata: { name: "Simultaneous Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
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
	"double-simultaneous-step-race": definePreset({
		id: "double-simultaneous-step-race",
		name: "Double Simultaneous Step Race",
		tags: [
			"move",
			"reach-row",
			"simultaneous",
			"actionsPerTurn",
			"multi-action",
			"5x5",
			"mechanism"
		],
		description:
			"Each seat submits two orthogonal steps per simultaneous round; indexed pairs resolve jointly with mid-round reach_row checks. Same-piece chains allowed (to of step 1 = from of step 2). Unlocks actionsPerTurn > 1 under open simultaneous move — commitReveal multi-move is Hidden Double Simultaneous Step Race; not sliding/replace.",
		config: {
			metadata: { name: "Double Simultaneous Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2
			},
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
					id: "double-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "double-runner-o",
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
	"hidden-simultaneous-step-race": definePreset({
		id: "hidden-simultaneous-step-race",
		name: "Hidden Simultaneous Step Race",
		tags: [
			"move",
			"reach-row",
			"simultaneous",
			"commitReveal",
			"5x5",
			"mechanism"
		],
		description:
			"Each seat privately commits a step; pieces move when both have committed. Same destination → neither moves. Unlocks turn.commitReveal under simultaneous move / commitMove — multi-action commitReveal is Hidden Double Simultaneous Step Race; not replace.",
		config: {
			metadata: { name: "Hidden Simultaneous Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous", commitReveal: true },
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
					id: "hidden-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hidden-runner-o",
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
	"hidden-double-simultaneous-step-race": definePreset({
		id: "hidden-double-simultaneous-step-race",
		name: "Hidden Double Simultaneous Step Race",
		tags: [
			"move",
			"reach-row",
			"simultaneous",
			"commitReveal",
			"actionsPerTurn",
			"multi-action",
			"5x5",
			"mechanism"
		],
		description:
			"Each seat privately commits two orthogonal steps; pieces move when both fill budget. Same-piece chains allowed. Same destination at an index → neither. Unlocks commitReveal + actionsPerTurn > 1 under simultaneous move (range 1, no replace).",
		config: {
			metadata: {
				name: "Hidden Double Simultaneous Step Race",
				version: 1
			},
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2,
				commitReveal: true
			},
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
					id: "hidden-double-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hidden-double-runner-o",
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
	"simultaneous-replace-race": definePreset({
		id: "simultaneous-replace-race",
		name: "Simultaneous Replace Race",
		tags: [
			"move",
			"capture",
			"replace",
			"reach-row",
			"simultaneous",
			"5x5",
			"mechanism"
		],
		description:
			"Joint simultaneous step with replace capture: X can take a stationary O on the target row while O moves a second piece. Joint legality uses vacated-origin paths (same as joint slides) so fleers clear rays while stationary targets stay. Unlocks simultaneous × replace — ordered replace is Ordered Simultaneous Replace Race; slide+replace is Simultaneous Slide Replace Race.",
		config: {
			metadata: { name: "Simultaneous Replace Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "sim-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "sim-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X one step from stationary O prey on target row; O also has a runner.
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" },
				{ row: 0, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"simultaneous-jump-race": definePreset({
		id: "simultaneous-jump-race",
		name: "Simultaneous Jump Race",
		tags: [
			"move",
			"capture",
			"jump",
			"reach-row",
			"simultaneous",
			"5x5",
			"mechanism"
		],
		description:
			"Joint simultaneous diagonal jump: X leaps over a stationary O mid to the target row while O steps a second piece. Single-hop per round (no mustContinueFrom chains). Unlocks simultaneous × jump — Ordered Simultaneous Jump Race covers resolveOrder priority at mid; alternating Jump Race keeps multi-jump chains; Simultaneous Replace Race lands on the enemy rather than leaping over.",
		config: {
			metadata: { name: "Simultaneous Jump Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "diagonal", range: 1, capture: "jump" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "sim-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "sim-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(2,0) jumps mid O(1,1) → land (0,2) wins; O runner (4,4) quiet steps.
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"ordered-simultaneous-jump-race": definePreset({
		id: "ordered-simultaneous-jump-race",
		name: "Ordered Simultaneous Jump Race",
		tags: [
			"move",
			"capture",
			"jump",
			"reach-row",
			"simultaneous",
			"resolve-order",
			"5x5",
			"mechanism"
		],
		description:
			"X-first ordered simultaneous diagonal jump: priority order decides capture-before-flee at the mid cell (unlike replace, which contests the destination). Sequential mid clear — not joint vacated-origin. Unlocks ordered simultaneous × jump; joint mid clear is Simultaneous Jump Race; ordered replace is Ordered Simultaneous Replace Race.",
		config: {
			metadata: {
				name: "Ordered Simultaneous Jump Race",
				version: 1
			},
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				resolveOrder: "x_first"
			},
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "diagonal", range: 1, capture: "jump" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "ordered-jumper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "ordered-jumper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X(2,0) jumps mid O(1,1) → (0,2) wins under x_first; O may try flee (1,1)→(0,0).
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"ordered-simultaneous-replace-race": definePreset({
		id: "ordered-simultaneous-replace-race",
		name: "Ordered Simultaneous Replace Race",
		tags: [
			"move",
			"capture",
			"replace",
			"reach-row",
			"simultaneous",
			"resolve-order",
			"5x5",
			"mechanism"
		],
		description:
			"X-first ordered simultaneous step with replace: priority order decides capture-before-flee vs flee-before-capture. Sequential capture apply — not joint real-board overwrite. Unlocks ordered simultaneous × replace (range 1); slide+replace is Ordered Simultaneous Slide Replace Race.",
		config: {
			metadata: { name: "Ordered Simultaneous Replace Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				resolveOrder: "x_first"
			},
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 1, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "ordered-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "ordered-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X one step from O prey on target row; O can flee sideways same round.
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"simultaneous-slide-race": definePreset({
		id: "simultaneous-slide-race",
		name: "Simultaneous Slide Race",
		tags: ["move", "slide", "range", "reach-row", "simultaneous", "5x5", "mechanism"],
		description:
			"Joint simultaneous rook slides (range 4). Paths validated on a vacated-origin board so a vacating piece does not block the other. Unlocks simultaneous × sliding — not ordered resolve or replace capture.",
		config: {
			metadata: { name: "Simultaneous Slide Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "joint-slider-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "joint-slider-o",
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
	"ordered-simultaneous-slide-race": definePreset({
		id: "ordered-simultaneous-slide-race",
		name: "Ordered Simultaneous Slide Race",
		tags: [
			"move",
			"slide",
			"range",
			"reach-row",
			"simultaneous",
			"resolve-order",
			"5x5",
			"mechanism"
		],
		description:
			"X-first ordered simultaneous rook slides (range 4). Second seat path revalidated after the first seat moves — priority order changes sliding legality, not only same-cell ties. Unlocks ordered simultaneous × sliding.",
		config: {
			metadata: { name: "Ordered Simultaneous Slide Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				resolveOrder: "x_first"
			},
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "ordered-slider-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "ordered-slider-o",
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
	"simultaneous-slide-replace-race": definePreset({
		id: "simultaneous-slide-replace-race",
		name: "Simultaneous Slide Replace Race",
		tags: [
			"move",
			"slide",
			"range",
			"capture",
			"replace",
			"reach-row",
			"simultaneous",
			"5x5",
			"mechanism"
		],
		description:
			"Joint simultaneous rook slide (range 4) with replace: X slides onto a stationary O on the target row while O moves a runner. Vacated-origin legality clears fleeing blockers on the path while stationary capture targets stay. Unlocks simultaneous × slide × replace.",
		config: {
			metadata: { name: "Simultaneous Slide Replace Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "joint-slide-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "joint-slide-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X slides four steps onto stationary O prey; O also has a runner.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" },
				{ row: 0, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"simultaneous-slide-replace-flee-race": definePreset({
		id: "simultaneous-slide-replace-flee-race",
		name: "Simultaneous Slide Replace Flee Race",
		tags: [
			"move",
			"slide",
			"range",
			"capture",
			"replace",
			"reach-row",
			"simultaneous",
			"5x5",
			"mechanism"
		],
		description:
			"Joint simultaneous rook slide (range 4) with replace: O starts on X's ray and flees sideways so X's path clears under vacated-origin hybrid legality. Stationary capture remains Simultaneous Slide Replace Race; ordered flee/land is Ordered Simultaneous Slide Replace Race. Unlocks joint replace path-through-fleeing.",
		config: {
			metadata: {
				name: "Simultaneous Slide Replace Flee Race",
				version: 1
			},
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "joint-slide-flee-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "joint-slide-flee-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// O sits on X's ray and must flee for the slide to be legal jointly.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"ordered-simultaneous-slide-replace-race": definePreset({
		id: "ordered-simultaneous-slide-replace-race",
		name: "Ordered Simultaneous Slide Replace Race",
		tags: [
			"move",
			"slide",
			"range",
			"capture",
			"replace",
			"reach-row",
			"simultaneous",
			"resolve-order",
			"5x5",
			"mechanism"
		],
		description:
			"X-first ordered simultaneous rook slide (range 4) with replace: priority decides capture-before-flee vs flee-then-land on the vacated cell. Sequential path/capture revalidation — not joint real-board overwrite. Unlocks ordered simultaneous × slide × replace.",
		config: {
			metadata: {
				name: "Ordered Simultaneous Slide Replace Race",
				version: 1
			},
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				resolveOrder: "x_first"
			},
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4, capture: "replace" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "ordered-slide-hunter-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "ordered-slide-hunter-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				// X four steps from O prey; O can flee sideways same round.
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"simultaneous-hex-step-race": definePreset({
		id: "simultaneous-hex-step-race",
		name: "Simultaneous Hex Step Race",
		tags: ["move", "reach-row", "simultaneous", "hex", "topology", "mechanism"],
		description:
			"Joint-move step race on odd-r hex: runners step along hex neighbors each round. Unlocks topology-aware movement + simultaneous move on hex_offset.",
		config: {
			metadata: { name: "Simultaneous Hex Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn", schedule: "simultaneous" },
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
					id: "hex-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-runner-o",
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
	"simultaneous-graph-step-race": definePreset({
		id: "simultaneous-graph-step-race",
		name: "Simultaneous Graph Step Race",
		tags: [
			"move",
			"reach-row",
			"simultaneous",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Joint-move race on two parallel graph lanes: steps follow explicit edges only. Unlocks topology-aware movement + simultaneous move on graph.",
		config: {
			metadata: { name: "Simultaneous Graph Step Race", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn", schedule: "simultaneous" },
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
					id: "graph-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-runner-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-slide-race": definePreset({
		id: "graph-slide-race",
		name: "Graph Slide Race",
		tags: [
			"move",
			"slide",
			"range",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Chain-walk slide race on two parallel graph lanes (range 4). Unlocks movement.range > 1 on graph — blocker-aware walk along unique forward edge chains (no turning at junctions; distinct from fog hop-ball BFS). Flee spurs that raise mid-path degree stop the chain.",
		config: {
			metadata: { name: "Graph Slide Race", version: 1 },
			grid: {
				width: 2,
				height: 5,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0, x: 0, y: 0 },
					{ row: 1, col: 0, x: 0, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 3, col: 0, x: 0, y: 3 },
					{ row: 4, col: 0, x: 0, y: 4 },
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 1, x: 1, y: 2 },
					{ row: 3, col: 1, x: 1, y: 3 },
					{ row: 4, col: 1, x: 1, y: 4 }
				],
				edges: [
					["0,0", "1,0"],
					["1,0", "2,0"],
					["2,0", "3,0"],
					["3,0", "4,0"],
					["0,1", "1,1"],
					["1,1", "2,1"],
					["2,1", "3,1"],
					["3,1", "4,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "graph-slider-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-slider-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 1, player: "O", visibility: "public" }
			]
		}
	}),
	"graph-hop-race": definePreset({
		id: "graph-hop-race",
		name: "Graph Hop Race",
		tags: [
			"move",
			"hop",
			"range",
			"reach-row",
			"graph",
			"topology",
			"mechanism"
		],
		description:
			"Hop-ball race on a hub graph (range 2). Unlocks movement.graphReach = hop — BFS within range may turn at junctions (chain-walk Graph Slide Race cannot express spoke landings past a hub). Distinct from fog hop distance.",
		config: {
			metadata: { name: "Graph Hop Race", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 2, col: 2, x: 2, y: 2 }
				],
				edges: [
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: {
				adjacency: "orthogonal",
				range: 2,
				graphReach: "hop"
			},
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 2, O: 0 }
			},
			tokens: [
				{
					id: "graph-hopper-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "graph-hopper-o",
					label: "O",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/o.png" }
				}
			],
			placements: [],
			initial: [
				{ row: 0, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 0, player: "O", visibility: "public" }
			]
		}
	}),
	"hex-step-race": definePreset({
		id: "hex-step-race",
		name: "Hex Step Race",
		tags: ["move", "reach-row", "hex", "topology", "mechanism"],
		description:
			"Alternating orthogonal step race on odd-r hex. Unlocks topology-aware movement (hex neighbors) beyond rectangle deltas.",
		config: {
			metadata: { name: "Hex Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
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
					id: "hex-alt-runner-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-alt-runner-o",
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
	"hex-slide-race": definePreset({
		id: "hex-slide-race",
		name: "Hex Slide Race",
		tags: [
			"move",
			"slide",
			"range",
			"reach-row",
			"hex",
			"topology",
			"mechanism"
		],
		description:
			"Cube-axis slide race on odd-r hex (range 4). Unlocks movement.range > 1 on hex_offset — blocker-aware ray walk along the six cube directions that range-1 hex neighbors cannot express.",
		config: {
			metadata: { name: "Hex Slide Race", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "hex-slider-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "hex-slider-o",
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
	"diagonal-step-race": definePreset({
		id: "diagonal-step-race",
		name: "Diagonal Step Race",
		tags: ["move", "diagonal", "reach-row", "5x5", "mechanism"],
		description:
			"Diagonal-only step race: ferz moves to the far row. Unlocks movement.adjacency = diagonal (piece-table adjacency beyond orthogonal).",
		config: {
			metadata: { name: "Diagonal Step Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "diagonal", range: 1 },
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
	"slide-race": definePreset({
		id: "slide-race",
		name: "Slide Race",
		tags: ["move", "slide", "range", "reach-row", "5x5", "mechanism"],
		description:
			"Orthogonal rook-style slide race: pieces may travel multiple empty cells along a ray (range 4). Unlocks movement.range > 1 — blocker-aware sliding that range-1 adjacency cannot express.",
		config: {
			metadata: { name: "Slide Race", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "move" },
			movement: { adjacency: "orthogonal", range: 4 },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "full" },
			objective: {
				mode: "reach_row",
				targetRows: { X: 0, O: 4 }
			},
			tokens: [
				{
					id: "slider-x",
					label: "X",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/x.png" }
				},
				{
					id: "slider-o",
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
	"go-lite-komi": definePreset({
		id: "go-lite-komi",
		name: "Go Lite Komi",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"komi",
			"mechanism"
		],
		description:
			"Go Lite with second-player komi (objective.komi added to O at two-pass scoring). Empty-board double-pass → O wins by komi; without komi the same script draws. Unlocks scoring compensation — not seki / full Go.",
		config: {
			metadata: { name: "Go Lite Komi", version: 1 },
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
			objective: { mode: "area_control", komi: 0.5 },
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
	"go-lite-seki": definePreset({
		id: "go-lite-seki",
		name: "Go Lite Seki",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"seki",
			"mechanism"
		],
		description:
			"Go Lite with seki-neutral scoring (objective.seki). Seeded mutual-life position: without seki X wins on a mono-border eye; with seki that eye is neutral → draw. Unlocks shared-life scoring — not dead stones / full Go.",
		config: {
			metadata: { name: "Go Lite Seki", version: 1 },
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
			objective: { mode: "area_control", seki: true },
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
			initial: [
				{ row: 0, col: 2, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "X", visibility: "public" },
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 1, col: 3, player: "X", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 4, col: 2, player: "O", visibility: "public" }
			]
		}
	}),
	"go-lite-dead-stones": definePreset({
		id: "go-lite-dead-stones",
		name: "Go Lite Dead Stones",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with pass-alive lite dead-stone removal (objective.deadStones). Seeded thin O ring + interior X: without removal X leads on area; with removal interior X (<2 true eyes, not on edge) is cleared → O wins. Unlocks scoring corpse removal — Benson vital-region life is Go Lite Benson (objective.bensonLife).",
		config: {
			metadata: { name: "Go Lite Dead Stones", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", deadStones: true },
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
			initial: (() => {
				const stones: Array<{
					row: number;
					col: number;
					player: "X" | "O";
					visibility: "public";
				}> = [];
				for (let row = 0; row < 7; row++) {
					for (let col = 0; col < 7; col++) {
						const onRing =
							row === 0 || row === 6 || col === 0 || col === 6;
						if (onRing) {
							stones.push({
								row,
								col,
								player: "O",
								visibility: "public"
							});
						} else if (!(row === 3 && col === 3)) {
							stones.push({
								row,
								col,
								player: "X",
								visibility: "public"
							});
						}
					}
				}
				return stones;
			})()
		}
	}),
	"go-lite-benson": definePreset({
		id: "go-lite-benson",
		name: "Go Lite Benson",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"benson",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with Benson unconditional life at scoring (objective.bensonLife). Seeded dual one-eyed X groups sharing a vital corridor: each has only 1 true eye (dead under deadStones) but both are Benson-alive via the shared region → kept and X wins. Unlocks vital-region life beyond per-group eye count.",
		config: {
			metadata: { name: "Go Lite Benson", version: 1 },
			grid: { width: 9, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", bensonLife: true },
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
			initial: (() => {
				const stones: Array<{
					row: number;
					col: number;
					player: "X" | "O";
					visibility: "public";
				}> = [];
				// Dual one-eyed X blocks sharing a 3-cell corridor (cols 1–3 / 5–7;
				// eyes at (2,2) and (2,6); shared vital region col 4). Interior so
				// deadStones would clear both; Benson keeps both.
				const cells: Array<[number, number]> = [
					[1, 1],
					[1, 2],
					[1, 3],
					[2, 1],
					[2, 3],
					[3, 1],
					[3, 2],
					[3, 3],
					[1, 5],
					[1, 6],
					[1, 7],
					[2, 5],
					[2, 7],
					[3, 5],
					[3, 6],
					[3, 7]
				];
				for (const [row, col] of cells) {
					stones.push({ row, col, player: "X", visibility: "public" });
				}
				return stones;
			})()
		}
	}),
	"go-lite-dame-fill": definePreset({
		id: "go-lite-dame-fill",
		name: "Go Lite Dame Fill",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"dame",
			"damezukai",
			"mechanism"
		],
		description:
			"Go Lite with damezukai-lite endgame (objective.dameFill). Seeded X eye + shared dame corridor: first pass enters endgame where mono-border territory is illegal to fill but dame is legal; filling dame then two-pass scores higher for X. Unlocks region-restricted endgame play beyond immediate two-pass scoring.",
		config: {
			metadata: { name: "Go Lite Dame Fill", version: 1 },
			grid: { width: 5, height: 4, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", dameFill: true },
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
			initial: [
				// Row 0–2: X block with eye at (1,1); O block on the right; (2,2)+bottom = dame
				{ row: 0, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 1, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "O", visibility: "public" },
				{ row: 0, col: 4, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "X", visibility: "public" },
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 1, col: 3, player: "O", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" }
			]
		}
	}),
	"go-lite-mark-dead": definePreset({
		id: "go-lite-mark-dead",
		name: "Go Lite Mark Dead",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"dead-stones",
			"marking",
			"mechanism"
		],
		description:
			"Go Lite with interactive dead-stone marking (objective.markDead). Seeded O ring around a lone X: without marking, double-pass awards O the win on area; with marking, X marks the O group then double-pass removes corpses → X wins. Unlocks player-agreed corpse removal beyond automatic deadStones/Benson.",
		config: {
			metadata: { name: "Go Lite Mark Dead", version: 1 },
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
			objective: { mode: "area_control", markDead: true },
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
			initial: [
				// O ring (1..3)×(1..3) minus center X — O leads on raw area;
				// marking removes the ring so X wins the empty board by lone stone.
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 2, player: "O", visibility: "public" },
				{ row: 1, col: 3, player: "O", visibility: "public" },
				{ row: 2, col: 1, player: "O", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "O", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 2, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" }
			]
		}
	}),
	"go-lite-mark-dead-resume": definePreset({
		id: "go-lite-mark-dead-resume",
		name: "Go Lite Mark Dead Resume",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"dead-stones",
			"marking",
			"dispute",
			"resume",
			"mechanism"
		],
		description:
			"Go Lite Mark Dead plus resume-on-dispute (objective.markDeadResume). Same O-ring seed: after marking the ring, rejectMarks exits marking without scoring so play resumes; a later double-pass without re-marking awards O. Unlocks disagree-and-continue beyond agree-and-remove.",
		config: {
			metadata: { name: "Go Lite Mark Dead Resume", version: 1 },
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
			objective: {
				mode: "area_control",
				markDead: true,
				markDeadResume: true
			},
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
			initial: [
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 2, player: "O", visibility: "public" },
				{ row: 1, col: 3, player: "O", visibility: "public" },
				{ row: 2, col: 1, player: "O", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "O", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 2, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" }
			]
		}
	}),
	"go-lite-ladders": definePreset({
		id: "go-lite-ladders",
		name: "Go Lite Ladders",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"ladder",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with attacker-sente ladder / atari-run removal at scoring (objective.ladderDeath). Seeded edge atari X runner (kept by deadStones/Benson edge foothold): without the flag double-pass draws; with ladderDeath the runner is cleared → O wins. Unlocks forced-capture status beyond static eyes / vital regions.",
		config: {
			metadata: { name: "Go Lite Ladders", version: 1 },
			grid: { width: 6, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", ladderDeath: true },
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
			initial: [
				// Edge atari runner X@(0,2) liberty (1,2) — deadStones/Benson keep (edge).
				{ row: 0, col: 1, player: "O", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 3, player: "O", visibility: "public" },
				// Bulky O right (≥3 liberties)
				{ row: 0, col: 4, player: "O", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 1, col: 5, player: "O", visibility: "public" },
				{ row: 2, col: 5, player: "O", visibility: "public" },
				{ row: 3, col: 4, player: "O", visibility: "public" },
				{ row: 3, col: 5, player: "O", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" },
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 4, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" },
				// Living X mass bottom-left (≥3 liberties) — raw area draws; ladder flips to O
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "X", visibility: "public" },
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 3, col: 3, player: "X", visibility: "public" },
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 3, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" }
			]
		}
	}),
	"go-lite-territory-prisoners": definePreset({
		id: "go-lite-territory-prisoners",
		name: "Go Lite Territory Prisoners",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"prisoners",
			"scoring",
			"mechanism"
		],
		description:
			"Go Lite with Japanese-style territory + prisoners scoring (objective.territoryPrisoners). Seeded stone-heavy X wall + 3-stone X group in atari: O captures then double-pass. Area (stones+territory) awards X; territory+prisoners awards O. Unlocks scoring identity beyond Chinese area.",
		config: {
			metadata: { name: "Go Lite Territory Prisoners", version: 1 },
			grid: { width: 6, height: 6, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", territoryPrisoners: true },
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
			initial: [
				// Living X wall + 4-point eye (rows 0–2)
				{ row: 0, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 1, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 4, player: "X", visibility: "public" },
				{ row: 0, col: 5, player: "X", visibility: "public" },
				{ row: 1, col: 0, player: "X", visibility: "public" },
				{ row: 1, col: 5, player: "X", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "X", visibility: "public" },
				{ row: 2, col: 4, player: "X", visibility: "public" },
				{ row: 2, col: 5, player: "X", visibility: "public" },
				// Extra living X on O's row (stone-heavy area without joining the atari group)
				{ row: 3, col: 5, player: "X", visibility: "public" },
				// O net; liberty at (3,3) for the 3-stone X group below
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 2, player: "O", visibility: "public" },
				{ row: 3, col: 4, player: "O", visibility: "public" },
				{ row: 4, col: 0, player: "O", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 3, player: "X", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" },
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 0, player: "O", visibility: "public" },
				{ row: 5, col: 1, player: "O", visibility: "public" },
				{ row: 5, col: 2, player: "O", visibility: "public" },
				{ row: 5, col: 3, player: "O", visibility: "public" },
				{ row: 5, col: 4, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" }
			]
		}
	}),
	"go-lite-semeai": definePreset({
		id: "go-lite-semeai",
		name: "Go Lite Semeai",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"semeai",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with capturing-race (semeai) removal at scoring (objective.semeaiDeath). Seeded race: X group with 3 liberties vs O with 4 (shared corridor + private); living X mass below an O seal. Without the flag double-pass awards X on area; with semeaiDeath the race X group is cleared → O wins. Unlocks inter-group liberty comparison beyond seki / ladders / static eyes.",
		config: {
			metadata: { name: "Go Lite Semeai", version: 1 },
			grid: { width: 9, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", semeaiDeath: true },
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
			initial: [
				// Race X (3 libs: 1,1 / 1,2 / 1,3) vs O (4 libs: shared 1,3 + private 1,5–1,7)
				{ row: 0, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: 1, player: "X", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 4, player: "O", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 0, col: 6, player: "O", visibility: "public" },
				{ row: 0, col: 7, player: "O", visibility: "public" },
				{ row: 0, col: 8, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "X", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 1, col: 8, player: "O", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 2, col: 1, player: "X", visibility: "public" },
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 2, col: 3, player: "X", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 5, player: "O", visibility: "public" },
				{ row: 2, col: 6, player: "O", visibility: "public" },
				{ row: 2, col: 7, player: "O", visibility: "public" },
				{ row: 2, col: 8, player: "O", visibility: "public" },
				// O seal under race (joins race O; isolates living mass)
				{ row: 3, col: 0, player: "O", visibility: "public" },
				{ row: 3, col: 1, player: "O", visibility: "public" },
				{ row: 3, col: 2, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 3, col: 4, player: "O", visibility: "public" },
				{ row: 3, col: 5, player: "O", visibility: "public" },
				{ row: 3, col: 6, player: "O", visibility: "public" },
				{ row: 3, col: 7, player: "O", visibility: "public" },
				{ row: 3, col: 8, player: "O", visibility: "public" },
				// Living X mass (raw area lead; not in the race)
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 3, player: "X", visibility: "public" },
				{ row: 4, col: 4, player: "X", visibility: "public" },
				{ row: 4, col: 5, player: "X", visibility: "public" },
				{ row: 4, col: 6, player: "X", visibility: "public" },
				{ row: 4, col: 7, player: "X", visibility: "public" },
				{ row: 4, col: 8, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 3, player: "X", visibility: "public" },
				{ row: 5, col: 4, player: "X", visibility: "public" },
				{ row: 5, col: 5, player: "X", visibility: "public" },
				{ row: 5, col: 6, player: "X", visibility: "public" },
				{ row: 5, col: 7, player: "X", visibility: "public" },
				{ row: 5, col: 8, player: "X", visibility: "public" }
			]
		}
	}),
	"go-lite-nakade": definePreset({
		id: "go-lite-nakade",
		name: "Go Lite Nakade",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"nakade",
			"benson",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with T1 nakade (3-straight big-eye) removal at scoring (objective.nakadeDeath). Seeded interior X shell with one true eye + closed 3-cell corridor (Benson-alive, 1 true eye) plus living edge O: without the flag (or with bensonLife) double-pass awards X; with nakadeDeath X is cleared → O wins. Unlocks shape-aware big-eye death beyond eye count / Benson / semeai / ladders.",
		config: {
			metadata: { name: "Go Lite Nakade", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", nakadeDeath: true },
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
			initial: (() => {
				const stones: Array<{
					row: number;
					col: number;
					player: "X" | "O";
					visibility: "public";
				}> = [];
				// Interior X shell (rows/cols 1–5): true eye at (2,2); closed
				// 3-straight nakade corridor at (2,4)/(3,4)/(4,4). One true eye
				// (dead under deadStones) but Benson-alive via eye + corridor.
				const xCells: Array<[number, number]> = [
					[1, 1],
					[1, 2],
					[1, 3],
					[1, 4],
					[1, 5],
					[2, 1],
					[2, 3],
					[2, 5],
					[3, 1],
					[3, 2],
					[3, 3],
					[3, 5],
					[4, 1],
					[4, 2],
					[4, 3],
					[4, 5],
					[5, 1],
					[5, 2],
					[5, 3],
					[5, 4],
					[5, 5]
				];
				for (const [row, col] of xCells) {
					stones.push({ row, col, player: "X", visibility: "public" });
				}
				// Living edge O ring — raw X still leads on area; after nakade
				// clears X, O wins.
				for (let row = 0; row < 7; row++) {
					for (let col = 0; col < 7; col++) {
						if (row === 0 || row === 6 || col === 0 || col === 6) {
							stones.push({
								row,
								col,
								player: "O",
								visibility: "public"
							});
						}
					}
				}
				return stones;
			})()
		}
	}),
	"go-lite-net": definePreset({
		id: "go-lite-net",
		name: "Go Lite Net",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"net",
			"geta",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with attacker-sente net / geta removal at scoring (objective.netDeath). Seeded edge X pair (3 liberties) in geta geometry: without the flag (or with ladderDeath / nakadeDeath / deadStones / Benson) double-pass awards X; with netDeath the trapped group is cleared → O wins. Unlocks multi-liberty escape search beyond ladders / nakade / static eyes.",
		config: {
			metadata: { name: "Go Lite Net", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", netDeath: true },
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
			initial: [
				// Edge geta victim X@(0,2)/(0,3) — exactly 3 libs
				// (0,4)/(1,2)/(1,3). deadStones/Benson keep (edge);
				// ladderDeath skips (not ≤2 libs). Cage O may share a higher
				// liberty count (semeaiDeath can also clear — omit from
				// sibling contrast).
				{ row: 0, col: 0, player: "O", visibility: "public" },
				{ row: 0, col: 1, player: "O", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				// Living O bulk bottom-right
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 4, col: 6, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 6, player: "O", visibility: "public" },
				{ row: 6, col: 4, player: "O", visibility: "public" },
				{ row: 6, col: 5, player: "O", visibility: "public" },
				{ row: 6, col: 6, player: "O", visibility: "public" },
				// Living X mass mid/bottom-left — raw area awards X by 1
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 3, player: "X", visibility: "public" },
				{ row: 6, col: 0, player: "X", visibility: "public" },
				{ row: 6, col: 1, player: "X", visibility: "public" },
				{ row: 6, col: 2, player: "X", visibility: "public" },
				{ row: 6, col: 3, player: "X", visibility: "public" }
			]
		}
	}),
	"go-lite-loose-net": definePreset({
		id: "go-lite-loose-net",
		name: "Go Lite Loose Net",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"net",
			"loose-net",
			"geta",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with attacker-sente loose-net removal at scoring (objective.looseNetDeath). Seeded edge X pair with exactly 4 liberties in loose geta geometry: without the flag (or with netDeath / ladderDeath / nakadeDeath / deadStones / Benson) double-pass awards X; with looseNetDeath the trapped group is cleared → O wins. Extends M77 tight nets (root=3) to root=4 liberty cages.",
		config: {
			metadata: { name: "Go Lite Loose Net", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", looseNetDeath: true },
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
			initial: [
				// Loose geta: drop O@(0,1) vs go-lite-net so victim X@(0,2)/(0,3)
				// has exactly 4 libs (0,1)/(0,4)/(1,2)/(1,3). netDeath skips
				// (≠3); ladderDeath skips (not ≤2); deadStones/Benson keep
				// (edge). Living X mass includes X@(3,2) so it has 5 libs
				// (not also loose-net dead). Cage O may share libs (semeai
				// contrast omitted).
				{ row: 0, col: 0, player: "O", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 1, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 4, col: 6, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 6, player: "O", visibility: "public" },
				{ row: 6, col: 4, player: "O", visibility: "public" },
				{ row: 6, col: 5, player: "O", visibility: "public" },
				{ row: 6, col: 6, player: "O", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "X", visibility: "public" },
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" },
				{ row: 6, col: 0, player: "X", visibility: "public" },
				{ row: 6, col: 1, player: "X", visibility: "public" },
				{ row: 6, col: 2, player: "X", visibility: "public" }
			]
		}
	}),
	"go-lite-sente-ladder": definePreset({
		id: "go-lite-sente-ladder",
		name: "Go Lite Sente Ladder",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"ladder",
			"sente",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with attacker-sente 3-lib → ladder removal at scoring (objective.senteLadderDeath). Seeded open-cage edge X pair (exactly 3 liberties): defender-first netDeath misses, but one attacker liberty-fill ladders. Without the flag (or with netDeath / looseNetDeath / ladderDeath / nakadeDeath / deadStones / Benson) double-pass awards X; with senteLadderDeath the trapped group is cleared → O wins. Unlocks attacker-first polarity vs defender-first nets.",
		config: {
			metadata: { name: "Go Lite Sente Ladder", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", senteLadderDeath: true },
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
			initial: [
				// Open cage vs go-lite-net: drop O@(1,4) so defender-first
				// netDeath fails, but each liberty fill O@(1,2)/(1,3)/(0,4)
				// leaves a ladder. Victim X@(0,2)/(0,3) has exactly 3 libs.
				// Add X@(3,2) so living mass stays ≥4 libs; add O@(2,6)/(3,6)
				// to restore scoring after losing the cage closer. Omit
				// semeai contrast (living mass can lose a shared-lib race).
				{ row: 0, col: 0, player: "O", visibility: "public" },
				{ row: 0, col: 1, player: "O", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" },
				{ row: 2, col: 6, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 3, col: 6, player: "O", visibility: "public" },
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 4, col: 6, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 6, player: "O", visibility: "public" },
				{ row: 6, col: 4, player: "O", visibility: "public" },
				{ row: 6, col: 5, player: "O", visibility: "public" },
				{ row: 6, col: 6, player: "O", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "X", visibility: "public" },
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 3, player: "X", visibility: "public" },
				{ row: 6, col: 0, player: "X", visibility: "public" },
				{ row: 6, col: 1, player: "X", visibility: "public" },
				{ row: 6, col: 2, player: "X", visibility: "public" },
				{ row: 6, col: 3, player: "X", visibility: "public" }
			]
		}
	}),
	"go-lite-approach-net": definePreset({
		id: "go-lite-approach-net",
		name: "Go Lite Approach Net",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"net",
			"approach",
			"geta",
			"dead-stones",
			"mechanism"
		],
		description:
			"Go Lite with approach-move net removal at scoring (objective.approachNetDeath). Seeded open loose-net edge X pair (exactly 4 liberties): defender-first looseNetDeath / netDeath / senteLadderDeath miss, but one non-liberty approach (e.g. O@(1,4)) completes a loose net. Without the flag double-pass awards X; with approachNetDeath the trapped group is cleared → O wins. Unlocks approach/kakari cage-closing beyond liberty-fill sente and defender-first nets.",
		config: {
			metadata: { name: "Go Lite Approach Net", version: 1 },
			grid: { width: 7, height: 7, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties", ko: true },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "area_control", approachNetDeath: true },
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
			initial: [
				// Open loose net vs go-lite-loose-net: drop O@(1,4) so
				// defender-first looseNetDeath fails; approach O@(1,4) (or
				// (2,2)/(2,3)) completes the cage. Victim X@(0,2)/(0,3) has
				// exactly 4 libs. Add O@(3,6) so raw area awards X by 1 and
				// clearance flips to O. Living X keeps X@(3,2) (≥5 libs).
				// Omit semeai contrast on the victim.
				{ row: 0, col: 0, player: "O", visibility: "public" },
				{ row: 0, col: 2, player: "X", visibility: "public" },
				{ row: 0, col: 3, player: "X", visibility: "public" },
				{ row: 0, col: 5, player: "O", visibility: "public" },
				{ row: 1, col: 0, player: "O", visibility: "public" },
				{ row: 1, col: 1, player: "O", visibility: "public" },
				{ row: 2, col: 4, player: "O", visibility: "public" },
				{ row: 3, col: 3, player: "O", visibility: "public" },
				{ row: 3, col: 6, player: "O", visibility: "public" },
				{ row: 4, col: 5, player: "O", visibility: "public" },
				{ row: 4, col: 6, player: "O", visibility: "public" },
				{ row: 5, col: 5, player: "O", visibility: "public" },
				{ row: 5, col: 6, player: "O", visibility: "public" },
				{ row: 6, col: 4, player: "O", visibility: "public" },
				{ row: 6, col: 5, player: "O", visibility: "public" },
				{ row: 6, col: 6, player: "O", visibility: "public" },
				{ row: 2, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 0, player: "X", visibility: "public" },
				{ row: 3, col: 1, player: "X", visibility: "public" },
				{ row: 3, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 0, player: "X", visibility: "public" },
				{ row: 4, col: 1, player: "X", visibility: "public" },
				{ row: 4, col: 2, player: "X", visibility: "public" },
				{ row: 5, col: 0, player: "X", visibility: "public" },
				{ row: 5, col: 1, player: "X", visibility: "public" },
				{ row: 5, col: 2, player: "X", visibility: "public" },
				{ row: 6, col: 0, player: "X", visibility: "public" },
				{ row: 6, col: 1, player: "X", visibility: "public" },
				{ row: 6, col: 2, player: "X", visibility: "public" }
			]
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
	}),
	"hex-go-lite": definePreset({
		id: "hex-go-lite",
		name: "Hex Go Lite",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"ko",
			"hex",
			"mechanism"
		],
		description:
			"Go-lite group capture on hex_offset: six cube-axis liberties (not von Neumann-4), point ko, pass-to-score area control. Unlocks hex liberties / area_control — not full Go, not graph Go.",
		config: {
			metadata: { name: "Hex Go Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
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
	"graph-go-lite": definePreset({
		id: "graph-go-lite",
		name: "Graph Go Lite",
		tags: [
			"liberties",
			"territory",
			"area-control",
			"ko",
			"graph",
			"mechanism"
		],
		description:
			"Go-lite group capture on an explicit-edge graph: liberties follow undirected edges only (not von Neumann-4 / hex cube-axis). Point ko, pass-to-score area control. Unlocks graph liberties / area_control — not full Go.",
		config: {
			metadata: { name: "Graph Go Lite", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				// Same bridge + triangle as Graph Connect Lite — hub degree 3
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
