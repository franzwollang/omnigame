/**
 * Memory Flip / tile pair-matching.
 *
 * Hidden layer holds `mem:N` pair marks (exactly two of each index).
 * Public grid shows face-up / matched marks; face-down cells stay null.
 * Flip two tiles per turn; match scores permanently; mismatch re-hides.
 */
import { mulberry32 } from "@/engine/rng";
import {
	getCell,
	setCell,
	toIndex,
	type CellValue,
	type Grid,
	type Position
} from "@/engine/types";

export type MemoryConfig = {
	pairCount: number;
	/** When true, scorer keeps the turn after a match. Default false. */
	bonusTurnOnMatch?: boolean;
};

const MEM_PREFIX = "mem:";

export function memoryMark(index: number): `mem:${number}` {
	return `${MEM_PREFIX}${index}` as `mem:${number}`;
}

export function isMemoryMark(v: CellValue): v is `mem:${number}` {
	return typeof v === "string" && v.startsWith(MEM_PREFIX);
}

export function memoryIndex(v: CellValue): number | null {
	if (!isMemoryMark(v)) return null;
	const n = Number(v.slice(MEM_PREFIX.length));
	return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Fisher–Yates shuffle of a deck with `pairCount` symbols × 2.
 * Returns a flat CellValue[] of length width×height.
 */
export function shufflePairDeck(
	width: number,
	height: number,
	pairCount: number,
	seed: number
): CellValue[] {
	const cells = width * height;
	if (cells !== pairCount * 2) {
		throw new Error(
			`shufflePairDeck: cells (${cells}) must equal 2×pairCount (${pairCount * 2})`
		);
	}
	const deck: CellValue[] = [];
	for (let i = 0; i < pairCount; i++) {
		deck.push(memoryMark(i), memoryMark(i));
	}
	const rng = mulberry32(seed >>> 0);
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = deck[i]!;
		deck[i] = deck[j]!;
		deck[j] = tmp;
	}
	return deck;
}

export function emptyMatched(width: number, height: number): boolean[] {
	return Array.from({ length: width * height }, () => false);
}

export function isMatchedAt(
	matched: boolean[],
	pos: Position,
	width: number
): boolean {
	return matched[toIndex(pos, width)] === true;
}

export function isFaceDown(
	publicGrid: Grid,
	matched: boolean[],
	pos: Position
): boolean {
	return (
		getCell(publicGrid, pos) === null &&
		!isMatchedAt(matched, pos, publicGrid.width)
	);
}

export function allPairsMatched(matched: boolean[]): boolean {
	return matched.length > 0 && matched.every((m) => m === true);
}

export function markMatched(
	matched: boolean[],
	positions: Position[],
	width: number
): boolean[] {
	const next = [...matched];
	for (const pos of positions) {
		next[toIndex(pos, width)] = true;
	}
	return next;
}

export function hidePositions(grid: Grid, positions: Position[]): CellValue[] {
	let cells = grid.cells;
	for (const pos of positions) {
		cells = setCell({ ...grid, cells }, pos, null);
	}
	return cells;
}

export function samePosition(a: Position, b: Position): boolean {
	return a.row === b.row && a.col === b.col;
}

export function listHasPosition(
	list: ReadonlyArray<Position>,
	pos: Position
): boolean {
	return list.some((p) => samePosition(p, pos));
}
