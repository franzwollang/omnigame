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
