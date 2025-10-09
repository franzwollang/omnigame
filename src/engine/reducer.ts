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
import { applyCaptureIfAny } from "@/engine/capture";

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	winLength: number;
	adjacency: AdjacencyConfig;
	inputMode?: "cell" | "column";
	placementMode?: "direct" | "gravity";
	gravityDirection?: "down" | "up" | "left" | "right";
	captureEnabled?: boolean;
	initial?: { row: number; col: number; player: Player }[];
};

// Create initial game state from config
export function createInitialState(config: GameConfig): GameState {
	const base: GameState = {
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
	// Seed initial placements if provided (e.g., Reversi starting position)
	if (config.initial && config.initial.length > 0) {
		let cells = base.grid.cells;
		for (const p of config.initial) {
			if (
				p.row >= 0 &&
				p.row < base.grid.height &&
				p.col >= 0 &&
				p.col < base.grid.width
			) {
				cells = setCell(
					{ ...base.grid, cells },
					{ row: p.row, col: p.col },
					p.player
				);
			}
		}
		base.grid = { ...base.grid, cells };
	}
	return base;
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
	// Guard: if capture required (Reversi style), ensure move captures at least one line
	if (config.captureEnabled) {
		// simulate capture
		const placedCells = setCell(state.grid, pos, state.currentPlayer);
		const after = applyCaptureIfAny(
			{ ...state.grid, cells: placedCells },
			pos,
			state.currentPlayer,
			config.adjacency
		);
		if (after === placedCells) {
			// no capture occurred; invalid
			return state;
		}
	}

	// Effect: place current player's mark
	let newCells = setCell(state.grid, pos, state.currentPlayer);
	// Optional capture (Reversi-style)
	if (config.captureEnabled) {
		newCells = applyCaptureIfAny(
			{ ...state.grid, cells: newCells },
			pos,
			state.currentPlayer,
			config.adjacency
		);
	}
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
