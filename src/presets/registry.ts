import type { Config } from "@/schemas/config";

export interface ExamplePreset {
	id: string;
	name: string;
	tags: string[];
	description: string;
	config: Config;
	thumbnail?: string; // Optional base64 image or path
}

// Current examples registry
export const examplePresets: Record<string, ExamplePreset> = {
	"tic-tac-toe": {
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
	},
	"connect-4": {
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
	},
	gomoku: {
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
	},
	reversi: {
		id: "reversi",
		name: "Reversi / Othello",
		tags: ["classic", "capture", "8x8"],
		description:
			"Sandwich opponent stones to flip them; valid move must capture at least one line.",
		config: {
			metadata: { name: "Reversi", version: 1 },
			grid: { width: 8, height: 8, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 },
			input: { mode: "cell" },
			tokens: [
				{
					id: "disk-black",
					label: "●",
					players: ["X"],
					asset: { type: "image", url: "/assets/tokens/disk-black.png" }
				},
				{
					id: "disk-white",
					label: "○",
					players: ["O"],
					asset: { type: "image", url: "/assets/tokens/disk-white.png" }
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
	},
	"connect-4-popout": {
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
	}
	// Add more presets here as we create them
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
