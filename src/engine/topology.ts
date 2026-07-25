/**
 * Board topology helpers.
 * Rectangle uses row/col deltas; hex_offset uses odd-r (pointy-top) via cube coords;
 * graph uses an explicit adjacency list over embedded {row,col} nodes.
 */
import type { Grid, Position } from "@/engine/types";
import type { AdjacencyConfig } from "@/engine/rules";
import { normalizePos, step } from "@/engine/adjacency";

export type GridTopology = "rectangle" | "hex_offset" | "graph";

export type Cube = { q: number; r: number; s: number };

/** Compiled graph board: playable nodes + undirected neighbor map. */
export type GraphTopologyData = {
	active: Position[];
	/** Optional canvas layout (same length/order as active when present). */
	layout?: Array<{ x: number; y: number }>;
	/** key = "row,col" → neighbor positions */
	neighborsOf: Map<string, Position[]>;
};

export function posKey(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

export function parsePosKey(key: string): Position | null {
	const m = /^(\d+),(\d+)$/.exec(key);
	if (!m) return null;
	return { row: Number(m[1]), col: Number(m[2]) };
}

/** Build undirected adjacency from authoring nodes/edges. */
export function buildGraphTopologyData(
	nodes: Array<{ row: number; col: number; x?: number; y?: number }>,
	edges: Array<[string, string]>
): GraphTopologyData {
	const active = nodes.map((n) => ({ row: n.row, col: n.col }));
	const layout =
		nodes.every((n) => typeof n.x === "number" && typeof n.y === "number")
			? nodes.map((n) => ({ x: n.x as number, y: n.y as number }))
			: undefined;
	const neighborsOf = new Map<string, Position[]>();
	for (const n of active) {
		neighborsOf.set(posKey(n), []);
	}
	const push = (from: string, to: Position) => {
		const list = neighborsOf.get(from);
		if (!list) return;
		if (!list.some((p) => p.row === to.row && p.col === to.col)) {
			list.push(to);
		}
	};
	for (const [a, b] of edges) {
		const pa = parsePosKey(a);
		const pb = parsePosKey(b);
		if (!pa || !pb) continue;
		if (!neighborsOf.has(a) || !neighborsOf.has(b)) continue;
		push(a, pb);
		push(b, pa);
	}
	return { active, layout, neighborsOf };
}

export function isActivePosition(
	pos: Position,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	if (topology !== "graph") return true;
	if (!graph) return false;
	return graph.neighborsOf.has(posKey(pos));
}

export function allActivePositions(
	grid: Grid,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	if (topology === "graph") {
		return graph?.active.slice() ?? [];
	}
	const out: Position[] = [];
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			out.push({ row, col });
		}
	}
	return out;
}

/** odd-r offset → cube */
export function offsetToCube(pos: Position): Cube {
	const q = pos.col - (pos.row - (pos.row & 1)) / 2;
	const r = pos.row;
	return { q, r, s: -q - r };
}

/** cube → odd-r offset */
export function cubeToOffset(cube: Pick<Cube, "q" | "r">): Position {
	const row = cube.r;
	const col = cube.q + (cube.r - (cube.r & 1)) / 2;
	return { row, col };
}

/**
 * One cube-axis step from an odd-r cell, optionally wrapping via modular
 * offset coords (rectangular hex torus — same storage model as rectangle wrap).
 */
export function stepHex(
	grid: Grid,
	from: Position,
	cubeDelta: Pick<Cube, "q" | "r">,
	wrap: boolean
): Position | null {
	const c = offsetToCube(from);
	const next = cubeToOffset({
		q: c.q + cubeDelta.q,
		r: c.r + cubeDelta.r
	});
	return normalizePos(grid, next, wrap);
}

/** Six cube-neighbor deltas (pointy-top hex). */
export const CUBE_NEIGHBOR_DIRS: readonly Cube[] = [
	{ q: 1, r: 0, s: -1 },
	{ q: 1, r: -1, s: 0 },
	{ q: 0, r: -1, s: 1 },
	{ q: -1, r: 0, s: 1 },
	{ q: -1, r: 1, s: 0 },
	{ q: 0, r: 1, s: -1 }
] as const;

/**
 * Three opposite-axis pairs for hex n-in-a-row, keyed like rectangle win flags:
 * horizontal → E/W, vertical → NE/SW, backDiagonal → NW/SE.
 * (forwardDiagonal unused on hex — both diagonals covered by vertical + back.)
 */
const HEX_AXIS_BY_FLAG = {
	horizontal: [
		{ q: 1, r: 0, s: -1 },
		{ q: -1, r: 0, s: 1 }
	],
	vertical: [
		{ q: 0, r: -1, s: 1 },
		{ q: 0, r: 1, s: -1 }
	],
	backDiagonal: [
		{ q: -1, r: 1, s: 0 },
		{ q: 1, r: -1, s: 0 }
	]
} as const;

