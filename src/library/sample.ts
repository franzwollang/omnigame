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

type GraphNode = { row: number; col: number; x: number; y: number };
type GraphEdge = [string, string];

function nodeKey(n: { row: number; col: number }): string {
	return `${n.row},${n.col}`;
}

/** Build a connected undirected graph (spanning tree + optional chords). */
function buildConnectedGraph(
	rng: SamplerRng,
	nodeCount: number
): { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number } {
	const width = Math.max(3, Math.ceil(Math.sqrt(nodeCount)) + 1);
	const height = Math.max(3, Math.ceil(nodeCount / width) + 1);
	const slots: Array<{ row: number; col: number }> = [];
	for (let r = 0; r < height; r++) {
		for (let c = 0; c < width; c++) {
			slots.push({ row: r, col: c });
		}
	}
	// Shuffle slots and take nodeCount unique embeddings
	for (let i = slots.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1)) % (i + 1);
		const tmp = slots[i]!;
		slots[i] = slots[j]!;
		slots[j] = tmp;
	}
	const chosen = slots.slice(0, nodeCount);
	const nodes: GraphNode[] = chosen.map((s) => ({
		row: s.row,
		col: s.col,
		x: s.col,
		y: s.row
	}));

	const edges: GraphEdge[] = [];
	const used = new Set<string>();
	const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

	// Spanning tree: grow from node 0
	const connected = [0];
	const remaining = Array.from({ length: nodeCount - 1 }, (_, i) => i + 1);
	while (remaining.length > 0) {
		const ri = Math.floor(rng() * remaining.length) % remaining.length;
		const next = remaining.splice(ri, 1)[0]!;
		const parent = pick(rng, connected);
		const a = nodeKey(nodes[parent]!);
		const b = nodeKey(nodes[next]!);
		const ek = edgeKey(a, b);
		if (!used.has(ek)) {
			used.add(ek);
			edges.push([a, b]);
		}
		connected.push(next);
	}

	// Extra chords for richer win paths
	const extra = int(rng, 1, Math.max(1, Math.floor(nodeCount / 2)));
	for (let i = 0; i < extra; i++) {
		const aIdx = int(rng, 0, nodeCount - 1);
		let bIdx = int(rng, 0, nodeCount - 1);
		if (bIdx === aIdx) bIdx = (bIdx + 1) % nodeCount;
		const a = nodeKey(nodes[aIdx]!);
		const b = nodeKey(nodes[bIdx]!);
		const ek = edgeKey(a, b);
		if (!used.has(ek)) {
			used.add(ek);
			edges.push([a, b]);
		}
	}

	return { nodes, edges, width, height };
}

/** Coherent graph n-in-a-row (composite adjacency over explicit edges). */
function sampleGraph(rng: SamplerRng, seed: number): ConfigInput {
	const nodeCount = int(rng, 5, 9);
	const { nodes, edges, width, height } = buildConnectedGraph(rng, nodeCount);
	const length = int(rng, 3, Math.min(4, nodeCount));
	const cfg = baseMeta(`Sample graph ${nodeCount}n`, seed);
	cfg.grid = {
		width,
		height,
		topology: "graph",
		wrap: false,
		nodes,
		edges
	};
	cfg.win = {
		length,
		adjacency: {
			mode: "composite",
			horizontal: false,
			vertical: false,
			backDiagonal: false,
			forwardDiagonal: false
		}
	};
	return cfg;
}

type CoherentFamily =
	| "n_in_a_row"
	| "gravity"
	| "hex"
	| "flip"
	| "fog"
	| "graph";

const COHERENT_FAMILIES: readonly CoherentFamily[] = [
	"n_in_a_row",
	"gravity",
	"hex",
	"flip",
	"fog",
	"graph"
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
		case "graph":
			return sampleGraph(rng, seed);
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
	const topology = pick(rng, ["rectangle", "hex_offset", "graph"] as const);
	const schedule = pick(rng, ["alternating", "manual_tick"] as const);
	const captureOn = rng() > 0.5;
	const captureMode = pick(rng, ["flip", "liberties"] as const);

	const grid: Record<string, unknown> = {
		width,
		height,
		topology,
		wrap: false
	};
	// Occasionally emit graph nodes/edges (often broken — Babel noise)
	if (topology === "graph") {
		if (rng() > 0.35) {
			const n = int(rng, 2, 6);
			const nodes = Array.from({ length: n }, (_, i) => ({
				row: int(rng, 0, height - 1),
				col: int(rng, 0, width - 1),
				x: i,
				y: 0
			}));
			grid.nodes = nodes;
			if (rng() > 0.3) {
				grid.edges = Array.from({ length: int(rng, 0, n) }, () => {
					const a = nodes[int(rng, 0, n - 1)]!;
					const b = nodes[int(rng, 0, n - 1)]!;
					return [`${a.row},${a.col}`, `${b.row},${b.col}`];
				});
			}
			// else: omit edges → invalid
		}
		// else: omit nodes → invalid
	}

	const raw: Record<string, unknown> = {
		metadata: { name: `Noise ${seed}`, version: 1 },
		grid,
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
