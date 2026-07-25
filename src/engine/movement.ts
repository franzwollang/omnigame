/**
 * Pure movement legality helpers (M5 Move foothold).
 * Orthogonal step of range 1 — enough for Step Race; richer piece tables later.
 */
import type { Grid, Position, Player } from "@/engine/types";
import { getCell } from "@/engine/types";

export type MovementAdjacency = "orthogonal";

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

function inBounds(grid: Grid, pos: Position): boolean {
	return (
		pos.row >= 0 &&
		pos.row < grid.height &&
		pos.col >= 0 &&
		pos.col < grid.width
	);
}

/** Manhattan / Chebyshev distance depending on adjacency mode. */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig
): boolean {
	const dr = Math.abs(to.row - from.row);
	const dc = Math.abs(to.col - from.col);
	if (config.adjacency === "orthogonal") {
		return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
	}
	return false;
}

/** Empty destinations a piece at `from` may step to. */
export function legalDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig
): Position[] {
	if (!inBounds(grid, from)) return [];
	if (getCell(grid, from) === null) return [];

	const out: Position[] = [];
	if (config.adjacency === "orthogonal" && config.range === 1) {
		for (const [dr, dc] of ORTHOGONAL) {
			const to = { row: from.row + dr, col: from.col + dc };
			if (!inBounds(grid, to)) continue;
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
	config: MovementConfig
): boolean {
	if (!inBounds(grid, from) || !inBounds(grid, to)) return false;
	if (getCell(grid, from) !== player) return false;
	if (getCell(grid, to) !== null) return false;
	return isWithinRange(from, to, config);
}
