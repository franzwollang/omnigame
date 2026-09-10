/**
 * Hazard layout + flood-fill region reveal (Minesweeper-style).
 *
 * Hidden layer holds `"mine"` markers; public grid holds revealed counts
 * (`0`–`8` rectangle / `0`–`6` hex) or `"mine"` after a hit. Flood expands
 * through zero-count cells and reveals the numbered frontier in one action.
 *
 * Adjacency is topology-aware: Chebyshev-8 on rectangle, cube-axis-6 on
 * hex_offset. Graph deferred.
 */
import { mulberry32 } from "@/engine/rng";
import { neighbors, type GridTopology } from "@/engine/topology";
import {
	getCell,
	setCell,
	toIndex,
	type CellValue,
	type Grid,
	type Position
} from "@/engine/types";

export type HazardCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type HazardsConfig = {
	count: number;
	/** When true, mines are placed on the first reveal, avoiding that cell. */
	firstRevealSafe?: boolean;
};

/** Topology stub — neighbors() only reads width/height for rect/hex. */
function stubGrid(width: number, height: number): Grid {
	return { width, height, cells: [] };
}

export function isHazardCount(v: CellValue): v is HazardCount {
	return typeof v === "number" && v >= 0 && v <= 8 && Number.isInteger(v);
}

export function isMineCell(v: CellValue): boolean {
	return v === "mine";
}

export function isRevealedCell(v: CellValue): boolean {
	return isHazardCount(v) || isMineCell(v);
}

export function inBounds(
	pos: Position,
	width: number,
	height: number
): boolean {
	return (
		pos.row >= 0 && pos.row < height && pos.col >= 0 && pos.col < width
	);
}

/**
 * Hazard-adjacent cells for flood counts / expansion.
 * Rectangle: Chebyshev 8-neighbors. Hex: six cube-axis neighbors.
 * Graph (and unknown): empty — flood_reveal forbids graph in schema.
 */
export function hazardNeighbors(
	pos: Position,
	width: number,
	height: number,
	topology: GridTopology = "rectangle"
): Position[] {
	if (topology === "graph") return [];
	const topo = topology === "hex_offset" ? "hex_offset" : "rectangle";
	return neighbors(stubGrid(width, height), pos, topo, undefined, false);
}

export function isMineAt(hidden: Grid, pos: Position): boolean {
	return getCell(hidden, pos) === "mine";
}

export function adjacentHazardCount(
	hidden: Grid,
	pos: Position,
	topology: GridTopology = "rectangle"
): HazardCount {
	let n = 0;
	for (const nb of hazardNeighbors(
		pos,
		hidden.width,
		hidden.height,
		topology
	)) {
		if (isMineAt(hidden, nb)) n += 1;
	}
	return n as HazardCount;
}

/**
 * Deterministic mine placement. Avoids `exclude` positions when provided
 * (first-reveal-safe). Uses Fisher–Yates with mulberry32.
 */
export function placeHazards(
	width: number,
	height: number,
	count: number,
	seed: number,
	exclude: ReadonlyArray<Position> = []
): CellValue[] {
	const total = width * height;
	const blocked = new Set(
		exclude
			.filter((p) => inBounds(p, width, height))
			.map((p) => toIndex(p, width))
	);
	const candidates: number[] = [];
	for (let i = 0; i < total; i++) {
		if (!blocked.has(i)) candidates.push(i);
	}
	const n = Math.min(Math.max(0, count), candidates.length);
	const rng = mulberry32(seed >>> 0);
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = candidates[i]!;
		candidates[i] = candidates[j]!;
		candidates[j] = tmp;
	}
	const cells: CellValue[] = Array(total).fill(null);
	for (let i = 0; i < n; i++) {
		cells[candidates[i]!] = "mine";
	}
	return cells;
}

export type FloodRevealResult = {
	positions: Position[];
	/** Parallel counts for each position (0–8). */
	counts: HazardCount[];
};

/**
 * Classic Minesweeper flood: expand through zero-count safe cells; include
 * the numbered frontier. Does not reveal mines. Skips already-revealed cells.
 * Adjacency follows `topology` (rectangle Chebyshev-8 or hex cube-axis-6).
 */
export function floodRevealRegion(
	hidden: Grid,
	publicGrid: Grid,
	start: Position,
	topology: GridTopology = "rectangle"
): FloodRevealResult {
	const positions: Position[] = [];
	const counts: HazardCount[] = [];
	if (!inBounds(start, hidden.width, hidden.height)) {
		return { positions, counts };
	}
	if (isMineAt(hidden, start)) {
		return { positions, counts };
	}
	if (getCell(publicGrid, start) !== null) {
		return { positions, counts };
	}

	const seen = new Set<number>();
	const queue: Position[] = [start];
	seen.add(toIndex(start, hidden.width));

	while (queue.length > 0) {
		const cur = queue.shift()!;
		const count = adjacentHazardCount(hidden, cur, topology);
		positions.push(cur);
		counts.push(count);
		if (count !== 0) continue;
		for (const nb of hazardNeighbors(
			cur,
			hidden.width,
			hidden.height,
			topology
		)) {
			const idx = toIndex(nb, hidden.width);
			if (seen.has(idx)) continue;
			if (isMineAt(hidden, nb)) continue;
			if (getCell(publicGrid, nb) !== null) continue;
			seen.add(idx);
			queue.push(nb);
		}
	}

	return { positions, counts };
}

/** Apply flood (or single-cell) reveals onto a public cell array. */
export function applyReveals(
	publicGrid: Grid,
	flood: FloodRevealResult
): CellValue[] {
	let cells = publicGrid.cells;
	for (let i = 0; i < flood.positions.length; i++) {
		const pos = flood.positions[i]!;
		const count = flood.counts[i]!;
		cells = setCell({ ...publicGrid, cells }, pos, count);
	}
	return cells;
}

/** True when every non-mine cell has been revealed on the public grid. */
export function allSafeRevealed(hidden: Grid, publicGrid: Grid): boolean {
	const n = hidden.cells.length;
	for (let i = 0; i < n; i++) {
		if (hidden.cells[i] === "mine") continue;
		const pub = publicGrid.cells[i] ?? null;
		if (!isHazardCount(pub)) return false;
	}
	return true;
}

export function mineCount(hidden: Grid): number {
	let n = 0;
	for (const c of hidden.cells) {
		if (c === "mine") n += 1;
	}
	return n;
}
