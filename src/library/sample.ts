/**
 * Config sampler for the library explorer (M7).
 *
 * Mixes coherent mechanic families with deliberately noisy random knobs so
 * most draws are invalid/unplayable (Library of Babel framing).
 */
import { mulberry32 } from "@/engine/rng";
import type { ConfigInput } from "@/schemas/config";

export type SamplerRng = () => number;

export function createSamplerRng(seed: number): SamplerRng {
	return mulberry32(seed >>> 0);
}

function pick<T>(rng: SamplerRng, items: readonly T[]): T {
	return items[Math.floor(rng() * items.length) % items.length]!;
}

function int(rng: SamplerRng, min: number, maxInclusive: number): number {
	const span = maxInclusive - min + 1;
	return min + (Math.floor(rng() * span) % span);
}

const DEFAULT_TOKENS: ConfigInput["tokens"] = [
	{ id: "X", label: "X", players: ["X"] },
	{ id: "O", label: "O", players: ["O"] }
];

function baseMeta(name: string, seed: number): ConfigInput {
	return {
		metadata: { name, version: 1 },
		grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
		turn: { mode: "turn", schedule: "alternating" },
		rng: { seed },
		tokens: DEFAULT_TOKENS,
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
		placements: [],
		initial: []
	};
}

/** Coherent n-in-a-row on a small rectangle (often playable). */
function sampleNInARow(rng: SamplerRng, seed: number): ConfigInput {
	const width = int(rng, 3, 5);
	const height = int(rng, 3, 5);
	const length = int(rng, 3, Math.min(width, height));
	const cfg = baseMeta(`Sample n-in-a-row ${width}x${height}`, seed);
	cfg.grid = { width, height, topology: "rectangle", wrap: false };
	cfg.win = {
		length,
		adjacency: {
			mode: "linear",
			horizontal: true,
			vertical: true,
			backDiagonal: rng() > 0.3,
			forwardDiagonal: rng() > 0.3
		}
	};
	return cfg;
}

/** Coherent gravity / column family (Connect-4-ish). */
function sampleGravity(rng: SamplerRng, seed: number): ConfigInput {
	const width = int(rng, 4, 7);
	const height = int(rng, 4, 6);
	const length = int(rng, 3, Math.min(4, width, height));
	const cfg = baseMeta(`Sample gravity ${width}x${height}`, seed);
	cfg.grid = { width, height, topology: "rectangle", wrap: false };
	cfg.input = { mode: "column" };
	cfg.placement = {
		mode: "gravity",
		gravity: { enabled: true, direction: "down", wrap: false },
		overflow: rng() > 0.7 ? "pop_out_bottom" : "reject"
	};
	cfg.win = {
		length,
		adjacency: {
			mode: "linear",
			horizontal: true,
			vertical: true,
			backDiagonal: true,
			forwardDiagonal: true
		}
	};
	return cfg;
}

/** Coherent hex n-in-a-row. */
function sampleHex(rng: SamplerRng, seed: number): ConfigInput {
	const size = int(rng, 3, 5);
	const length = int(rng, 3, size);
	const cfg = baseMeta(`Sample hex ${size}`, seed);
	cfg.grid = {
		width: size,
		height: size,
		topology: "hex_offset",
		wrap: false
	};
	cfg.win = {
		length,
		adjacency: {
			mode: "linear",
			horizontal: true,
			vertical: true,
			backDiagonal: true,
			forwardDiagonal: true
		}
	};
	return cfg;
}

/** Coherent flip-capture + n-in-a-row demo. */
function sampleFlip(rng: SamplerRng, seed: number): ConfigInput {
	const size = int(rng, 4, 6);
	const cfg = baseMeta(`Sample flip ${size}`, seed);
	cfg.grid = { width: size, height: size, topology: "rectangle", wrap: false };
	cfg.placement = {
		mode: "direct",
		overflow: "reject",
		capture: { enabled: true, mode: "flip" }
	};
	cfg.win = {
		length: int(rng, 3, Math.min(5, size)),
		adjacency: {
			mode: "linear",
			horizontal: true,
			vertical: true,
			backDiagonal: true,
			forwardDiagonal: true
		}
	};
	const mid = Math.floor(size / 2) - 1;
	cfg.initial = [
		{ row: mid, col: mid, player: "O", visibility: "public" },
		{ row: mid, col: mid + 1, player: "X", visibility: "public" },
		{ row: mid + 1, col: mid, player: "X", visibility: "public" },
		{ row: mid + 1, col: mid + 1, player: "O", visibility: "public" }
	];
	return cfg;
}

