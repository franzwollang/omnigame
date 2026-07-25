/**
 * Pure movement legality helpers (M5 Move foothold).
 * Orthogonal step of range 1 — enough for Step Race; richer piece tables later.
 */
import type { Grid, Position, Player } from "@/engine/types";
import { getCell } from "@/engine/types";
import { inBounds, step } from "@/engine/adjacency";

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

/** Toroidal or clipped orthogonal adjacency of range 1. */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig,
	grid?: Grid,
	wrap: boolean = false
): boolean {
	if (config.adjacency !== "orthogonal") return false;
	if (wrap && grid) {
		for (const [dr, dc] of ORTHOGONAL) {
			const n = step(grid, from, { row: dr, col: dc }, true);
			if (n && n.row === to.row && n.col === to.col) return true;
		}
		return false;
	}
	const dr = Math.abs(to.row - from.row);
	const dc = Math.abs(to.col - from.col);
	return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
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
	if (config.adjacency === "orthogonal" && config.range === 1) {
		for (const [dr, dc] of ORTHOGONAL) {
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
