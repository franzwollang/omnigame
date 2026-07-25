import type { Position, Grid } from "@/engine/types";
import type { AdjacencyConfig } from "@/engine/rules";

export function getEnabledDirections(cfg: AdjacencyConfig): Position[] {
	const dirs: Position[] = [];
	if (cfg.horizontal) dirs.push({ row: 0, col: -1 }, { row: 0, col: 1 });
	if (cfg.vertical) dirs.push({ row: -1, col: 0 }, { row: 1, col: 0 });
	if (cfg.backDiagonal) dirs.push({ row: -1, col: -1 }, { row: 1, col: 1 });
	if (cfg.forwardDiagonal) dirs.push({ row: -1, col: 1 }, { row: 1, col: -1 });
	return dirs;
}

export function inBounds(grid: Grid, p: Position): boolean {
	return p.row >= 0 && p.row < grid.height && p.col >= 0 && p.col < grid.width;
}

/**
 * Map a possibly out-of-bounds coordinate onto the board.
 * When `wrap` is true, uses modular (toroidal) arithmetic; otherwise null if OOB.
 */
export function normalizePos(
	grid: Grid,
	p: Position,
	wrap: boolean
): Position | null {
	if (wrap) {
		const h = grid.height;
		const w = grid.width;
		if (h <= 0 || w <= 0) return null;
		return {
			row: ((p.row % h) + h) % h,
			col: ((p.col % w) + w) % w
		};
	}
	return inBounds(grid, p) ? p : null;
}

/** One step from `from` by `delta`, optionally wrapping. */
export function step(
	grid: Grid,
	from: Position,
	delta: { row: number; col: number },
	wrap: boolean
): Position | null {
	return normalizePos(
		grid,
		{ row: from.row + delta.row, col: from.col + delta.col },
		wrap
	);
}
