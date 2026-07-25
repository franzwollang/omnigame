/**
 * Pure movement legality helpers (M5 Move foothold + piece-table adjacency).
 * Range-1 steps: orthogonal | diagonal | king (both) on rectangle;
 * hex_offset / graph use topology neighbors (orthogonal only).
 * Richer ranges later.
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
	range: 1;
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

/** Deltas for a movement adjacency at range 1 (rectangle piece-table). */
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
		// Diagonal/king piece-tables are rectangle-only for now.
		if (config.adjacency !== "orthogonal") return [];
		return neighbors(grid, from, topology, graph, wrap);
	}

	const out: Position[] = [];
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		const to = step(grid, from, { row: dr, col: dc }, wrap);
		if (to) out.push(to);
	}
	return out;
}

/** Toroidal or clipped adjacency of range 1. */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig,
	grid?: Grid,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	const opts = boardOpts(wrapOrBoard);
	if (!grid) {
		// Legacy no-grid path: rectangle deltas only.
		const dr = to.row - from.row;
		const dc = to.col - from.col;
		return adjacencyDeltas(config.adjacency).some(
			([r, c]) => r === dr && c === dc
		);
	}
	return movementNeighbors(grid, from, config, opts).some(
		(n) => n.row === to.row && n.col === to.col
	);
}

/** Empty destinations a piece at `from` may step to. */
export function legalDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Position[] {
	if (!inBounds(grid, from)) return [];
	if (getCell(grid, from) === null) return [];

	const out: Position[] = [];
	if (config.range === 1) {
		for (const to of movementNeighbors(grid, from, config, wrapOrBoard)) {
			if (getCell(grid, to) !== null) continue;
			out.push(to);
		}
	}
	return out;
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
	return isWithinRange(from, to, config, grid, wrapOrBoard);
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