/** Coherent fog-of-war + n-in-a-row. */
function sampleFog(rng: SamplerRng, seed: number): ConfigInput {
	const size = int(rng, 4, 6);
	const length = int(rng, 3, Math.min(4, size));
	const cfg = baseMeta(`Sample fog ${size}`, seed);
	cfg.grid = { width: size, height: size, topology: "rectangle", wrap: false };
	cfg.observation = {
		mode: "fog",
		radius: int(rng, 1, 2),
		metric: pick(rng, ["chebyshev", "manhattan"] as const)
	};
	cfg.win = {
		length,
		adjacency: {
			mode: "linear",
			horizontal: true,
			vertical: true,
			backDiagonal: true,
			forwardDiagonal: true
		}
	};
	return cfg;
}

type CoherentFamily = "n_in_a_row" | "gravity" | "hex" | "flip" | "fog";

const COHERENT_FAMILIES: readonly CoherentFamily[] = [
	"n_in_a_row",
	"gravity",
	"hex",
	"flip",
	"fog"
];

function sampleCoherent(rng: SamplerRng, seed: number): ConfigInput {
	const family = pick(rng, COHERENT_FAMILIES);
	switch (family) {
		case "n_in_a_row":
			return sampleNInARow(rng, seed);
		case "gravity":
			return sampleGravity(rng, seed);
		case "hex":
			return sampleHex(rng, seed);
		case "flip":
			return sampleFlip(rng, seed);
		case "fog":
			return sampleFog(rng, seed);
	}
}

/**
 * Deliberately noisy random knobs — often invalid or unplayable.
 * Independent fields ignore schema pairing rules on purpose.
 */
function sampleNoise(rng: SamplerRng, seed: number): unknown {
	const width = int(rng, 2, 8);
	const height = int(rng, 2, 8);
	const inputMode = pick(rng, ["cell", "column", "move"] as const);
	const placementMode = pick(rng, ["direct", "gravity"] as const);
	const objective = pick(rng, [
		"n_in_a_row",
		"destroy_hidden",
		"reach_row",
		"area_control",
		"none"
	] as const);
	const observation = pick(rng, ["full", "hit_miss", "fog"] as const);
	const topology = pick(rng, ["rectangle", "hex_offset"] as const);
	const schedule = pick(rng, ["alternating", "manual_tick"] as const);
	const captureOn = rng() > 0.5;
	const captureMode = pick(rng, ["flip", "liberties"] as const);

	const raw: Record<string, unknown> = {
		metadata: { name: `Noise ${seed}`, version: 1 },
		grid: { width, height, topology, wrap: false },
		turn: { mode: "turn", schedule },
		rng: { seed },
		tokens: DEFAULT_TOKENS,
		input: { mode: inputMode },
		placement: {
			mode: placementMode,
			overflow: pick(rng, ["reject", "pop_out_bottom"] as const),
			...(placementMode === "gravity"
				? {
						gravity: {
							enabled: true,
							direction: "down",
							wrap: false
						}
					}
				: {}),
			...(captureOn
				? { capture: { enabled: true, mode: captureMode } }
				: {})
		},
		observation: { mode: observation },
		objective: { mode: objective },
		placements: [],
		initial: []
	};

	if (schedule === "manual_tick" && rng() > 0.4) {
		raw.scheduler = { rules: "life_b3s23", neighborhood: "moore" };
	}
	if (inputMode === "move" && rng() > 0.5) {
		raw.movement = { adjacency: "orthogonal", range: 1 };
		raw.objective = {
			mode: "reach_row",
			targetRows: { X: 0, O: height - 1 }
		};
		if (rng() > 0.5) {
			raw.initial = [
				{ row: height - 1, col: 0, player: "X", visibility: "public" },
				{ row: 0, col: width - 1, player: "O", visibility: "public" }
			];
		}
	}
	if (objective === "n_in_a_row") {
		if (rng() > 0.25) {
			raw.win = {
				length: int(rng, 2, Math.max(2, Math.max(width, height) + 2)),
				adjacency: {
					mode: "linear",
					horizontal: rng() > 0.5,
					vertical: rng() > 0.5,
					backDiagonal: rng() > 0.5,
					forwardDiagonal: rng() > 0.5
				}
			};
		}
		// else: omit win → invalid
	}
	if (observation === "hit_miss" && rng() > 0.4) {
		raw.objective = { mode: "destroy_hidden" };
		raw.initial = [
			{
				row: int(rng, 0, height - 1),
				col: int(rng, 0, width - 1),
				player: "X",
				visibility: "owner"
			}
		];
	}

	return raw;
}

/**
 * Draw one raw sample. `coherent` forces a coherent family; otherwise uses noise.
 */
export function sampleRawConfig(
	rng: SamplerRng,
	opts: { seed: number; coherent: boolean }
): unknown {
	if (opts.coherent) return sampleCoherent(rng, opts.seed);
	return sampleNoise(rng, opts.seed);
}
