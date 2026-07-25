/**
 * Pure movement legality helpers (M5 Move foothold + piece-table adjacency).
 * Range-1 steps: orthogonal | diagonal | king (both). Richer ranges later.
 */
import type { Grid, Position, Player } from "@/engine/types";
import { getCell } from "@/engine/types";
import { inBounds, step } from "@/engine/adjacency";

export type MovementAdjacency = "orthogonal" | "diagonal" | "king";

export type MovementConfig = {
	adjacency: MovementAdjacency;
	range: 1;
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

/** Deltas for a movement adjacency at range 1. */
export function adjacencyDeltas(
	adjacency: MovementAdjacency
): ReadonlyArray<readonly [number, number]> {
	if (adjacency === "orthogonal") return ORTHOGONAL;
	if (adjacency === "diagonal") return DIAGONAL;
	return [...ORTHOGONAL, ...DIAGONAL];
}

/** Toroidal or clipped adjacency of range 1. */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig,
	grid?: Grid,
	wrap: boolean = false
): boolean {
	const deltas = adjacencyDeltas(config.adjacency);
	if (wrap && grid) {
		for (const [dr, dc] of deltas) {
			const n = step(grid, from, { row: dr, col: dc }, true);
			if (n && n.row === to.row && n.col === to.col) return true;
		}
		return false;
	}
	const dr = to.row - from.row;
	const dc = to.col - from.col;
	return deltas.some(([r, c]) => r === dr && c === dc);
}

/** Empty destinations a piece at `from` may step to. */
export function legalDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrap: boolean = false
): Position[] {
	if (!inBounds(grid, from)) return [];
	if (getCell(grid, from) === null) return [];

	const out: Position[] = [];
	if (config.range === 1) {
		for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
			const to = step(grid, from, { row: dr, col: dc }, wrap);
			if (!to) continue;
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
	wrap: boolean = false
): boolean {
	if (!inBounds(grid, from) || !inBounds(grid, to)) return false;
	if (getCell(grid, from) !== player) return false;
	if (getCell(grid, to) !== null) return false;
	return isWithinRange(from, to, config, grid, wrap);
}
