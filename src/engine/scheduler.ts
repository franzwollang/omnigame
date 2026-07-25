/**
 * Discrete tick / Life scheduler helpers (M5).
 * Synchronous global update — IO loops stay at the UI edge.
 */
import type { CellValue, Grid } from "@/engine/types";
import { getCell, toIndex } from "@/engine/types";
import { step } from "@/engine/adjacency";

export type SchedulerRules = "life_b3s23";
export type SchedulerNeighborhood = "moore";

export type SchedulerConfig = {
	rules: SchedulerRules;
	neighborhood: SchedulerNeighborhood;
};

/** Moore neighborhood offsets (8 neighbors). */
const MOORE: ReadonlyArray<readonly [number, number]> = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1]
];

/** Alive = any player token (X/O). Shot marks / null are dead. */
export function isAlive(value: CellValue): boolean {
	return value === "X" || value === "O";
}

export function countAliveNeighbors(
	grid: Grid,
	row: number,
	col: number,
	wrap: boolean = false
): number {
	let n = 0;
	const origin = { row, col };
	for (const [dr, dc] of MOORE) {
		const next = step(grid, origin, { row: dr, col: dc }, wrap);
		if (!next) continue;
		if (isAlive(getCell(grid, next))) n += 1;
	}
	return n;
}

/**
 * One Conway B3/S23 generation. Births inherit the canonical alive mark `"X"`.
 * Double-buffered: all fates computed from `grid`, then applied.
 */
export function applyLifeStep(
	grid: Grid,
	_rules: SchedulerRules = "life_b3s23",
	wrap: boolean = false
): Grid {
	const next = new Array<CellValue>(grid.cells.length);
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const idx = toIndex({ row, col }, grid.width);
			const alive = isAlive(grid.cells[idx] ?? null);
			const neighbors = countAliveNeighbors(grid, row, col, wrap);
			if (alive) {
				// Survive with 2 or 3 neighbors; else die
				next[idx] = neighbors === 2 || neighbors === 3 ? "X" : null;
			} else {
				// Birth with exactly 3 neighbors
				next[idx] = neighbors === 3 ? "X" : null;
			}
		}
	}
	return { ...grid, cells: next };
}
