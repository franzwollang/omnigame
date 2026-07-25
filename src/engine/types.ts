// Core engine types for OmniGame
// Pure functional: State -> Event -> State

export type Player = "X" | "O";
/** Public cell marks: player tokens, or hit/miss shot results (partial-info). */
export type CellValue = Player | "hit" | "miss" | null;
export type Position = { row: number; col: number };

export type Grid = {
	width: number;
	height: number;
	cells: CellValue[];
};

export type GameStatus = "playing" | "won" | "draw";

/** hit_miss: placement = lay fleet; combat = fire. Other modes omit / combat. */
export type GamePhase = "placement" | "combat";

export type GameState = {
	/** Public board (placements or shot results). */
	grid: Grid;
	/** Owner-only fleet layer for hit/miss games; absent in full-info games. */
	hidden?: Grid;
	currentPlayer: Player;
	status: GameStatus;
	winner: Player | null;
	moveCount: number;
	/** Consecutive pass actions (area_control / Go-lite); two ends the game. */
	consecutivePasses?: number;
	/**
	 * Simple (point) ko: intersection forbidden for the next place only.
	 * Set when a single stone was just captured; cleared otherwise / on reset.
	 * Pass does not clear (Go-correct). Unused when koRule = positional.
	 */
	koPoint?: Position | null;
	/**
	 * Positional superko: hashes of prior public-board positions (cells only).
	 * Seeded with the initial board; appended after each successful place.
	 * Pass does not append (board unchanged).
	 */
	positionHistory?: string[];
	/** Placement vs combat for fleet games; default combat when omitted. */
	phase?: GamePhase;
	/** Per-player ship placement progress when phase = placement. */
	fleetProgress?: {
		X: {
			shipIndex: number;
			cells: Array<{ row: number; col: number }>;
			done: boolean;
		};
		O: {
			shipIndex: number;
			cells: Array<{ row: number; col: number }>;
			done: boolean;
		};
	};
};

export type PlaceMoveEvent = {
	type: "place";
	position: Position;
};

export type MoveEvent = {
	type: "move";
	from: Position;
	to: Position;
};

export type FireEvent = {
	type: "fire";
	position: Position;
};

export type ActivateColumnEvent = {
	type: "activateColumn";
	col: number;
};

export type ActivateRowEvent = {
	type: "activateRow";
	row: number;
};

export type PopOutColumnEvent = {
	type: "popOutColumn";
	col: number;
};

export type TickEvent = {
	type: "tick";
};

export type PassEvent = {
	type: "pass";
};

export type ResetEvent = {
	type: "reset";
};

export type GameEvent =
	| PlaceMoveEvent
	| MoveEvent
	| FireEvent
	| ActivateColumnEvent
	| ActivateRowEvent
	| PopOutColumnEvent
	| TickEvent
	| PassEvent
	| ResetEvent;

// Helper to convert row/col to flat index
export function toIndex(pos: Position, width: number): number {
	return pos.row * width + pos.col;
}

// Helper to get cell value at position
export function getCell(grid: Grid, pos: Position): CellValue {
	return grid.cells[toIndex(pos, grid.width)] ?? null;
}

// Helper to set cell value at position (pure, returns new cells array)
export function setCell(
	grid: Grid,
	pos: Position,
	value: CellValue
): CellValue[] {
	const index = toIndex(pos, grid.width);
	const newCells = [...grid.cells];
	newCells[index] = value;
	return newCells;
}
