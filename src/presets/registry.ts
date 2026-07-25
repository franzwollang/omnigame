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
	"go-lite": definePreset({
		id: "go-lite",
		name: "Go Lite",
		tags: ["liberties", "territory", "area-control", "mechanism"],
		description:
			"Orthogonal group capture by liberties + pass-to-score area control. Unlocks liberties/territory — not full Go (no ko, simplified scoring).",
		config: {
			metadata: { name: "Go Lite", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "liberties" },
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