export function neighbors(
	grid: Grid,
	pos: Position,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	wrap: boolean = false
): Position[] {
	if (topology === "graph") {
		return graph?.neighborsOf.get(posKey(pos))?.slice() ?? [];
	}
	if (topology === "hex_offset") {
		const out: Position[] = [];
		for (const d of CUBE_NEIGHBOR_DIRS) {
			const n = stepHex(grid, pos, d, wrap);
			if (n) out.push(n);
		}
		return out;
	}
	const deltas = [
		{ row: -1, col: 0 },
		{ row: 1, col: 0 },
		{ row: 0, col: -1 },
		{ row: 0, col: 1 },
		{ row: -1, col: -1 },
		{ row: -1, col: 1 },
		{ row: 1, col: -1 },
		{ row: 1, col: 1 }
	];
	const out: Position[] = [];
	for (const d of deltas) {
		const n = step(grid, pos, d, wrap);
		if (n) out.push(n);
	}
	return out;
}

export type WinAdjFunc = (pos: Position) => Position[];

/** Directional step functions for n-in-a-row along enabled axes. */
export function getWinAdjFuncs(
	adjacency: AdjacencyConfig,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	grid?: Grid,
	wrap: boolean = false
): WinAdjFunc[] {
	if (topology === "graph") {
		return [
			(pos) => graph?.neighborsOf.get(posKey(pos))?.slice() ?? []
		];
	}
	if (topology === "hex_offset") {
		const funcs: WinAdjFunc[] = [];
		const pushAxis = (dirs: readonly Cube[]) => {
			for (const d of dirs) {
				if (grid && wrap) {
					funcs.push((pos) => {
						const next = stepHex(grid, pos, d, true);
						return next ? [next] : [];
					});
				} else {
					funcs.push((pos) => {
						const c = offsetToCube(pos);
						return [cubeToOffset({ q: c.q + d.q, r: c.r + d.r })];
					});
				}
			}
		};
		if (adjacency.horizontal) pushAxis(HEX_AXIS_BY_FLAG.horizontal);
		if (adjacency.vertical) pushAxis(HEX_AXIS_BY_FLAG.vertical);
		if (adjacency.backDiagonal || adjacency.forwardDiagonal) {
			pushAxis(HEX_AXIS_BY_FLAG.backDiagonal);
		}
		return funcs;
	}

	const dirs: Position[] = [];
	if (adjacency.horizontal) dirs.push({ row: 0, col: -1 }, { row: 0, col: 1 });
	if (adjacency.vertical) dirs.push({ row: -1, col: 0 }, { row: 1, col: 0 });
	if (adjacency.backDiagonal)
		dirs.push({ row: -1, col: -1 }, { row: 1, col: 1 });
	if (adjacency.forwardDiagonal)
		dirs.push({ row: -1, col: 1 }, { row: 1, col: -1 });

	if (grid && wrap) {
		return dirs.map(
			(d) =>
				(pos: Position) => {
					const next = step(grid, pos, d, true);
					return next ? [next] : [];
				}
		);
	}

	return dirs.map(
		(d) =>
			({ row, col }: Position) =>
				[{ row: row + d.row, col: col + d.col }]
	);
}

/**
 * Pointy-top odd-r hex center in a y-down row index space (size = hex radius).
 * Canvas flips y when placing in Three.js.
 */
export function hexOffsetCenter(
	row: number,
	col: number,
	size: number
): { x: number; y: number } {
	const x = size * Math.sqrt(3) * (col + 0.5 * (row & 1));
	const y = size * 1.5 * row;
	return { x, y };
}

/** Bounding size of an odd-r hex board in the same coordinate system. */
export function hexBoardExtent(
	width: number,
	height: number,
	size: number
): { width: number; height: number } {
	const w = size * Math.sqrt(3) * (width + 0.5);
	const h = size * (1.5 * (height - 1) + 2);
	return { width: w, height: h };
}

/** Bounding box for graph layout coords (defaults to row/col embedding). */
export function graphBoardExtent(
	graph: GraphTopologyData,
	scale: number
): { width: number; height: number } {
	const pts =
		graph.layout ??
		graph.active.map((p) => ({ x: p.col, y: p.row }));
	if (pts.length === 0) return { width: scale * 2, height: scale * 2 };
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}
	const pad = 1;
	return {
		width: (maxX - minX + pad * 2) * scale,
		height: (maxY - minY + pad * 2) * scale
	};
}

export function graphNodeCenter(
	pos: Position,
	graph: GraphTopologyData,
	scale: number
): { x: number; y: number } | null {
	const idx = graph.active.findIndex(
		(p) => p.row === pos.row && p.col === pos.col
	);
	if (idx < 0) return null;
	const pts =
		graph.layout ??
		graph.active.map((p) => ({ x: p.col, y: p.row }));
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}
	const pad = 1;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const p = pts[idx];
	return {
		x: (p.x - cx) * scale,
		y: (p.y - cy) * scale
	};
}
