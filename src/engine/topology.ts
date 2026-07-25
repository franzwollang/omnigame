/**
 * Board topology helpers.
 * Rectangle uses row/col deltas; hex_offset uses odd-r (pointy-top) via cube coords.
 */
import type { Grid, Position } from "@/engine/types";
import type { AdjacencyConfig } from "@/engine/rules";
import { inBounds } from "@/engine/adjacency";

export type GridTopology = "rectangle" | "hex_offset";

export type Cube = { q: number; r: number; s: number };

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
	topology: GridTopology = "rectangle"
): Position[] {
	if (topology === "hex_offset") {
		const c = offsetToCube(pos);
		const out: Position[] = [];
		for (const d of CUBE_NEIGHBOR_DIRS) {
			const n = cubeToOffset({ q: c.q + d.q, r: c.r + d.r });
			if (inBounds(grid, n)) out.push(n);
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
		const n = { row: pos.row + d.row, col: pos.col + d.col };
		if (inBounds(grid, n)) out.push(n);
	}
	return out;
}

export type WinAdjFunc = (pos: Position) => Position[];

/** Directional step functions for n-in-a-row along enabled axes. */
export function getWinAdjFuncs(
	adjacency: AdjacencyConfig,
	topology: GridTopology = "rectangle"
): WinAdjFunc[] {
	if (topology === "hex_offset") {
		const funcs: WinAdjFunc[] = [];
		const pushAxis = (dirs: readonly Cube[]) => {
			for (const d of dirs) {
				funcs.push((pos) => {
					const c = offsetToCube(pos);
					return [cubeToOffset({ q: c.q + d.q, r: c.r + d.r })];
				});
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
