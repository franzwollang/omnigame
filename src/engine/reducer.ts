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
import {
	applyLibertyCapture,
	areaOutcome,
	isLegalLibertyPlace
} from "@/engine/liberties";
import { fleetDestroyed } from "@/engine/observation";
import {
	advanceFleetProgress,
	bothFleetsPlaced,
	canPlaceFleetCell,
	initialFleetProgressMap,
	usesPlacementPhase,
	type FleetConfig
} from "@/engine/fleet";
import { canMove, type MovementConfig } from "@/engine/movement";
import {
	applyLifeStep,
	type SchedulerConfig
} from "@/engine/scheduler";
import {
	isActivePosition,
	type GraphTopologyData,
	type GridTopology
} from "@/engine/topology";
import { getCell as readCell } from "@/engine/types";

export type InitialSeed = {
	row: number;
	col: number;
	player: Player;
	visibility?: "public" | "owner";
};

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	/** Board topology; default rectangle. */
	topology?: GridTopology;
	/** Compiled adjacency when topology = graph. */
	graph?: GraphTopologyData;
	/** Toroidal adjacency for rectangle boards. */
	gridWrap?: boolean;
	winLength: number;
	adjacency: AdjacencyConfig;
	inputMode?: "cell" | "column" | "move";
	placementMode?: "direct" | "gravity";
	/** Only `"down"` is implemented; other directions deferred. */
	gravityDirection?: "down";
	/** Bottom pop-out (Connect 4 Pop Out). `pop_out_top` deferred. */
	overflow?: "reject" | "pop_out_bottom";
	captureEnabled?: boolean;
	/** flip = Reversi; liberties = Go-lite group removal. */
	captureMode?: "flip" | "liberties";
	observationMode?: "full" | "hit_miss" | "fog";
	/** Fog-of-war radius (Chebyshev/Manhattan/hex/graph hops). Used when mode=fog. */
	fogRadius?: number;
	fogMetric?: "chebyshev" | "manhattan";
	objectiveMode?:
		| "n_in_a_row"
		| "destroy_hidden"
		| "reach_row"
		| "area_control"
		| "none";
	/** Classic alternating turns vs discrete global tick (Life Lite). */
	turnSchedule?: "alternating" | "manual_tick";
	scheduler?: SchedulerConfig;
	movement?: MovementConfig;
	/** Home rows for reach_row objective (player → target row index). */
	targetRows?: { X: number; O: number };
	/**
	 * Multi-ship placement phase for hit_miss. When set, game starts in
	 * placement (place onto hidden) then transitions to combat (fire).
	 */
	fleet?: FleetConfig;
	initial?: InitialSeed[];
};

function emptyGrid(width: number, height: number): Grid {
	return {
		width,
		height,
		cells: Array(width * height).fill(null) as CellValue[]
	};
}

function isBoardFull(grid: Grid, config: GameConfig): boolean {
	const topology = config.topology ?? "rectangle";
	if (topology === "graph" && config.graph) {
		return config.graph.active.every((pos) => readCell(grid, pos) !== null);
	}
	return grid.cells.every((c) => c !== null);
}

// Create initial game state from config
export function createInitialState(config: GameConfig): GameState {
	const placement = usesPlacementPhase(config.fleet);
	const base: GameState = {
		grid: emptyGrid(config.gridWidth, config.gridHeight),
		currentPlayer: "X",
		status: "playing",
		winner: null,
		moveCount: 0,
		consecutivePasses: 0,
		phase: placement ? "placement" : "combat",
		fleetProgress: placement ? initialFleetProgressMap() : undefined
	};

	const seeds = config.initial ?? [];
	const hasOwner = seeds.some((p) => (p.visibility ?? "public") === "owner");
	if (hasOwner || config.observationMode === "hit_miss" || placement) {
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
		case "move":
			return handleMove(state, event.from, event.to, config);
		case "fire":
			return handleFire(state, event.position, config);
		case "activateColumn":
			return handleActivateColumn(state, event.col, config);
		case "popOutColumn":
			return handlePopOutColumn(state, event.col, config);
		case "tick":
			return handleTick(state, config);
		case "pass":
			return handlePass(state, config);
		case "reset":
			return createInitialState(config);
		default:
			return state;
	}
}

function handlePass(state: GameState, config: GameConfig): GameState {
	if ((config.objectiveMode ?? "n_in_a_row") !== "area_control") return state;
	if (state.status !== "playing") return state;

	const passes = (state.consecutivePasses ?? 0) + 1;
	const newMoveCount = state.moveCount + 1;

	if (passes >= 2) {
		const { status, winner } = areaOutcome(
			state.grid,
			config.gridWrap === true
		);
		return {
			...state,
			status,
			winner,
			moveCount: newMoveCount,
			consecutivePasses: passes
		};
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...state,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount,
		consecutivePasses: passes
	};
}

function handleTick(state: GameState, config: GameConfig): GameState {
	if ((config.turnSchedule ?? "alternating") !== "manual_tick") return state;
	if (state.status !== "playing") return state;
	const scheduler = config.scheduler;
	if (!scheduler) return state;

	const newGrid = applyLifeStep(
		state.grid,
		scheduler.rules,
		config.gridWrap === true
	);
	return {
		...state,
		grid: newGrid,
		moveCount: state.moveCount + 1
		// Tick is a neutral global step — do not flip currentPlayer
	};
}

