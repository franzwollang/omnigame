// Pure reducer: State -> Event -> State

import type {
	GameState,
	GameEvent,
	Position,
	Player,
	CellValue
} from "./types";
import { getCell, setCell, toIndex } from "./types";
import { checkWinner, type AdjacencyConfig } from "@/engine/rules";

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	winLength: number;
	adjacency: AdjacencyConfig;
	inputMode?: "cell" | "column";
	placementMode?: "direct" | "gravity";
	gravityDirection?: "down" | "up" | "left" | "right";
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
		case "activateColumn":
			return handleActivateColumn(state, event.col, config);
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

function handleActivateColumn(
	state: GameState,
	col: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (col < 0 || col >= width) return state;

	// Only supported gravity down for now
	const direction = config.gravityDirection ?? "down";
	if (direction !== "down") {
		// Future directions can be added
		return state;
	}

	// Find first empty from bottom row to top
	let targetRow = -1;
	for (let row = height - 1; row >= 0; row--) {
		if (getCell(state.grid, { row, col }) === null) {
			targetRow = row;
			break;
		}
	}
	if (targetRow === -1) {
		// Column full
		return state;
	}

	return handlePlace(state, { row: targetRow, col }, config);
}
