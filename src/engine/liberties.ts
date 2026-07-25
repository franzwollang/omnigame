/**
 * Liberty / group-capture helpers (M5 Go-lite foothold).
 * Orthogonal connectivity only — enough for group capture + area scoring.
 * No ko; suicide is illegal after resolving opponent captures.
 */
import type { CellValue, Grid, Player, Position } from "@/engine/types";
import { getCell, setCell, toIndex } from "@/engine/types";
import { step } from "@/engine/adjacency";

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

function keyOf(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

/** Four orthogonal neighbors (von Neumann); toroidal when wrap=true. */
export function orthogonalNeighbors(
	grid: Grid,
	pos: Position,
	wrap: boolean = false
): Position[] {
	const out: Position[] = [];
	for (const [dr, dc] of ORTHOGONAL) {
		const next = step(grid, pos, { row: dr, col: dc }, wrap);
		if (next) out.push(next);
	}
	return out;
}

/** Flood-fill same-color stone group containing `start` (must be occupied). */
export function findGroup(
	grid: Grid,
	start: Position,
	wrap: boolean = false
): Position[] {
	const color = getCell(grid, start);
	if (color !== "X" && color !== "O") return [];

	const group: Position[] = [];
	const seen = new Set<string>();
	const stack: Position[] = [start];
	seen.add(keyOf(start));

	while (stack.length > 0) {
		const cur = stack.pop()!;
		group.push(cur);
		for (const n of orthogonalNeighbors(grid, cur, wrap)) {
			const k = keyOf(n);
			if (seen.has(k)) continue;
			if (getCell(grid, n) !== color) continue;
			seen.add(k);
			stack.push(n);
		}
	}
	return group;
}

/** Distinct empty cells orthogonally adjacent to any stone in the group. */
export function countLiberties(
	grid: Grid,
	group: Position[],
	wrap: boolean = false
): number {
	const libs = new Set<string>();
	for (const stone of group) {
		for (const n of orthogonalNeighbors(grid, stone, wrap)) {
			if (getCell(grid, n) === null) libs.add(keyOf(n));
		}
	}
	return libs.size;
}

function removePositions(grid: Grid, positions: Position[]): CellValue[] {
	let cells = grid.cells;
	for (const p of positions) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return cells;
}

/**
 * After a stone is placed at `placed`, remove any opponent groups with
 * zero liberties. Does not check suicide of the placer's group.
 */
export function applyLibertyCapture(
	grid: Grid,
	placed: Position,
	currentPlayer: Player,
	wrap: boolean = false
): CellValue[] {
	const opponent: Player = currentPlayer === "X" ? "O" : "X";
	let cells = grid.cells;
	const working: Grid = { ...grid, cells };
	const removed = new Set<string>();

	for (const n of orthogonalNeighbors(working, placed, wrap)) {
		if (getCell(working, n) !== opponent) continue;
		const k = keyOf(n);
		if (removed.has(k)) continue;
		const group = findGroup({ ...working, cells }, n, wrap);
		if (group.length === 0) continue;
		if (countLiberties({ ...working, cells }, group, wrap) === 0) {
			cells = removePositions({ ...working, cells }, group);
			for (const p of group) removed.add(keyOf(p));
		}
	}
	return cells;
}

/**
 * Legal Go-lite placement: empty cell, and after place + opponent capture
 * the placer's group still has ≥1 liberty (no suicide).
 */
export function isLegalLibertyPlace(
	grid: Grid,
	pos: Position,
	player: Player,
	wrap: boolean = false
): boolean {
	if (!inBounds(grid, pos)) return false;
	if (getCell(grid, pos) !== null) return false;

	const placedCells = setCell(grid, pos, player);
	const afterCapture = applyLibertyCapture(
		{ ...grid, cells: placedCells },
		pos,
		player,
		wrap
	);
	const afterGrid: Grid = { ...grid, cells: afterCapture };
	const ownGroup = findGroup(afterGrid, pos, wrap);
	return countLiberties(afterGrid, ownGroup, wrap) > 0;
}

export type AreaScore = { X: number; O: number };

/**
 * Simplified area scoring: stones + empty regions bordered only by one color.
 * Mixed-border or edge-open empty regions score for neither (dame).
 * On wrap boards, regions never "edge-open" via board boundary.
 */
export function scoreArea(grid: Grid, wrap: boolean = false): AreaScore {
	const score: AreaScore = { X: 0, O: 0 };
	for (const cell of grid.cells) {
		if (cell === "X") score.X += 1;
		else if (cell === "O") score.O += 1;
	}

	const visited = new Set<string>();
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const start = { row, col };
			const k = keyOf(start);
			if (visited.has(k)) continue;
			if (getCell(grid, start) !== null) {
				visited.add(k);
				continue;
			}

			const region: Position[] = [];
			const border = new Set<Player>();
			const stack: Position[] = [start];
			visited.add(k);

			while (stack.length > 0) {
				const cur = stack.pop()!;
				region.push(cur);
				for (const n of orthogonalNeighbors(grid, cur, wrap)) {
					const nk = keyOf(n);
					const val = getCell(grid, n);
					if (val === null) {
						if (!visited.has(nk)) {
							visited.add(nk);
							stack.push(n);
						}
					} else if (val === "X" || val === "O") {
						border.add(val);
					}
				}
			}

			if (border.size === 1) {
				const owner = border.has("X") ? "X" : "O";
				score[owner] += region.length;
			}
		}
	}

	return score;
}

/** Winner by area score; draw on tie. */
export function areaOutcome(
	grid: Grid,
	wrap: boolean = false
): {
	status: "won" | "draw";
	winner: Player | null;
	score: AreaScore;
} {
	const score = scoreArea(grid, wrap);
	if (score.X > score.O) return { status: "won", winner: "X", score };
	if (score.O > score.X) return { status: "won", winner: "O", score };
	return { status: "draw", winner: null, score };
}

/** Debug helper: liberty count for the group at a stone. */
export function libertiesAt(
	grid: Grid,
	pos: Position,
	wrap: boolean = false
): number {
	const group = findGroup(grid, pos, wrap);
	if (group.length === 0) return 0;
	return countLiberties(grid, group, wrap);
}

export function cellIndex(grid: Grid, pos: Position): number {
	return toIndex(pos, grid.width);
}
