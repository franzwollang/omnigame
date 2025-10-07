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
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			}
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
