// Pure reducer: State -> Event -> State

import type {
	GameState,
	GameEvent,
	Position,
	Player,
	CellValue
} from "./types";
import { getCell, setCell, toIndex } from "./types";
import { checkWinner, type AdjacencyConfig } from "./rules";

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	winLength: number;
	adjacency: AdjacencyConfig;
};

// Create initial game state from config
export function createInitialState(config: GameConfig): GameState {
	return {
		grid: {
			width: config.gridWidth,
			height: config.gridHeight,
			cells: Array(config.gridWidth * config.gridHeight).fill(null)
		},
		currentPlayer: "X",
		status: "playing",
		winner: null,
		moveCount: 0
	};
}

// Pure reducer
export function reduce(
	state: GameState,
	event: GameEvent,
	config: GameConfig
): GameState {
	switch (event.type) {
		case "place":
			return handlePlace(state, event.position, config);
		case "reset":
			return createInitialState(config);
		default:
			return state;
	}
}

function handlePlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	// Guard: can only place if game is playing
	if (state.status !== "playing") return state;

	// Guard: position must be in bounds
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return state;
	}

	// Guard: cell must be empty
	if (getCell(state.grid, pos) !== null) return state;

	// Effect: place current player's mark
	const newCells = setCell(state.grid, pos, state.currentPlayer);
	const newMoveCount = state.moveCount + 1;

	// Check win condition using config
	const newGrid = { ...state.grid, cells: newCells };
	const winner = checkWinner(
		newGrid,
		state.currentPlayer,
		config.winLength,
		config.adjacency
	);
	if (winner) {
		return {
			...state,
			grid: newGrid,
			status: "won",
			winner: state.currentPlayer,
			moveCount: newMoveCount
		};
	}

	// Check draw (all cells filled)
	const isFull = newCells.every((c) => c !== null);
	if (isFull) {
		return {
			...state,
			grid: newGrid,
			status: "draw",
			moveCount: newMoveCount
		};
	}

	// Effect: advance turn
	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";

	return {
		...state,
		grid: newGrid,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount
	};
}
