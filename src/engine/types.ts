// Core engine types for OmniGame
// Pure functional: State -> Event -> State

export type Player = "X" | "O";
export type CellValue = Player | null;
export type Position = { row: number; col: number };

export type Grid = {
	width: number;
	height: number;
	cells: CellValue[];
};

export type GameStatus = "playing" | "won" | "draw";

export type GameState = {
	grid: Grid;
	currentPlayer: Player;
	status: GameStatus;
	winner: Player | null;
	moveCount: number;
};

export type PlaceMoveEvent = {
	type: "place";
	position: Position;
};

export type ResetEvent = {
	type: "reset";
};

export type GameEvent = PlaceMoveEvent | ResetEvent;

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
