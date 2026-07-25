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

export type GameState = {
	/** Public board (placements or shot results). */
	grid: Grid;
	/** Owner-only fleet layer for hit/miss games; absent in full-info games. */
	hidden?: Grid;
	currentPlayer: Player;
	status: GameStatus;
	winner: Player | null;
	moveCount: number;
};

export type PlaceMoveEvent = {
	type: "place";
	position: Position;
};

export type FireEvent = {
	type: "fire";
	position: Position;
};

export type ActivateColumnEvent = {
	type: "activateColumn";
	col: number;
};

export type PopOutColumnEvent = {
	type: "popOutColumn";
	col: number;
};

export type ResetEvent = {
	type: "reset";
};

export type GameEvent =
	| PlaceMoveEvent
	| FireEvent
	| ActivateColumnEvent
	| PopOutColumnEvent
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
