/**
 * Pure movement legality helpers (M5 Move foothold + piece-table adjacency).
 * Rectangle: orthogonal | diagonal | king with sliding range 1..8 (blocker-
 * aware ray walk). Hex_offset / graph: topology neighbors, orthogonal only,
 * range 1.
 */
import type { Grid, Position, Player } from "@/engine/types";
import { getCell } from "@/engine/types";
import { inBounds, step } from "@/engine/adjacency";
import {
	neighbors,
	type GridTopology,
	type GraphTopologyData
} from "@/engine/topology";

export type MovementAdjacency = "orthogonal" | "diagonal" | "king";

export type MovementConfig = {
	adjacency: MovementAdjacency;
	/** Max steps along a ray (1 = adjacent only; >1 = sliding). */
	range: number;
};

export type MovementBoard = {
	topology?: GridTopology;
	graph?: GraphTopologyData;
	wrap?: boolean;
};

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];

const DIAGONAL: ReadonlyArray<readonly [number, number]> = [
	[-1, -1],
	[-1, 1],
	[1, -1],
	[1, 1]
];

/** Deltas for a movement adjacency (rectangle piece-table rays). */
export function adjacencyDeltas(
	adjacency: MovementAdjacency
): ReadonlyArray<readonly [number, number]> {
	if (adjacency === "orthogonal") return ORTHOGONAL;
	if (adjacency === "diagonal") return DIAGONAL;
	return [...ORTHOGONAL, ...DIAGONAL];
}

function boardOpts(
	wrapOrBoard: boolean | MovementBoard = false
): Required<Pick<MovementBoard, "wrap">> &
	Pick<MovementBoard, "topology" | "graph"> {
	if (typeof wrapOrBoard === "boolean") {
		return { wrap: wrapOrBoard, topology: "rectangle", graph: undefined };
	}
	return {
		wrap: wrapOrBoard.wrap === true,
		topology: wrapOrBoard.topology ?? "rectangle",
		graph: wrapOrBoard.graph
	};
}

function posKey(p: Position): string {
	return `${p.row},${p.col}`;
}

/**
 * Empty cells reachable by sliding along adjacency rays up to `range`.
 * Stops at board edge, occupied cells (no jump), or wrap lap.
 */
function slideDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrap: boolean
): Position[] {
	const out: Position[] = [];
	const range = Math.max(1, Math.floor(config.range));
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		let cur = from;
		const seen = new Set<string>([posKey(from)]);
		for (let dist = 1; dist <= range; dist++) {
			const next = step(grid, cur, { row: dr, col: dc }, wrap);
			if (!next) break;
			const key = posKey(next);
			if (seen.has(key)) break;
			seen.add(key);
			if (getCell(grid, next) !== null) break;
			out.push(next);
			cur = next;
		}
	}
	return out;
}

/** Neighbor cells for a range-1 step under the board topology. */
export function movementNeighbors(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Position[] {
	const { wrap, topology, graph } = boardOpts(wrapOrBoard);
	if (!inBounds(grid, from)) return [];

	if (topology === "hex_offset" || topology === "graph") {
		// Hex/graph foothold: orthogonal = topology neighbors only.
		// Diagonal/king and range>1 piece-tables are rectangle-only for now.
		if (config.adjacency !== "orthogonal") return [];
		if (config.range !== 1) return [];
		return neighbors(grid, from, topology, graph, wrap);
	}

	// Rectangle range-1: one step along each delta (empty check is caller's job).
	const out: Position[] = [];
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		const to = step(grid, from, { row: dr, col: dc }, wrap);
		if (to) out.push(to);
	}
	return out;
}

/**
 * Whether `to` lies on a clear adjacency ray within range.
 * When `grid` is omitted, uses rectangle deltas at distance 1 only (legacy).
 */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig,
	grid?: Grid,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	const opts = boardOpts(wrapOrBoard);
	if (!grid) {
		// Legacy no-grid path: rectangle unit deltas only.
		const dr = to.row - from.row;
		const dc = to.col - from.col;
		return adjacencyDeltas(config.adjacency).some(
			([r, c]) => r === dr && c === dc
		);
	}
	return legalDestinations(grid, from, config, opts).some(
		(n) => n.row === to.row && n.col === to.col
	);
}

/** Empty destinations a piece at `from` may move to. */
export function legalDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Position[] {
	if (!inBounds(grid, from)) return [];
	if (getCell(grid, from) === null) return [];

	const opts = boardOpts(wrapOrBoard);
	const { wrap, topology, graph } = opts;

	if (topology === "hex_offset" || topology === "graph") {
		if (config.adjacency !== "orthogonal") return [];
		if (config.range !== 1) return [];
		const out: Position[] = [];
		for (const to of neighbors(grid, from, topology, graph, wrap)) {
			if (getCell(grid, to) !== null) continue;
			out.push(to);
		}
		return out;
	}

	// Rectangle: sliding ray walk (range 1 ≡ adjacent empty cells).
	return slideDestinations(grid, from, config, wrap);
}

export function canMove(
	grid: Grid,
	from: Position,
	to: Position,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (!inBounds(grid, from) || !inBounds(grid, to)) return false;
	if (getCell(grid, from) !== player) return false;
	if (getCell(grid, to) !== null) return false;
	return legalDestinations(grid, from, config, wrapOrBoard).some(
		(n) => n.row === to.row && n.col === to.col
	);
}

/** Build movement board context from a GameConfig-like object. */
export function movementBoardFrom(config: {
	topology?: GridTopology;
	graph?: GraphTopologyData;
	gridWrap?: boolean;
}): MovementBoard {
	return {
		topology: config.topology ?? "rectangle",
		graph: config.graph,
		wrap: config.gridWrap === true
	};
}
