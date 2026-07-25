// Pure reducer: State -> Event -> State

import type {
	GameState,
	GameEvent,
	Position,
	Player,
	CellValue,
	Grid
} from "./types";
import { getCell, setCell, toIndex } from "./types";
import { checkWinner, type AdjacencyConfig } from "@/engine/rules";
import { applyCaptureIfAny } from "@/engine/capture";
import { fleetDestroyed } from "@/engine/observation";

export type InitialSeed = {
	row: number;
	col: number;
	player: Player;
	visibility?: "public" | "owner";
};

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	winLength: number;
	adjacency: AdjacencyConfig;
	inputMode?: "cell" | "column";
	placementMode?: "direct" | "gravity";
	/** Only `"down"` is implemented; other directions deferred. */
	gravityDirection?: "down";
	/** Bottom pop-out (Connect 4 Pop Out). `pop_out_top` deferred. */
	overflow?: "reject" | "pop_out_bottom";
	captureEnabled?: boolean;
	observationMode?: "full" | "hit_miss";
	objectiveMode?: "n_in_a_row" | "destroy_hidden";
	initial?: InitialSeed[];
};

function emptyGrid(width: number, height: number): Grid {
	return {
		width,
		height,
		cells: Array(width * height).fill(null) as CellValue[]
	};
}

// Create initial game state from config
export function createInitialState(config: GameConfig): GameState {
	const base: GameState = {
		grid: emptyGrid(config.gridWidth, config.gridHeight),
		currentPlayer: "X",
		status: "playing",
		winner: null,
		moveCount: 0
	};

	const seeds = config.initial ?? [];
	const hasOwner = seeds.some((p) => (p.visibility ?? "public") === "owner");
	if (hasOwner || config.observationMode === "hit_miss") {
		base.hidden = emptyGrid(config.gridWidth, config.gridHeight);
	}

	if (seeds.length === 0) return base;

	let publicCells = base.grid.cells;
	let hiddenCells = base.hidden?.cells;

	for (const p of seeds) {
		if (
			p.row < 0 ||
			p.row >= base.grid.height ||
			p.col < 0 ||
			p.col >= base.grid.width
		) {
			continue;
		}
		const visibility = p.visibility ?? "public";
		if (visibility === "owner") {
			if (!hiddenCells) {
				base.hidden = emptyGrid(config.gridWidth, config.gridHeight);
				hiddenCells = base.hidden.cells;
			}
			hiddenCells = setCell(
				{ ...base.grid, cells: hiddenCells },
				{ row: p.row, col: p.col },
				p.player
			);
		} else {
			publicCells = setCell(
				{ ...base.grid, cells: publicCells },
				{ row: p.row, col: p.col },
				p.player
			);
		}
	}

	base.grid = { ...base.grid, cells: publicCells };
	if (base.hidden && hiddenCells) {
		base.hidden = { ...base.hidden, cells: hiddenCells };
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
		case "fire":
			return handleFire(state, event.position, config);
		case "activateColumn":
			return handleActivateColumn(state, event.col, config);
		case "popOutColumn":
			return handlePopOutColumn(state, event.col, config);
		case "reset":
			return createInitialState(config);
		default:
			return state;
	}
}

function handleFire(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	if ((config.observationMode ?? "full") !== "hit_miss") return state;
	if (state.status !== "playing") return state;
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return state;
	}
	// Already shot
	if (getCell(state.grid, pos) !== null) return state;

	const occupant =
		state.hidden != null ? getCell(state.hidden, pos) : null;
	// Cannot fire on own fleet cell
	if (occupant === state.currentPlayer) return state;

	const result: CellValue =
		occupant === "X" || occupant === "O" ? "hit" : "miss";
	const newCells = setCell(state.grid, pos, result);
	const newGrid = { ...state.grid, cells: newCells };
	const newMoveCount = state.moveCount + 1;
	const next: GameState = {
		...state,
		grid: newGrid,
		moveCount: newMoveCount
	};

	if ((config.objectiveMode ?? "n_in_a_row") === "destroy_hidden") {
		const opponent: Player = state.currentPlayer === "X" ? "O" : "X";
		if (fleetDestroyed(next, opponent)) {
			return {
				...next,
				status: "won",
				winner: state.currentPlayer
			};
		}
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...next,
		currentPlayer: nextPlayer
	};
}

function handlePlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	// Hit/miss games use fire, not place
	if ((config.observationMode ?? "full") === "hit_miss") return state;

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

function handlePopOutColumn(
	state: GameState,
	col: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (col < 0 || col >= width) return state;

	// Only support pop-out from bottom with gravity down
	const direction = config.gravityDirection ?? "down";
	if (direction !== "down") return state;

	const bottomVal = getCell(state.grid, { row: height - 1, col });
	if (bottomVal === null) return state; // nothing to pop
	// Optional strict rule: must pop own token; relax by removing this if desired
	if (bottomVal !== state.currentPlayer) return state;

	// Shift column down: remove bottom, pull from above
	let newCells = [...state.grid.cells];
	for (let row = height - 1; row > 0; row--) {
		const from = { row: row - 1, col };
		const to = { row, col };
		newCells[toIndex(to, state.grid.width)] = getCell(state.grid, from);
	}
	// Top becomes empty
	newCells[toIndex({ row: 0, col }, state.grid.width)] = null;

	const newGrid = { ...state.grid, cells: newCells };
	const newMoveCount = state.moveCount + 1;

	// Check win conditions after pop (some variants may differ)
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

	const isFull = newCells.every((c) => c !== null);
	if (isFull) {
		return {
			...state,
			grid: newGrid,
			status: "draw",
			moveCount: newMoveCount
		};
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...state,
		grid: newGrid,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount
	};
}