function handleMove(
	state: GameState,
	from: Position,
	to: Position,
	config: GameConfig
): GameState {
	if ((config.inputMode ?? "cell") !== "move") return state;
	if (state.status !== "playing") return state;
	const movement = config.movement;
	if (!movement) return state;
	if (
		!canMove(
			state.grid,
			from,
			to,
			state.currentPlayer,
			movement,
			config.gridWrap === true
		)
	) {
		return state;
	}

	let cells = setCell(state.grid, from, null);
	cells = setCell({ ...state.grid, cells }, to, state.currentPlayer);
	const newGrid = { ...state.grid, cells };
	const newMoveCount = state.moveCount + 1;
	const next: GameState = {
		...state,
		grid: newGrid,
		moveCount: newMoveCount
	};

	if ((config.objectiveMode ?? "n_in_a_row") === "reach_row") {
		const target = config.targetRows?.[state.currentPlayer];
		if (target != null && to.row === target) {
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

function handleFire(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	if ((config.observationMode ?? "full") !== "hit_miss") return state;
	if (state.status !== "playing") return state;
	// Placement phase: only place actions are legal
	if ((state.phase ?? "combat") === "placement") return state;
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

function handleFleetPlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	const fleet = config.fleet;
	if (!fleet || !usesPlacementPhase(fleet)) return state;
	if (!canPlaceFleetCell(state, pos, state.currentPlayer, fleet)) {
		return state;
	}
	if (!state.hidden || !state.fleetProgress) return state;

	const hiddenCells = setCell(state.hidden, pos, state.currentPlayer);
	const playerProgress = advanceFleetProgress(
		state.fleetProgress[state.currentPlayer],
		pos,
		fleet
	);
	const fleetProgress = {
		...state.fleetProgress,
		[state.currentPlayer]: playerProgress
	};
	const newMoveCount = state.moveCount + 1;

	if (bothFleetsPlaced(fleetProgress)) {
		return {
			...state,
			hidden: { ...state.hidden, cells: hiddenCells },
			fleetProgress,
			phase: "combat",
			currentPlayer: "X",
			moveCount: newMoveCount
		};
	}

	// Current player keeps placing until their fleet is done; then hand off.
	if (playerProgress.done) {
		const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
		return {
			...state,
			hidden: { ...state.hidden, cells: hiddenCells },
			fleetProgress,
			currentPlayer: nextPlayer,
			moveCount: newMoveCount
		};
	}

	return {
		...state,
		hidden: { ...state.hidden, cells: hiddenCells },
		fleetProgress,
		moveCount: newMoveCount
	};
}

function handlePlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	// Hit/miss with fleet: place onto hidden during placement phase
	if ((config.observationMode ?? "full") === "hit_miss") {
		return handleFleetPlace(state, pos, config);
	}
	// Move games relocate existing pieces
	if ((config.inputMode ?? "cell") === "move") return state;

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

	// Guard: graph boards only place on declared nodes
	const topology = config.topology ?? "rectangle";
	if (!isActivePosition(pos, topology, config.graph)) {
		return state;
	}

	// Guard: cell must be empty
	if (getCell(state.grid, pos) !== null) return state;

	const captureMode = config.captureMode ?? "flip";
	const libertyMode =
		Boolean(config.captureEnabled) && captureMode === "liberties";

	const wrap = config.gridWrap === true;

	// Go-lite: empty + no suicide after opponent group capture
	if (libertyMode) {
		if (!isLegalLibertyPlace(state.grid, pos, state.currentPlayer, wrap)) {
			return state;
		}
	} else if (config.captureEnabled) {
		// Reversi: must flip at least one line
		const placedCells = setCell(state.grid, pos, state.currentPlayer);
		const after = applyCaptureIfAny(
			{ ...state.grid, cells: placedCells },
			pos,
			state.currentPlayer,
			config.adjacency,
			wrap
		);
		if (after === placedCells) {
			return state;
		}
	}

	// Effect: place current player's mark
	let newCells = setCell(state.grid, pos, state.currentPlayer);
	if (libertyMode) {
		newCells = applyLibertyCapture(
			{ ...state.grid, cells: newCells },
			pos,
			state.currentPlayer,
			wrap
		);
	} else if (config.captureEnabled) {
		newCells = applyCaptureIfAny(
			{ ...state.grid, cells: newCells },
			pos,
			state.currentPlayer,
			config.adjacency,
			wrap
		);
	}
	const newMoveCount = state.moveCount + 1;
	const newGrid = { ...state.grid, cells: newCells };

	// Open-ended demos (Life Lite): place seeds without win/turn flip
	if ((config.objectiveMode ?? "n_in_a_row") === "none") {
		return {
			...state,
			grid: newGrid,
			moveCount: newMoveCount
		};
	}

	// Area control (Go-lite): play continues until two passes; no mid-game n-in-a-row
	if ((config.objectiveMode ?? "n_in_a_row") === "area_control") {
		const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
		return {
			...state,
			grid: newGrid,
			currentPlayer: nextPlayer,
			moveCount: newMoveCount,
			consecutivePasses: 0
		};
	}

	// Check win condition using config
	const winner = checkWinner(
		newGrid,
		state.currentPlayer,
		config.winLength,
		config.adjacency,
		config.topology ?? "rectangle",
		config.graph,
		wrap
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

	// Check draw (all playable cells filled)
	const isFull = isBoardFull(newGrid, config);
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
		config.adjacency,
		config.topology ?? "rectangle",
		config.graph,
		config.gridWrap === true
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

	const isFull = isBoardFull(newGrid, config);
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
